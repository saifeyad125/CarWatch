import json
import time
import warnings
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.model_selection import KFold, GroupKFold
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

import lightgbm as lgb

warnings.filterwarnings("ignore")

# config
PROJECT_ROOT = Path(__file__).parent.parent
TRAIN_PATH = PROJECT_ROOT / "ai_training" / "datasets" / "train2.csv"
TEST_PATH  = PROJECT_ROOT / "ai_training" / "datasets" / "test2.csv"
OUTPUT_DIR = PROJECT_ROOT / "ai_training" / "outputs"

N_FOLDS = 5
RANDOM_SEED = 42
EARLY_STOPPING = 100
LUX_THRESHOLD = 800_000
BETA = 0.4

CAT_FEATURES = [
    "brand", "model", "trim", "fuel_type", "body_type",
    "steering_side", "regional_specs", "doors", "seating_capacity",
    "cylinders", "age_bucket",
]
NUM_FEATURES = [
    "kms", "vehicle_age", "kms_per_year", "horsepower_mid", "engine_cc_mid",
]
TARGET = "log_price"
ALL_FEATURES = CAT_FEATURES + NUM_FEATURES

STAGE2_BASE_FEATURES = [
    "brand", "model", "vehicle_age", "kms_per_year",
    "horsepower_mid", "engine_cc_mid",
    "fuel_type", "body_type", "regional_specs", "trim",
]
STAGE2_CAT_FEATURES = [
    "brand", "model", "fuel_type", "body_type", "regional_specs", "trim",
]

TAUS = [0.05, 0.08, 0.10, 0.12, 0.15, 0.20, 0.25, 0.30]


# helpers

def sigmoid(x):
    return 1 / (1 + np.exp(-np.clip(x, -500, 500)))


def medape(y_true, y_pred):
    return float(np.median(np.abs((y_true - y_pred) / np.maximum(y_true, 1.0))) * 100)


def compute_metrics(y_true_log, y_pred_log):
    y_true_price = np.expm1(y_true_log)
    y_pred_price = np.maximum(np.expm1(y_pred_log), 0)
    return {
        "RMSE_log":   float(np.sqrt(mean_squared_error(y_true_log, y_pred_log))),
        "MAE_log":    float(mean_absolute_error(y_true_log, y_pred_log)),
        "R2_log":     float(r2_score(y_true_log, y_pred_log)),
        "MAE_price":  float(mean_absolute_error(y_true_price, y_pred_price)),
        "RMSE_price": float(np.sqrt(mean_squared_error(y_true_price, y_pred_price))),
        "R2_price":   float(r2_score(y_true_price, y_pred_price)),
        "MedAPE":     medape(y_true_price, y_pred_price),
    }


def compute_segment_metrics(y_true_log, y_pred_log):
    y_true_price = np.expm1(y_true_log)
    segments = {}
    masks = {
        "budget_<200k":  y_true_price <= 200_000,
        "mid_200k-800k": (y_true_price > 200_000) & (y_true_price <= LUX_THRESHOLD),
        "luxury_>800k":  y_true_price > LUX_THRESHOLD,
    }
    for name, mask in masks.items():
        n = int(mask.sum())
        if n < 10:
            segments[name] = {"n": n, "skipped": True}
            continue
        m = compute_metrics(y_true_log[mask], y_pred_log[mask])
        m["n"] = n
        segments[name] = m
    return segments


def print_comparison(results: dict):
    print(f"\n{'='*110}")
    print(f"{'Model':<40} {'MAE(AED)':>12} {'RMSE(AED)':>12} {'MedAPE%':>9} {'R2(log)':>9} {'R2(price)':>10}")
    print("-" * 110)
    for name, data in results.items():
        m = data["overall"]
        print(f"{name:<40} {m['MAE_price']:>12,.0f} {m['RMSE_price']:>12,.0f} "
              f"{m['MedAPE']:>9.2f} {m['R2_log']:>9.4f} {m['R2_price']:>10.4f}")

    for seg in ["budget_<200k", "mid_200k-800k", "luxury_>800k"]:
        print(f"\n  segment: {seg}")
        print(f"{'Model':<40} {'n':>6} {'MAE(AED)':>12} {'MedAPE%':>9} {'R2(price)':>10}")
        print("-" * 80)
        for name, data in results.items():
            s = data.get("segments", {}).get(seg, {})
            if s.get("skipped") or not s:
                continue
            print(f"{name:<40} {s['n']:>6} {s['MAE_price']:>12,.0f} "
                  f"{s['MedAPE']:>9.2f} {s['R2_price']:>10.4f}")


