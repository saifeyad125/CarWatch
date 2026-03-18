"""
LightGBM two-stage training. Tests if a Stage 2 residual model helps luxury listings.
"""

import json
import time
import warnings
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.model_selection import KFold, GroupKFold
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

import lightgbm as lgb
from catboost import CatBoostRegressor
import xgboost as xgb

warnings.filterwarnings("ignore")

# CONFIG
PROJECT_ROOT = Path(__file__).parent.parent
TRAIN_PATH = PROJECT_ROOT / "ai_training" / "datasets" / "train2.csv"
TEST_PATH  = PROJECT_ROOT / "ai_training" / "datasets" / "test2.csv"
OUTPUT_DIR = PROJECT_ROOT / "ai_training" / "outputs"

N_FOLDS = 5
RANDOM_SEED = 42
EARLY_STOPPING = 100
LUX_THRESHOLD = 800_000

CAT_FEATURES = [
    "brand", "model", "trim", "fuel_type", "body_type",
    "steering_side", "regional_specs", "doors", "seating_capacity",
    "cylinders", "age_bucket"
]
NUM_FEATURES = [
    "kms", "vehicle_age", "kms_per_year", "horsepower_mid", "engine_cc_mid"
]
TARGET = "log_price"
ALL_FEATURES = CAT_FEATURES + NUM_FEATURES

STAGE2_BASE_FEATURES = [
    "brand", "model", "vehicle_age", "kms_per_year",
    "horsepower_mid", "engine_cc_mid",
    "fuel_type", "body_type", "regional_specs", "trim"
]
STAGE2_CAT_FEATURES = ["brand", "model", "fuel_type", "body_type", "regional_specs", "trim"]

TAUS = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30]


# HELPERS

def sigmoid(x):
    return 1 / (1 + np.exp(-np.clip(x, -500, 500)))


def medape(y_true, y_pred):
    return float(np.median(np.abs((y_true - y_pred) / np.maximum(y_true, 1.0))) * 100)