# data loading

def load_data():
    train_df = pd.read_csv(TRAIN_PATH)
    test_df  = pd.read_csv(TEST_PATH)

    for col in CAT_FEATURES:
        train_df[col] = train_df[col].astype("category")
        test_df[col]  = test_df[col].astype("category")

    for col in NUM_FEATURES + [TARGET]:
        train_df[col] = pd.to_numeric(train_df[col], errors="coerce")
        test_df[col]  = pd.to_numeric(test_df[col], errors="coerce")

    for col in NUM_FEATURES:
        med = train_df[col].median()
        train_df[col] = train_df[col].fillna(med)
        test_df[col]  = test_df[col].fillna(med)

    train_df = train_df.dropna(subset=[TARGET])
    test_df  = test_df.dropna(subset=[TARGET])

    return train_df, test_df


# stage 1: point + quantile models

def get_lgb_params(objective, alpha=None):
    params = dict(
        n_estimators=5000,
        learning_rate=0.05,
        max_depth=8,
        num_leaves=127,
        min_child_samples=20,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=RANDOM_SEED,
        verbose=-1,
        n_jobs=-1,
    )
    if objective == "quantile":
        params["objective"] = "quantile"
        params["alpha"] = alpha
        params["metric"] = "quantile"
    else:
        params["objective"] = "regression"
        params["metric"] = "rmse"
    return params


def train_stage1(train_df, test_df):
    X_train = train_df[ALL_FEATURES]
    y_train = train_df[TARGET]
    X_test  = test_df[ALL_FEATURES]

    kf = KFold(n_splits=N_FOLDS, shuffle=True, random_state=RANDOM_SEED)

    callbacks = [
        lgb.early_stopping(EARLY_STOPPING, verbose=False),
        lgb.log_evaluation(period=0),
    ]

    models_config = {
        "point": get_lgb_params("regression"),
        "q05":   get_lgb_params("quantile", alpha=0.05),
        "q95":   get_lgb_params("quantile", alpha=0.95),
    }

    oof_preds = {k: np.zeros(len(X_train)) for k in models_config}
    best_iters = {k: [] for k in models_config}

    print(f"  Training 5-fold CV on {len(X_train):,} samples (3 models per fold)...")
    t0 = time.time()

    for fold, (tr_idx, va_idx) in enumerate(kf.split(X_train), 1):
        X_tr, X_va = X_train.iloc[tr_idx], X_train.iloc[va_idx]
        y_tr, y_va = y_train.iloc[tr_idx], y_train.iloc[va_idx]

        for name, params in models_config.items():
            model = lgb.LGBMRegressor(**params)
            model.fit(
                X_tr, y_tr,
                eval_set=[(X_va, y_va)],
                callbacks=callbacks,
                categorical_feature=CAT_FEATURES,
            )
            oof_preds[name][va_idx] = model.predict(X_va)
            best_iters[name].append(model.best_iteration_)

        print(f"    Fold {fold} done")

    elapsed = time.time() - t0
    print(f"  CV done in {elapsed:.0f}s")

    # guard against quantile crossing
    cross_mask = oof_preds["q05"] > oof_preds["q95"]
    if cross_mask.any():
        print(f"  Warning: {cross_mask.sum()} quantile crossings in OOF, swapping bounds")
        q05_tmp = np.minimum(oof_preds["q05"], oof_preds["q95"])
        oof_preds["q95"] = np.maximum(oof_preds["q05"], oof_preds["q95"])
        oof_preds["q05"] = q05_tmp

    # train final models on full train_df using median best iteration from CV
    print(f"  Training final Stage 1 models on full training set...")
    final_models = {}
    for name, params in models_config.items():
        median_iter = int(np.median(best_iters[name]))
        print(f"    {name}: median best_iter={median_iter}")
        m = lgb.LGBMRegressor(**{**params, "n_estimators": median_iter})
        m.fit(X_train, y_train, categorical_feature=CAT_FEATURES)
        final_models[name] = m

    test_preds = {}
    for name in models_config:
        test_preds[name] = final_models[name].predict(X_test)

    # derive sigma from quantile spread
    oof_sigma = (oof_preds["q95"] - oof_preds["q05"]) / (2 * 1.645)
    test_sigma = (test_preds["q95"] - test_preds["q05"]) / (2 * 1.645)

    # floor sigma at 0.08 (same as CatBoost production)
    oof_sigma = np.maximum(oof_sigma, 0.08)
    test_sigma = np.maximum(test_sigma, 0.08)

    # stage 1 only metrics
    y_test = test_df[TARGET].values
    s1_metrics = compute_metrics(y_test, test_preds["point"])
    s1_segments = compute_segment_metrics(y_test, test_preds["point"])

    print(f"  Stage 1: MAE={s1_metrics['MAE_price']:,.0f}  "
          f"MedAPE={s1_metrics['MedAPE']:.2f}%  R2(log)={s1_metrics['R2_log']:.4f}")

    return (final_models, oof_preds, test_preds,
            oof_sigma, test_sigma, s1_metrics, s1_segments)


# stage 2: luxury residual correction

def prepare_stage2_data(train_df, oof_mu, oof_sigma):
    df = train_df.copy()
    df["mu_log_stage1"] = oof_mu
    df["sigma_log_stage1"] = oof_sigma
    df["price_original"] = np.expm1(df[TARGET])
    df["residual_log"] = df[TARGET] - df["mu_log_stage1"]

    for col in STAGE2_CAT_FEATURES:
        df[col] = df[col].astype(str).replace("nan", "Unknown").fillna("Unknown").astype("category")

    lux_mask = df["price_original"] > LUX_THRESHOLD
    lux_df = df[lux_mask].copy()

    stage2_features = STAGE2_BASE_FEATURES + ["mu_log_stage1", "sigma_log_stage1"]

    print(f"  Luxury cars: {len(lux_df):,} ({len(lux_df)/len(df)*100:.1f}%)")
    print(f"  Residual stats: mean={lux_df['residual_log'].mean():.4f}, "
          f"std={lux_df['residual_log'].std():.4f}")

    return lux_df, stage2_features


def train_stage2(lux_df, stage2_features):
    X_s2 = lux_df[stage2_features]
    y_s2 = lux_df["residual_log"]
    groups = (lux_df["brand"].astype(str) + "_" + lux_df["model"].astype(str)).values

    gkf = GroupKFold(n_splits=N_FOLDS)
    tau_scores = {t: [] for t in TAUS}
    best_iters = []

    print(f"\n  Stage 2 GroupKFold TAU tuning...")

    for fold, (tr_idx, va_idx) in enumerate(gkf.split(X_s2, y_s2, groups), 1):
        Xtr, Xva = X_s2.iloc[tr_idx], X_s2.iloc[va_idx]
        ytr, yva = y_s2.iloc[tr_idx], y_s2.iloc[va_idx]

        m2 = lgb.LGBMRegressor(
            objective="regression", metric="rmse",
            n_estimators=5000, learning_rate=0.05,
            max_depth=5, num_leaves=31, min_child_samples=10,
            subsample=0.8, colsample_bytree=0.8, reg_lambda=10.0,
            random_state=RANDOM_SEED, verbose=-1, n_jobs=-1,
        )
        m2.fit(
            Xtr, ytr,
            eval_set=[(Xva, yva)],
            callbacks=[lgb.early_stopping(200, verbose=False), lgb.log_evaluation(0)],
            categorical_feature=STAGE2_CAT_FEATURES,
        )
        best_iters.append(m2.best_iteration_)

        mu1 = lux_df.iloc[va_idx]["mu_log_stage1"].values
        true_price = lux_df.iloc[va_idx]["price_original"].values
        delta = m2.predict(Xva)

        for tau in TAUS:
            w = sigmoid((mu1 - np.log1p(LUX_THRESHOLD)) / tau)
            final_log = mu1 + w * delta
            pred_price = np.maximum(np.expm1(final_log), 0)
            mape = np.median(np.abs((true_price - pred_price) / np.maximum(true_price, 1))) * 100
            mae = mean_absolute_error(true_price, pred_price)
            tau_scores[tau].append((mape, mae))

    # pick best TAU
    tau_summary = []
    for t in TAUS:
        mean_medape = np.mean([x[0] for x in tau_scores[t]])
        mean_mae = np.mean([x[1] for x in tau_scores[t]])
        tau_summary.append((t, mean_medape, mean_mae))

    tau_summary.sort(key=lambda x: x[1])
    best_tau = tau_summary[0][0]
    median_iters = int(np.median(best_iters))

    print(f"  TAU tuning results:")
    for t, mape, mae in tau_summary:
        marker = " <-- best" if t == best_tau else ""
        print(f"    TAU={t:.2f}: MedAPE={mape:.2f}%  MAE={mae:,.0f}{marker}")

    # train final stage 2 on all luxury data
    print(f"  Training final Stage 2 (iters={median_iters}, TAU={best_tau})...")
    final_s2 = lgb.LGBMRegressor(
        objective="regression", metric="rmse",
        n_estimators=median_iters, learning_rate=0.05,
        max_depth=5, num_leaves=31, min_child_samples=10,
        subsample=0.8, colsample_bytree=0.8, reg_lambda=10.0,
        random_state=RANDOM_SEED, verbose=-1, n_jobs=-1,
    )
    final_s2.fit(X_s2, y_s2, categorical_feature=STAGE2_CAT_FEATURES)

    return final_s2, best_tau, median_iters, stage2_features