def compute_metrics(y_true_log, y_pred_log):
    y_true_price = np.expm1(y_true_log)
    y_pred_price = np.maximum(np.expm1(y_pred_log), 0)
    return {
        "RMSE_log":   float(np.sqrt(mean_squared_error(y_true_log, y_pred_log))),
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
    print(f"{'FULL COMPARISON':^110}")
    print(f"{'='*110}")
    print(f"{'Model':<40} {'MAE(AED)':>12} {'RMSE(AED)':>12} {'MedAPE%':>9} {'R²(log)':>9} {'R²(price)':>10}")
    print("-" * 110)
    for name, data in results.items():
        m = data["overall"]
        print(f"{name:<40} {m['MAE_price']:>12,.0f} {m['RMSE_price']:>12,.0f} "
              f"{m['MedAPE']:>9.2f} {m['R2_log']:>9.4f} {m['R2_price']:>10.4f}")

    for seg in ["budget_<200k", "mid_200k-800k", "luxury_>800k"]:
        print(f"\n{'─'*110}")
        print(f"  SEGMENT: {seg.upper()}")
        print(f"{'─'*110}")
        print(f"{'Model':<40} {'n':>6} {'MAE(AED)':>12} {'MedAPE%':>9} {'R²(price)':>10}")
        print("-" * 80)
        for name, data in results.items():
            s = data.get("segments", {}).get(seg, {})
            if s.get("skipped") or not s:
                continue
            print(f"{name:<40} {s['n']:>6} {s['MAE_price']:>12,.0f} "
                  f"{s['MedAPE']:>9.2f} {s['R2_price']:>10.4f}")


# DATA

def load_data():
    train_df = pd.read_csv(TRAIN_PATH)
    test_df  = pd.read_csv(TEST_PATH)

    for col in CAT_FEATURES:
        train_df[col] = train_df[col].astype("category")
        test_df[col]  = test_df[col].astype("category")

    for col in NUM_FEATURES + [TARGET]:
        train_df[col] = pd.to_numeric(train_df[col], errors="coerce")
        test_df[col]  = pd.to_numeric(test_df[col], errors="coerce")

    # Fill numeric NaN with train median
    for col in NUM_FEATURES:
        med = train_df[col].median()
        train_df[col] = train_df[col].fillna(med)
        test_df[col]  = test_df[col].fillna(med)

    train_df = train_df.dropna(subset=[TARGET])
    test_df  = test_df.dropna(subset=[TARGET])

    return train_df, test_df


# STAGE 1: LightGBM

def train_stage1(train_df, test_df):

    X_train = train_df[ALL_FEATURES]
    y_train = train_df[TARGET]
    X_test  = test_df[ALL_FEATURES]
    y_test  = test_df[TARGET]

    kf = KFold(n_splits=N_FOLDS, shuffle=True, random_state=RANDOM_SEED)

    oof_preds = np.zeros(len(X_train))
    test_preds = np.zeros(len(X_test))

    params = dict(
        objective="regression",
        metric="rmse",
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

    callbacks = [
        lgb.early_stopping(EARLY_STOPPING, verbose=False),
        lgb.log_evaluation(period=0),
    ]

    print(f"  Training 5-fold CV on {len(X_train):,} samples...")
    t0 = time.time()

    for fold, (tr_idx, va_idx) in enumerate(kf.split(X_train)):
        X_tr, X_va = X_train.iloc[tr_idx], X_train.iloc[va_idx]
        y_tr, y_va = y_train.iloc[tr_idx], y_train.iloc[va_idx]

        model = lgb.LGBMRegressor(**params)
        model.fit(
            X_tr, y_tr,
            eval_set=[(X_va, y_va)],
            callbacks=callbacks,
            categorical_feature=CAT_FEATURES,
        )
        oof_preds[va_idx] = model.predict(X_va)
        test_preds += model.predict(X_test) / N_FOLDS

    elapsed = time.time() - t0
    print(f"  CV done in {elapsed:.0f}s")

    # Evaluate Stage 1 only
    s1_metrics = compute_metrics(y_test.values, test_preds)
    s1_segments = compute_segment_metrics(y_test.values, test_preds)

    print(f"  Stage 1 results: MAE={s1_metrics['MAE_price']:,.0f}  "
          f"MedAPE={s1_metrics['MedAPE']:.2f}%  R²(log)={s1_metrics['R2_log']:.4f}  "
          f"R²(price)={s1_metrics['R2_price']:.4f}")

    # Train final model on full training set
    print(f"  Training final Stage 1 model on full training set...")
    final_model = lgb.LGBMRegressor(**params)
    # no val set, use conservative iter count
    final_model.set_params(n_estimators=3000)  # conservative, no val set
    final_model.fit(X_train, y_train, categorical_feature=CAT_FEATURES)

    return final_model, oof_preds, test_preds, s1_metrics, s1_segments


# STAGE 2: Luxury Residual Correction (test 3 algorithms)

def prepare_stage2_data(train_df, oof_preds):
    df = train_df.copy()
    df["mu_log_stage1"] = oof_preds
    df["price_original"] = np.expm1(df[TARGET])
    df["residual_log"] = df[TARGET] - df["mu_log_stage1"]

    # LightGBM needs category dtype
    for col in STAGE2_CAT_FEATURES:
        df[col] = df[col].astype(str).replace("nan", "Unknown").fillna("Unknown").astype("category")

    lux_mask = df["price_original"] > LUX_THRESHOLD
    lux_df = df[lux_mask].copy()

    stage2_features = STAGE2_BASE_FEATURES + ["mu_log_stage1"]

    print(f"  Luxury cars: {len(lux_df):,} ({len(lux_df)/len(df)*100:.1f}%)")
    print(f"  Residual stats: mean={lux_df['residual_log'].mean():.4f}, "
          f"std={lux_df['residual_log'].std():.4f}")

    return lux_df, stage2_features


def train_stage2_lightgbm(X_tr, y_tr, X_va, y_va):
    params = dict(
        objective="regression", metric="rmse",
        n_estimators=5000, learning_rate=0.05,
        max_depth=5, num_leaves=31,
        min_child_samples=10, subsample=0.8, colsample_bytree=0.8,
        reg_lambda=10.0,
        random_state=RANDOM_SEED, verbose=-1, n_jobs=-1,
    )
    model = lgb.LGBMRegressor(**params)
    model.fit(
        X_tr, y_tr,
        eval_set=[(X_va, y_va)],
        callbacks=[lgb.early_stopping(200, verbose=False), lgb.log_evaluation(0)],
        categorical_feature=STAGE2_CAT_FEATURES,
    )
    return model, model.best_iteration_


def train_stage2_catboost(X_tr, y_tr, X_va, y_va):
    model = CatBoostRegressor(
        loss_function="RMSE", iterations=5000, depth=5,
        learning_rate=0.05, l2_leaf_reg=10,
        random_seed=RANDOM_SEED, verbose=0,
        early_stopping_rounds=200, allow_writing_files=False,
    )
    model.fit(X_tr, y_tr, cat_features=STAGE2_CAT_FEATURES,
              eval_set=(X_va, y_va), use_best_model=True)
    return model, model.get_best_iteration()


_xgb_label_maps = {}

def _label_encode_for_xgb(df, fit=False):
    global _xgb_label_maps
    df_enc = df.copy()
    for col in STAGE2_CAT_FEATURES:
        if col not in df_enc.columns:
            continue
        if fit:
            unique_vals = df_enc[col].astype(str).unique().tolist()
            _xgb_label_maps[col] = {v: i for i, v in enumerate(unique_vals)}
        mapping = _xgb_label_maps.get(col, {})
        fallback = len(mapping)
        df_enc[col] = df_enc[col].astype(str).map(mapping).fillna(fallback).astype(int)
    return df_enc


def train_stage2_xgboost(X_tr, y_tr, X_va, y_va):
    X_tr_enc = _label_encode_for_xgb(X_tr, fit=True)
    X_va_enc = _label_encode_for_xgb(X_va, fit=False)

    model = xgb.XGBRegressor(
        objective="reg:squarederror", eval_metric="rmse",
        n_estimators=5000, learning_rate=0.05,
        max_depth=5, subsample=0.8, colsample_bytree=0.8,
        reg_lambda=10.0, early_stopping_rounds=200,
        random_state=RANDOM_SEED, verbosity=0, tree_method="hist",
    )
    model.fit(X_tr_enc, y_tr, eval_set=[(X_va_enc, y_va)], verbose=False)
    return model, model.best_iteration


def evaluate_two_stage(s1_test_preds, stage2_model, test_df, stage2_features,
                       tau, algo_name, y_test_log):
    mu1 = s1_test_preds

    w = sigmoid((mu1 - np.log1p(LUX_THRESHOLD)) / tau)

    X2 = test_df[STAGE2_BASE_FEATURES].copy()
    for col in STAGE2_CAT_FEATURES:
        if col in X2.columns:
            X2[col] = X2[col].astype(str).replace("nan", "Unknown").fillna("Unknown").astype("category")
    X2["mu_log_stage1"] = mu1

    if algo_name == "XGBoost":
        X2 = _label_encode_for_xgb(X2, fit=False)

    delta = stage2_model.predict(X2[stage2_features])

    final_log = mu1 + w * delta

    overall = compute_metrics(y_test_log, final_log)
    segments = compute_segment_metrics(y_test_log, final_log)

    return final_log, overall, segments, w


def run_stage2_comparison(lux_df, stage2_features, s1_test_preds, test_df, y_test_log):

    X_s2 = lux_df[stage2_features]
    y_s2 = lux_df["residual_log"]
    groups = (lux_df["brand"].astype(str) + "_" + lux_df["model"].astype(str)).values

    gkf = GroupKFold(n_splits=5)

    algorithms = {
        "LightGBM":  train_stage2_lightgbm,
        "CatBoost":  train_stage2_catboost,
        "XGBoost":   train_stage2_xgboost,
    }

    results = {}

    for algo_name, train_fn in algorithms.items():
        print(f"\n  Stage 2: {algo_name}")
        t0 = time.time()

        tau_scores = {t: [] for t in TAUS}
        best_iters = []

        for fold, (tr_idx, va_idx) in enumerate(gkf.split(X_s2, y_s2, groups), 1):
            Xtr, Xva = X_s2.iloc[tr_idx], X_s2.iloc[va_idx]
            ytr, yva = y_s2.iloc[tr_idx], y_s2.iloc[va_idx]

            m2, best_iter = train_fn(Xtr, ytr, Xva, yva)
            best_iters.append(best_iter)

            mu1 = lux_df.iloc[va_idx]["mu_log_stage1"].values
            true_price = lux_df.iloc[va_idx]["price_original"].values

            if algo_name == "XGBoost":
                delta = m2.predict(_label_encode_for_xgb(Xva, fit=False))
            else:
                delta = m2.predict(Xva)

            for tau in TAUS:
                w = sigmoid((mu1 - np.log1p(LUX_THRESHOLD)) / tau)
                final_log = mu1 + w * delta
                pred_price = np.expm1(final_log)
                mae = mean_absolute_error(true_price, np.maximum(pred_price, 0))
                mape = np.median(np.abs((true_price - pred_price) / np.maximum(true_price, 1))) * 100
                tau_scores[tau].append((mape, mae))

        tau_summary = []
        for t in TAUS:
            mean_medape = np.mean([x[0] for x in tau_scores[t]])
            mean_mae = np.mean([x[1] for x in tau_scores[t]])
            tau_summary.append((t, mean_medape, mean_mae))

        tau_summary.sort(key=lambda x: x[1])
        best_tau = tau_summary[0][0]
        median_iters = int(np.median(best_iters))

        print(f"    TAU tuning results:")
        for t, mape, mae in tau_summary:
            marker = " <-- BEST" if t == best_tau else ""
            print(f"      TAU={t:.2f}: MedAPE={mape:.2f}%  MAE={mae:,.0f}{marker}")

        print(f"    Training final model (iters={median_iters})...")

        if algo_name == "LightGBM":
            final_s2 = lgb.LGBMRegressor(
                objective="regression", metric="rmse",
                n_estimators=median_iters, learning_rate=0.05,
                max_depth=5, num_leaves=31, min_child_samples=10,
                subsample=0.8, colsample_bytree=0.8, reg_lambda=10.0,
                random_state=RANDOM_SEED, verbose=-1, n_jobs=-1,
            )
            final_s2.fit(X_s2, y_s2, categorical_feature=STAGE2_CAT_FEATURES)

        elif algo_name == "CatBoost":
            final_s2 = CatBoostRegressor(
                loss_function="RMSE", iterations=median_iters, depth=5,
                learning_rate=0.05, l2_leaf_reg=10,
                random_seed=RANDOM_SEED, verbose=0, allow_writing_files=False,
            )
            final_s2.fit(X_s2, y_s2, cat_features=STAGE2_CAT_FEATURES)

        elif algo_name == "XGBoost":
            X_s2_enc = _label_encode_for_xgb(X_s2, fit=True)
            final_s2 = xgb.XGBRegressor(
                objective="reg:squarederror", n_estimators=median_iters,
                learning_rate=0.05, max_depth=5, subsample=0.8,
                colsample_bytree=0.8, reg_lambda=10.0,
                random_state=RANDOM_SEED, verbosity=0, tree_method="hist",
            )
            final_s2.fit(X_s2_enc, y_s2)

        final_log, overall, segments, gate_w = evaluate_two_stage(
            s1_test_preds, final_s2, test_df, stage2_features,
            best_tau, algo_name, y_test_log
        )

        elapsed = time.time() - t0
        print(f"    Test: MAE={overall['MAE_price']:,.0f}  MedAPE={overall['MedAPE']:.2f}%  "
              f"R²(price)={overall['R2_price']:.4f}  ({elapsed:.0f}s)")

        lux_seg = segments.get("luxury_>800k", {})
        if lux_seg and not lux_seg.get("skipped"):
            print(f"    Luxury: MAE={lux_seg['MAE_price']:,.0f}  MedAPE={lux_seg['MedAPE']:.2f}%  "
                  f"R²={lux_seg['R2_price']:.4f}")

        results[f"LightGBM+{algo_name}_Stage2"] = {
            "overall": overall,
            "segments": segments,
            "model": final_s2,
            "best_tau": best_tau,
            "algo": algo_name,
            "median_iters": median_iters,
            "gate_weights_mean": float(np.mean(gate_w)),
            "gate_weights_gt05": float(np.mean(gate_w > 0.5)),
        }

    return results




def main():
    print("=" * 110)
    print("LightGBM Two-Stage: Does Stage 2 help? Which algorithm for Stage 2?")
    print("=" * 110)

    # Load
    print("\n[1/4] Loading data...")
    train_df, test_df = load_data()
    y_test_log = test_df[TARGET].values
    print(f"  Train: {len(train_df):,}  Test: {len(test_df):,}")

    # Stage 1
    print("\n[2/4] Stage 1: LightGBM_RMSE...")
    final_s1, oof_preds, s1_test_preds, s1_metrics, s1_segments = train_stage1(train_df, test_df)

    # Stage 2
    print("\n[3/4] Stage 2: Luxury residual correction...")
    lux_df, stage2_features = prepare_stage2_data(train_df, oof_preds)
    s2_results = run_stage2_comparison(lux_df, stage2_features, s1_test_preds, test_df, y_test_log)

    # Combine all results
    all_results = {
        "LightGBM_Stage1_Only": {"overall": s1_metrics, "segments": s1_segments},
        **s2_results,
    }

    # Print full comparison
    print("\n[4/4] Results...")
    print_comparison(all_results)

    print(f"\n{'='*110}")
    print("DECISION")
    print(f"{'='*110}")

    s1_mae = s1_metrics["MAE_price"]
    s1_medape = s1_metrics["MedAPE"]
    s1_lux_mae = s1_segments.get("luxury_>800k", {}).get("MAE_price", float("inf"))

    best_s2_name = None
    best_s2_lux_mae = float("inf")

    for name, data in s2_results.items():
        lux = data.get("segments", {}).get("luxury_>800k", {})
        if lux and not lux.get("skipped") and lux["MAE_price"] < best_s2_lux_mae:
            best_s2_lux_mae = lux["MAE_price"]
            best_s2_name = name

    lux_improvement = (s1_lux_mae - best_s2_lux_mae) / s1_lux_mae * 100 if s1_lux_mae > 0 else 0
    best_s2_overall = s2_results[best_s2_name]["overall"] if best_s2_name else None
    medape_cost = (best_s2_overall["MedAPE"] - s1_medape) if best_s2_overall else 0

    print(f"\n  Stage 1 only luxury MAE:       {s1_lux_mae:>12,.0f} AED")
    if best_s2_name:
        print(f"  Best Stage 2 ({best_s2_name}):")
        print(f"    Luxury MAE:                  {best_s2_lux_mae:>12,.0f} AED  ({lux_improvement:+.1f}%)")
        print(f"    Overall MedAPE cost:          {medape_cost:+.2f}%")
        print(f"    TAU:                          {s2_results[best_s2_name]['best_tau']}")

    use_two_stage = lux_improvement > 5 and medape_cost < 0.5
    if use_two_stage:
        recommendation = "two_stage"
        rec_name = best_s2_name
        print(f"\n  RECOMMENDATION: USE TWO-STAGE ({best_s2_name})")
        print(f"  Luxury MAE improved by {lux_improvement:.1f}% with only {medape_cost:+.2f}% MedAPE cost")
    else:
        recommendation = "stage1_only"
        rec_name = "LightGBM_Stage1_Only"
        if lux_improvement <= 5:
            print(f"\n  RECOMMENDATION: STAGE 1 ONLY (luxury improvement only {lux_improvement:.1f}%, not worth complexity)")
        else:
            print(f"\n  RECOMMENDATION: STAGE 1 ONLY (MedAPE cost {medape_cost:+.2f}% too high)")

    print(f"\n{'─'*60}")
    print("Saving artifacts...")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Stage 1 model
    s1_path = OUTPUT_DIR / "lightgbm_stage1.txt"
    final_s1.booster_.save_model(str(s1_path))
    print(f"  Stage 1: {s1_path}")

    # Config
    config = {
        "model_type": recommendation,
        "stage1": {
            "algorithm": "LightGBM",
            "features": ALL_FEATURES,
            "cat_features": CAT_FEATURES,
            "num_features": NUM_FEATURES,
        },
        "stage1_only_metrics": s1_metrics,
        "stage1_only_segments": s1_segments,
    }

    if use_two_stage and best_s2_name:
        s2_data = s2_results[best_s2_name]
        s2_model = s2_data["model"]
        algo = s2_data["algo"]

        # Save Stage 2 model
        if algo == "LightGBM":
            s2_path = OUTPUT_DIR / "lightgbm_stage2_luxury.txt"
            s2_model.booster_.save_model(str(s2_path))
        elif algo == "CatBoost":
            s2_path = OUTPUT_DIR / "lightgbm_stage2_luxury.cbm"
            s2_model.save_model(str(s2_path))
        elif algo == "XGBoost":
            s2_path = OUTPUT_DIR / "lightgbm_stage2_luxury.json"
            s2_model.save_model(str(s2_path))

        print(f"  Stage 2: {s2_path}")

        config["stage2_config"] = {
            "algorithm": algo,
            "luxury_threshold_aed": LUX_THRESHOLD,
            "sigmoid_tau": s2_data["best_tau"],
            "stage2_features": stage2_features,
            "stage2_cat_features": STAGE2_CAT_FEATURES,
            "median_iterations": s2_data["median_iters"],
        }
        config["twostage_metrics"] = s2_data["overall"]
        config["twostage_segments"] = s2_data["segments"]

    config["recommendation"] = recommendation

    config_path = OUTPUT_DIR / "lightgbm_config.json"
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2, default=str)
    print(f"  Config: {config_path}")

    # Reference: production baseline
    print(f"\n  Production baseline: MAE=42,580  MedAPE=12.43%  R²(price)=0.8745")
    print(f"\n{'='*110}")
    print("DONE")
    print(f"{'='*110}")


if __name__ == "__main__":
    main()