def predict_two_stage(mu_log, q05_log, q95_log, sigma_log,
                      df_rows, stage2_model, stage2_features, tau):
    w = sigmoid((mu_log - np.log1p(LUX_THRESHOLD)) / tau)

    # prepare stage 2 input
    X2 = df_rows[STAGE2_BASE_FEATURES].copy()
    for col in STAGE2_CAT_FEATURES:
        if col in X2.columns:
            X2[col] = X2[col].astype(str).replace("nan", "Unknown").fillna("Unknown").astype("category")
    X2["mu_log_stage1"] = mu_log
    X2["sigma_log_stage1"] = sigma_log

    delta = stage2_model.predict(X2[stage2_features])

    final_log = mu_log + w * delta
    q05_final = q05_log + w * delta
    q95_final = q95_log + w * delta

    return final_log, q05_final, q95_final, w, delta


# CQR conformal calibration (Romano et al. 2019) -- OOF-based variant

def calibrate_cqr(q_low_final, q_high_final, y_true_log, alpha=0.10):
    n_cal = len(y_true_log)
    scores = np.maximum(q_low_final - y_true_log, y_true_log - q_high_final)

    index = int(np.ceil((1 - alpha) * (n_cal + 1))) - 1
    index = min(index, n_cal - 1)

    scores_sorted = np.sort(scores)
    Q = float(scores_sorted[index])

    q_low_adj = q_low_final - Q
    q_high_adj = q_high_final + Q
    oof_coverage = float(np.mean((y_true_log >= q_low_adj) & (y_true_log <= q_high_adj)))

    # per-segment diagnostic for Stage 2 bias detection
    y_price = np.expm1(y_true_log)
    lux_mask = y_price > LUX_THRESHOLD
    non_lux_mask = ~lux_mask

    cov_lux = float(np.mean((y_true_log[lux_mask] >= q_low_adj[lux_mask]) &
                            (y_true_log[lux_mask] <= q_high_adj[lux_mask]))) if lux_mask.sum() > 0 else 0.0
    cov_non_lux = float(np.mean((y_true_log[non_lux_mask] >= q_low_adj[non_lux_mask]) &
                                (y_true_log[non_lux_mask] <= q_high_adj[non_lux_mask])))

    print(f"  CQR calibration (OOF-based):")
    print(f"    OOF samples: {n_cal:,}")
    print(f"    Conformal Q: {Q:.6f}")
    if Q < 0:
        print(f"    Q is negative: raw quantiles overcover, CQR tightens intervals")
    print(f"    OOF coverage: {oof_coverage*100:.2f}% (target: {(1-alpha)*100:.0f}%)")
    print(f"    OOF coverage luxury: {cov_lux*100:.2f}% ({lux_mask.sum():,} cars)")
    print(f"    OOF coverage non-luxury: {cov_non_lux*100:.2f}% ({non_lux_mask.sum():,} cars)")

    return Q, oof_coverage, cov_lux, cov_non_lux


# evaluation

def evaluate_test(test_df, test_preds, test_sigma, stage2_model,
                  stage2_features, tau, Q):
    y_test = test_df[TARGET].values

    mu_test = test_preds["point"]
    q05_test = test_preds["q05"]
    q95_test = test_preds["q95"]

    # stage 1 only metrics
    s1_metrics = compute_metrics(y_test, mu_test)
    s1_segments = compute_segment_metrics(y_test, mu_test)

    # two-stage predictions
    final_log, q05_final, q95_final, gate_w, _ = predict_two_stage(
        mu_test, q05_test, q95_test, test_sigma,
        test_df, stage2_model, stage2_features, tau,
    )

    ts_metrics = compute_metrics(y_test, final_log)
    ts_segments = compute_segment_metrics(y_test, final_log)

    # CQR-adjusted intervals
    q05_cqr = q05_final - Q
    q95_cqr = q95_final + Q

    # back-transform intervals to price space
    price_low_cqr = np.maximum(np.expm1(q05_cqr), 0)
    price_high_cqr = np.maximum(np.expm1(q95_cqr), 0)
    y_true_price = np.expm1(y_test)

    # coverage
    coverage_log = float(np.mean((y_test >= q05_cqr) & (y_test <= q95_cqr)))
    coverage_price = float(np.mean((y_true_price >= price_low_cqr) & (y_true_price <= price_high_cqr)))

    # interval widths in price space
    interval_widths = price_high_cqr - price_low_cqr

    # sigma derived from CQR-adjusted intervals, with luxury inflation
    sigma_cqr = (q95_cqr - q05_cqr) / (2 * 1.645)
    sigma_adj = sigma_cqr * (1 + BETA * gate_w)

    cqr_metrics = {
        "coverage_90pct": coverage_log * 100,
        "coverage_90pct_price": coverage_price * 100,
        "mean_interval_width_aed": float(np.mean(interval_widths)),
        "median_interval_width_aed": float(np.median(interval_widths)),
        "mean_sigma_log": float(np.mean(sigma_adj)),
        "median_sigma_log": float(np.median(sigma_adj)),
    }

    print(f"\n{'='*80}")
    print(f"STAGE 1 ONLY vs TWO-STAGE vs TWO-STAGE+CQR")
    print(f"{'='*80}")
    print(f"{'Metric':<25} {'Stage 1':>15} {'Two-Stage':>15} {'Improvement':>15}")
    print("-" * 70)
    for key in ["MAE_price", "RMSE_price", "R2_price", "MedAPE", "R2_log"]:
        s1v = s1_metrics[key]
        tsv = ts_metrics[key]
        diff = s1v - tsv if key != "R2_price" and key != "R2_log" else tsv - s1v
        fmt = ",.0f" if "price" in key.lower() and key != "R2_price" else ".4f"
        if key == "MedAPE":
            fmt = ".2f"
        print(f"  {key:<23} {s1v:>15{fmt}} {tsv:>15{fmt}} {diff:>+15{fmt}}")

    print(f"\n  CQR coverage (90% target):")
    print(f"    Log-space:   {cqr_metrics['coverage_90pct']:.2f}%")
    print(f"    Price-space: {cqr_metrics['coverage_90pct_price']:.2f}%")
    print(f"    Mean interval width: {cqr_metrics['mean_interval_width_aed']:,.0f} AED")
    print(f"    Median interval width: {cqr_metrics['median_interval_width_aed']:,.0f} AED")

    print(f"\n  Gate stats: mean={np.mean(gate_w):.3f}, "
          f"luxury-like (>0.5): {np.sum(gate_w > 0.5):,} ({np.mean(gate_w > 0.5)*100:.1f}%)")

    # luxury subset
    lux_mask = y_true_price > LUX_THRESHOLD
    if lux_mask.sum() > 10:
        lux_true = y_true_price[lux_mask]
        lux_s1 = np.expm1(mu_test[lux_mask])
        lux_ts = np.expm1(final_log[lux_mask])
        print(f"\n  Luxury ({lux_mask.sum():,} cars):")
        print(f"    MAE Stage 1:   {mean_absolute_error(lux_true, lux_s1):,.0f} AED")
        print(f"    MAE Two-Stage: {mean_absolute_error(lux_true, lux_ts):,.0f} AED")
        print(f"    MedAPE Stage 1:   {medape(lux_true, lux_s1):.2f}%")
        print(f"    MedAPE Two-Stage: {medape(lux_true, lux_ts):.2f}%")

    # head-to-head vs CatBoost
    print(f"\n{'='*80}")
    print(f"HEAD-TO-HEAD: CatBoost Two-Stage vs LightGBM+CQR Two-Stage")
    print(f"{'='*80}")
    print(f"{'Metric':<25} {'CatBoost':>15} {'LightGBM+CQR':>15} {'Delta':>15}")
    print("-" * 70)

    catboost = {"MAE": 42580, "MedAPE": 12.43, "R2_price": 0.8745, "Coverage_90": 91.41}

    comparisons = [
        ("MAE (AED)", catboost["MAE"], ts_metrics["MAE_price"], ",.0f"),
        ("MedAPE (%)", catboost["MedAPE"], ts_metrics["MedAPE"], ".2f"),
        ("R2 (price)", catboost["R2_price"], ts_metrics["R2_price"], ".4f"),
        ("Coverage 90%", catboost["Coverage_90"], cqr_metrics["coverage_90pct"], ".2f"),
    ]
    for label, cb_val, lgb_val, fmt in comparisons:
        delta = lgb_val - cb_val
        print(f"  {label:<23} {cb_val:>15{fmt}} {lgb_val:>15{fmt}} {delta:>+15{fmt}}")

    # three-way comparison including holdout variant
    holdout = {"MAE": 39631, "MedAPE": 9.65, "R2_price": 0.7722, "Coverage_90": 89.72}

    print(f"\n{'='*80}")
    print(f"THREE-WAY COMPARISON")
    print(f"{'='*80}")
    print(f"{'Metric':<20} {'CatBoost':>15} {'LGB+CQR hold':>15} {'LGB+CQR nohold':>15}")
    print("-" * 65)

    rows = [
        ("MAE (AED)", catboost["MAE"], holdout["MAE"], ts_metrics["MAE_price"], ",.0f"),
        ("MedAPE (%)", catboost["MedAPE"], holdout["MedAPE"], ts_metrics["MedAPE"], ".2f"),
        ("R2 (price)", catboost["R2_price"], holdout["R2_price"], ts_metrics["R2_price"], ".4f"),
        ("Coverage 90%", catboost["Coverage_90"], holdout["Coverage_90"], cqr_metrics["coverage_90pct"], ".2f"),
    ]
    for label, cb, ho, nh, fmt in rows:
        print(f"  {label:<18} {cb:>15{fmt}} {ho:>15{fmt}} {nh:>15{fmt}}")

    return (s1_metrics, s1_segments, ts_metrics, ts_segments, cqr_metrics,
            final_log, q05_cqr, q95_cqr, gate_w, sigma_adj, price_low_cqr, price_high_cqr)


# save artifacts

def save_artifacts(final_models, stage2_model, stage2_features, tau, median_iters,
                   Q, oof_coverage, cov_lux, cov_non_lux, n_oof,
                   s1_metrics, s1_segments, ts_metrics, ts_segments,
                   cqr_metrics, test_df, final_log, q05_cqr, q95_cqr,
                   gate_w, sigma_adj, price_low_cqr, price_high_cqr):

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    y_test = test_df[TARGET].values

    # save models
    final_models["point"].booster_.save_model(str(OUTPUT_DIR / "lightgbm_cqr_noholdout_stage1.txt"))
    final_models["q05"].booster_.save_model(str(OUTPUT_DIR / "lightgbm_cqr_noholdout_q05.txt"))
    final_models["q95"].booster_.save_model(str(OUTPUT_DIR / "lightgbm_cqr_noholdout_q95.txt"))
    stage2_model.booster_.save_model(str(OUTPUT_DIR / "lightgbm_cqr_noholdout_stage2.txt"))

    print(f"\n  Models saved to {OUTPUT_DIR}/")

    cqr_metrics["oof_coverage_luxury"] = cov_lux
    cqr_metrics["oof_coverage_non_luxury"] = cov_non_lux

    cal_info = {
        "calibration_method": "CV-based CQR (cross-conformal, Barber et al. 2021)",
        "conformal_Q": Q,
        "nominal_coverage": 0.90,
        "oof_samples": n_oof,
        "oof_coverage": oof_coverage,
        "quantile_alpha_low": 0.05,
        "quantile_alpha_high": 0.95,
        "stage2_config": {
            "luxury_threshold_aed": LUX_THRESHOLD,
            "sigmoid_tau": tau,
            "sigma_inflation_beta": BETA,
            "stage2_features": stage2_features,
            "median_iterations": median_iters,
        },
        "stage1_only_metrics": s1_metrics,
        "twostage_metrics": ts_metrics,
        "cqr_metrics": cqr_metrics,
        "comparison_vs_catboost": {
            "catboost_MAE": 42580,
            "catboost_MedAPE": 12.43,
            "catboost_R2_price": 0.8745,
            "catboost_coverage_90": 91.41,
        },
        "comparison_vs_holdout": {
            "holdout_MAE": 39631,
            "holdout_MedAPE": 9.65,
            "holdout_R2_price": 0.7722,
            "holdout_coverage_90": 89.72,
        },
    }

    cal_path = OUTPUT_DIR / "lightgbm_cqr_noholdout_calibration.json"
    with open(cal_path, "w") as f:
        json.dump(cal_info, f, indent=2, default=str)
    print(f"  Calibration info saved to {cal_path}")

    # test predictions CSV
    y_true_price = np.expm1(y_test)
    pred_price = np.maximum(np.expm1(final_log), 0)

    results_df = pd.DataFrame({
        "true_log_price": y_test,
        "pred_log_price": final_log,
        "true_price": y_true_price,
        "pred_price": pred_price,
        "gate_weight": gate_w,
        "sigma_log_adjusted": sigma_adj,
        "q05_cqr_log": q05_cqr,
        "q95_cqr_log": q95_cqr,
        "pred_low_90": price_low_cqr,
        "pred_high_90": price_high_cqr,
    })

    out_csv = OUTPUT_DIR / "test_predictions_lgbm_cqr_noholdout.csv"
    results_with_features = pd.concat(
        [test_df.reset_index(drop=True), results_df.reset_index(drop=True)], axis=1,
    )
    results_with_features.to_csv(out_csv, index=False)
    print(f"  Predictions saved to {out_csv} ({len(results_with_features)} rows)")


def main():
    print("=" * 80)
    print("LightGBM Two-Stage + CQR -- No Holdout (OOF-based calibration)")
    print("=" * 80)

    print("\n[1/5] Loading data...")
    train_df, test_df = load_data()
    print(f"  Train: {len(train_df):,}  Test: {len(test_df):,}")

    print("\n[2/5] Stage 1: LightGBM point + quantile models...")
    (final_models, oof_preds, test_preds,
     oof_sigma, test_sigma,
     s1_metrics, s1_segments) = train_stage1(train_df, test_df)

    print("\n[3/5] Stage 2: Luxury residual correction...")
    lux_df, stage2_features = prepare_stage2_data(
        train_df, oof_preds["point"], oof_sigma,
    )
    stage2_model, best_tau, median_iters, stage2_features = train_stage2(
        lux_df, stage2_features,
    )

    print("\n[4/5] CQR conformal calibration (OOF-based)...")
    oof_final_log, oof_q05_final, oof_q95_final, oof_w, _ = predict_two_stage(
        oof_preds["point"], oof_preds["q05"], oof_preds["q95"], oof_sigma,
        train_df, stage2_model, stage2_features, best_tau,
    )

    Q, oof_coverage, cov_lux, cov_non_lux = calibrate_cqr(
        oof_q05_final, oof_q95_final, train_df[TARGET].values, alpha=0.10,
    )

    print("\n[5/5] Test evaluation...")
    (s1_metrics, s1_segments, ts_metrics, ts_segments, cqr_metrics,
     final_log, q05_cqr, q95_cqr, gate_w, sigma_adj,
     price_low_cqr, price_high_cqr) = evaluate_test(
        test_df, test_preds, test_sigma, stage2_model, stage2_features, best_tau, Q,
    )

    print("\nSaving artifacts...")
    save_artifacts(
        final_models, stage2_model, stage2_features, best_tau, median_iters,
        Q, oof_coverage, cov_lux, cov_non_lux, len(train_df),
        s1_metrics, s1_segments, ts_metrics, ts_segments,
        cqr_metrics, test_df, final_log, q05_cqr, q95_cqr,
        gate_w, sigma_adj, price_low_cqr, price_high_cqr,
    )

    print(f"\n{'='*80}")
    print("DONE")
    print(f"{'='*80}")


if __name__ == "__main__":
    main()
