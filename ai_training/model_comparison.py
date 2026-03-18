"""
CatBoost vs LightGBM vs XGBoost comparison with ensemble methods.
Uses 4 loss functions (RMSE, MAE, Huber, Tweedie) per framework.
"""

import os
import json
import warnings
import time
import numpy as np
import pandas as pd
from pathlib import Path
from scipy.optimize import minimize_scalar
from sklearn.model_selection import KFold
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from catboost import CatBoostRegressor
import lightgbm as lgb
import xgboost as xgb

warnings.filterwarnings("ignore")

# config
PROJECT_ROOT = Path(__file__).parent.parent
TRAIN_PATH = PROJECT_ROOT / "ai_training" / "datasets" / "train2.csv"
TEST_PATH  = PROJECT_ROOT / "ai_training" / "datasets" / "test2.csv"
OUTPUT_DIR = PROJECT_ROOT / "ai_training" / "outputs" / "model_comparison"

N_FOLDS = 5
RANDOM_SEED = 42
EARLY_STOPPING = 100

# Price segment boundaries (AED)
BUDGET_MAX = 200_000
LUXURY_MIN = 800_000

# features (must match production pipeline)
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


# helpers

def medape(y_true, y_pred):
    return float(np.median(np.abs((y_true - y_pred) / np.maximum(y_true, 1.0))) * 100)


def mape(y_true, y_pred):
    return float(np.mean(np.abs((y_true - y_pred) / np.maximum(y_true, 1.0))) * 100)


def compute_metrics(y_true_log, y_pred_log, label=""):
    # guard against NaN/Inf
    y_pred_log = np.clip(y_pred_log, 0, 25)  # log1p(price) max ~17.4 in data
    y_pred_log = np.nan_to_num(y_pred_log, nan=np.median(y_true_log),
                                posinf=25.0, neginf=0.0)

    y_true_price = np.expm1(y_true_log)
    y_pred_price = np.expm1(y_pred_log)
    y_pred_price = np.maximum(y_pred_price, 0)

    metrics = {
        "RMSE_log":    float(np.sqrt(mean_squared_error(y_true_log, y_pred_log))),
        "R2_log":      float(r2_score(y_true_log, y_pred_log)),
        "MAE_price":   float(mean_absolute_error(y_true_price, y_pred_price)),
        "RMSE_price":  float(np.sqrt(mean_squared_error(y_true_price, y_pred_price))),
        "R2_price":    float(r2_score(y_true_price, y_pred_price)),
        "MedAPE":      medape(y_true_price, y_pred_price),
        "MAPE":        mape(y_true_price, y_pred_price),
    }
    return metrics


def compute_segment_metrics(y_true_log, y_pred_log):
    y_pred_log = np.clip(y_pred_log, 0, 25)
    y_pred_log = np.nan_to_num(y_pred_log, nan=np.median(y_true_log),
                                posinf=25.0, neginf=0.0)
    y_true_price = np.expm1(y_true_log)
    segments = {}

    masks = {
        "budget_<200k":  y_true_price <= BUDGET_MAX,
        "mid_200k-800k": (y_true_price > BUDGET_MAX) & (y_true_price <= LUXURY_MIN),
        "luxury_>800k":  y_true_price > LUXURY_MIN,
    }

    for seg_name, mask in masks.items():
        n = mask.sum()
        if n < 10:
            segments[seg_name] = {"n": int(n), "skipped": True}
            continue
        seg_metrics = compute_metrics(y_true_log[mask], y_pred_log[mask])
        seg_metrics["n"] = int(n)
        segments[seg_name] = seg_metrics

    return segments


def print_metrics_table(results: dict):
    models = list(results.keys())

    # Overall metrics
    print(f"\n{'='*100}")
    print(f"{'OVERALL RESULTS':^100}")
    print(f"{'='*100}")
    header = f"{'Model':<35} {'MAE(AED)':>12} {'RMSE(AED)':>12} {'MedAPE%':>9} {'MAPE%':>9} {'R²(log)':>9} {'R²(price)':>10}"
    print(header)
    print("-" * 100)

    for name in models:
        m = results[name]["overall"]
        print(f"{name:<35} {m['MAE_price']:>12,.0f} {m['RMSE_price']:>12,.0f} "
              f"{m['MedAPE']:>9.2f} {m['MAPE']:>9.2f} {m['R2_log']:>9.4f} {m['R2_price']:>10.4f}")

    # Segment breakdown
    for seg in ["budget_<200k", "mid_200k-800k", "luxury_>800k"]:
        print(f"\n{'─'*100}")
        seg_label = seg.upper().replace("_", " ")
        print(f"  SEGMENT: {seg_label}")
        print(f"{'─'*100}")
        print(f"{'Model':<35} {'n':>6} {'MAE(AED)':>12} {'MedAPE%':>9} {'R²(price)':>10}")
        print("-" * 75)

        for name in models:
            s = results[name].get("segments", {}).get(seg, {})
            if s.get("skipped"):
                print(f"{name:<35} {s.get('n',0):>6}   (too few samples)")
                continue
            if not s:
                print(f"{name:<35}   (no data)")
                continue
            print(f"{name:<35} {s['n']:>6} {s['MAE_price']:>12,.0f} "
                  f"{s['MedAPE']:>9.2f} {s['R2_price']:>10.4f}")


# data loading

def load_data():
    train_df = pd.read_csv(TRAIN_PATH)
    test_df  = pd.read_csv(TEST_PATH)

    for col in CAT_FEATURES:
        train_df[col] = train_df[col].astype("string").fillna("Unknown")
        test_df[col]  = test_df[col].astype("string").fillna("Unknown")

    for col in NUM_FEATURES + [TARGET]:
        train_df[col] = pd.to_numeric(train_df[col], errors="coerce")
        test_df[col]  = pd.to_numeric(test_df[col], errors="coerce")

    train_df = train_df.dropna(subset=[TARGET])
    test_df  = test_df.dropna(subset=[TARGET])

    return train_df, test_df


def prepare_lgb_data(df, cat_cols, num_cols):
    df_enc = df.copy()
    for col in cat_cols:
        df_enc[col] = df_enc[col].astype("category")

    for col in num_cols:
        median_val = df_enc[col].median()
        df_enc[col] = df_enc[col].fillna(median_val)

    return df_enc


_label_maps = {}

def prepare_xgb_data(df, cat_cols, num_cols, fit=False):
    # label-encode because XGBoost chokes on high cardinality categoricals
    global _label_maps
    df_enc = df.copy()

    for col in cat_cols:
        if fit:
            # Build mapping from training data
            unique_vals = df_enc[col].unique().tolist()
            _label_maps[col] = {v: i for i, v in enumerate(unique_vals)}

        mapping = _label_maps.get(col, {})
        # Map values, unseen values get a fallback code
        fallback = len(mapping)
        df_enc[col] = df_enc[col].map(mapping).fillna(fallback).astype(int)

    for col in num_cols:
        median_val = df_enc[col].median()
        df_enc[col] = df_enc[col].fillna(median_val)

    return df_enc


# model definitions

def get_catboost_models():
    base = dict(
        iterations=5000,
        learning_rate=0.05,
        depth=8,
        random_seed=RANDOM_SEED,
        verbose=0,
        early_stopping_rounds=EARLY_STOPPING,
        allow_writing_files=False,
    )

    return {
        "CatBoost_RMSE": {
            **base,
            "loss_function": "RMSE",
            "eval_metric": "RMSE",
        },
        "CatBoost_MAE": {
            **base,
            "loss_function": "MAE",
            "eval_metric": "MAE",
        },
        "CatBoost_Huber": {
            **base,
            "loss_function": "Huber:delta=1.35",  # ~MAD of normal, appropriate for log-space residuals ~0.1-0.5
            "eval_metric": "RMSE",
        },
        "CatBoost_Tweedie": {
            **base,
            "loss_function": "Tweedie:variance_power=1.5",
            "eval_metric": "RMSE",
        },
    }


def get_lightgbm_models():
    base = dict(
        n_estimators=5000,
        learning_rate=0.05,
        max_depth=8,
        num_leaves=127,   # 2^7 - 1, matches depth=8
        min_child_samples=20,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=RANDOM_SEED,
        verbose=-1,
        n_jobs=-1,
    )

    return {
        "LightGBM_RMSE": {
            **base,
            "objective": "regression",
            "metric": "rmse",
        },
        "LightGBM_MAE": {
            **base,
            "objective": "regression_l1",
            "metric": "mae",
        },
        "LightGBM_Huber": {
            **base,
            "objective": "huber",
            "huber_delta": 1.35,
            "metric": "rmse",
        },
        "LightGBM_Tweedie": {
            **base,
            "objective": "tweedie",
            "tweedie_variance_power": 1.5,
            "metric": "rmse",
        },
    }


def get_xgboost_models():
    base = dict(
        n_estimators=5000,
        learning_rate=0.05,
        max_depth=8,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=RANDOM_SEED,
        verbosity=0,
        tree_method="hist",
    )

    return {
        "XGBoost_RMSE": {
            **base,
            "objective": "reg:squarederror",
            "eval_metric": "rmse",
        },
        "XGBoost_MAE": {
            **base,
            "objective": "reg:absoluteerror",
            "eval_metric": "mae",
        },
        "XGBoost_Huber": {
            **base,
            "objective": "reg:pseudohubererror",
            "huber_slope": 1.35,
            "eval_metric": "rmse",
        },
        "XGBoost_Tweedie": {
            **base,
            "objective": "reg:tweedie",
            "tweedie_variance_power": 1.5,
            "eval_metric": "rmse",
        },
    }


# training

def train_catboost_cv(params, X_train, y_train, X_test, cat_features, kf):
    oof_preds = np.zeros(len(X_train))
    test_preds = np.zeros(len(X_test))

    for fold, (tr_idx, va_idx) in enumerate(kf.split(X_train)):
        X_tr, X_va = X_train.iloc[tr_idx], X_train.iloc[va_idx]
        y_tr, y_va = y_train.iloc[tr_idx], y_train.iloc[va_idx]

        model = CatBoostRegressor(**params)
        model.fit(
            X_tr, y_tr,
            cat_features=cat_features,
            eval_set=(X_va, y_va),
            use_best_model=True,
        )

        oof_preds[va_idx] = model.predict(X_va)
        test_preds += model.predict(X_test) / kf.n_splits

    return oof_preds, test_preds


def train_lightgbm_cv(params, X_train, y_train, X_test, cat_features, kf):
    oof_preds = np.zeros(len(X_train))
    test_preds = np.zeros(len(X_test))

    callbacks = [
        lgb.early_stopping(EARLY_STOPPING, verbose=False),
        lgb.log_evaluation(period=0),
    ]

    for fold, (tr_idx, va_idx) in enumerate(kf.split(X_train)):
        X_tr, X_va = X_train.iloc[tr_idx], X_train.iloc[va_idx]
        y_tr, y_va = y_train.iloc[tr_idx], y_train.iloc[va_idx]

        model = lgb.LGBMRegressor(**params)
        model.fit(
            X_tr, y_tr,
            eval_set=[(X_va, y_va)],
            callbacks=callbacks,
            categorical_feature=cat_features,
        )

        oof_preds[va_idx] = model.predict(X_va)
        test_preds += model.predict(X_test) / kf.n_splits

    return oof_preds, test_preds


def train_xgboost_cv(params, X_train, y_train, X_test, cat_features, kf):
    oof_preds = np.zeros(len(X_train))
    test_preds = np.zeros(len(X_test))

    for fold, (tr_idx, va_idx) in enumerate(kf.split(X_train)):
        X_tr, X_va = X_train.iloc[tr_idx], X_train.iloc[va_idx]
        y_tr, y_va = y_train.iloc[tr_idx], y_train.iloc[va_idx]

        n_est = params.pop("n_estimators", 5000)
        model = xgb.XGBRegressor(n_estimators=n_est, **params)
        params["n_estimators"] = n_est  # put it back

        model.fit(
            X_tr, y_tr,
            eval_set=[(X_va, y_va)],
            verbose=False,
        )

        oof_preds[va_idx] = model.predict(X_va)
        test_preds += model.predict(X_test) / kf.n_splits

    return oof_preds, test_preds


# ensembles

def ensemble_simple_average(test_preds_dict):
    preds = np.array(list(test_preds_dict.values()))
    return preds.mean(axis=0)


def ensemble_inverse_error_weighted(test_preds_dict, oof_preds_dict, y_train_log):
    weights = {}
    y_true_price = np.expm1(y_train_log)

    for name, oof in oof_preds_dict.items():
        oof_price = np.expm1(oof)
        mae = mean_absolute_error(y_true_price, np.maximum(oof_price, 0))
        weights[name] = 1.0 / max(mae, 1.0)

    total_w = sum(weights.values())
    weights = {k: v / total_w for k, v in weights.items()}

    result = np.zeros_like(list(test_preds_dict.values())[0])
    for name, w in weights.items():
        result += w * test_preds_dict[name]

    return result, weights


def ensemble_stacking_ridge(oof_preds_dict, test_preds_dict, y_train_log):
    # OOF predictions as meta-features for Ridge
    oof_matrix = np.column_stack(list(oof_preds_dict.values()))
    test_matrix = np.column_stack(list(test_preds_dict.values()))

    meta = Ridge(alpha=1.0)
    meta.fit(oof_matrix, y_train_log)

    stacked_test = meta.predict(test_matrix)

    coefs = dict(zip(oof_preds_dict.keys(), meta.coef_))

    return stacked_test, coefs


# main

def main():
    print("=" * 100)
    print("MODEL COMPARISON: CatBoost vs LightGBM vs XGBoost + Ensembles")
    print("Optimised for UAE market with heavy right-skew (skewness=18.8)")
    print("=" * 100)

    # load data
    print("\n[1/5] Loading data...")
    train_df, test_df = load_data()

    X_train_cat = train_df[ALL_FEATURES]
    y_train = train_df[TARGET]
    X_test_cat = test_df[ALL_FEATURES]
    y_test = test_df[TARGET]

    print(f"  Train: {len(train_df):,} rows")
    print(f"  Test:  {len(test_df):,} rows")

    # Price distribution summary
    prices = np.expm1(y_train.values)
    print(f"  Price range: {prices.min():,.0f} – {prices.max():,.0f} AED")
    print(f"  Median: {np.median(prices):,.0f} | Mean: {np.mean(prices):,.0f} | Skewness: {pd.Series(prices).skew():.1f}")
    print(f"  Luxury (>800k): {(prices > LUXURY_MIN).sum():,} ({(prices > LUXURY_MIN).mean()*100:.1f}%)")

    # prep lgb data
    train_lgb = prepare_lgb_data(train_df, CAT_FEATURES, NUM_FEATURES)
    test_lgb  = prepare_lgb_data(test_df, CAT_FEATURES, NUM_FEATURES)

    X_train_lgb = train_lgb[ALL_FEATURES]
    X_test_lgb  = test_lgb[ALL_FEATURES]

    # prep xgb data (label-encoded)
    train_xgb = prepare_xgb_data(train_df, CAT_FEATURES, NUM_FEATURES, fit=True)
    test_xgb  = prepare_xgb_data(test_df, CAT_FEATURES, NUM_FEATURES, fit=False)

    X_train_xgb = train_xgb[ALL_FEATURES]
    X_test_xgb  = test_xgb[ALL_FEATURES]

    # Same K-fold splits for all models
    kf = KFold(n_splits=N_FOLDS, shuffle=True, random_state=RANDOM_SEED)

    # storage
    all_results = {}
    all_oof_preds = {}
    all_test_preds = {}
    timings = {}

    # train all models
    print("\n[2/5] Training individual models...")

    print("\n  CatBoost")
    for name, params in get_catboost_models().items():
        print(f"    Training {name}...", end=" ", flush=True)
        t0 = time.time()
        oof, test_pred = train_catboost_cv(
            params, X_train_cat, y_train, X_test_cat, CAT_FEATURES, kf
        )
        elapsed = time.time() - t0
        timings[name] = elapsed

        metrics = compute_metrics(y_test.values, test_pred, name)
        segments = compute_segment_metrics(y_test.values, test_pred)
        all_results[name] = {"overall": metrics, "segments": segments}
        all_oof_preds[name] = oof
        all_test_preds[name] = test_pred

        print(f"MAE={metrics['MAE_price']:,.0f}  MedAPE={metrics['MedAPE']:.2f}%  R²={metrics['R2_log']:.4f}  ({elapsed:.0f}s)")

    print("\n  LightGBM")
    for name, params in get_lightgbm_models().items():
        print(f"    Training {name}...", end=" ", flush=True)
        t0 = time.time()
        oof, test_pred = train_lightgbm_cv(
            params, X_train_lgb, y_train, X_test_lgb, CAT_FEATURES, kf
        )
        elapsed = time.time() - t0
        timings[name] = elapsed

        metrics = compute_metrics(y_test.values, test_pred, name)
        segments = compute_segment_metrics(y_test.values, test_pred)
        all_results[name] = {"overall": metrics, "segments": segments}
        all_oof_preds[name] = oof
        all_test_preds[name] = test_pred

        print(f"MAE={metrics['MAE_price']:,.0f}  MedAPE={metrics['MedAPE']:.2f}%  R²={metrics['R2_log']:.4f}  ({elapsed:.0f}s)")

    print("\n  XGBoost")
    for name, params in get_xgboost_models().items():
        print(f"    Training {name}...", end=" ", flush=True)
        t0 = time.time()
        oof, test_pred = train_xgboost_cv(
            params, X_train_xgb, y_train, X_test_xgb, CAT_FEATURES, kf
        )
        elapsed = time.time() - t0
        timings[name] = elapsed

        metrics = compute_metrics(y_test.values, test_pred, name)
        segments = compute_segment_metrics(y_test.values, test_pred)
        all_results[name] = {"overall": metrics, "segments": segments}
        all_oof_preds[name] = oof
        all_test_preds[name] = test_pred

        print(f"MAE={metrics['MAE_price']:,.0f}  MedAPE={metrics['MedAPE']:.2f}%  R²={metrics['R2_log']:.4f}  ({elapsed:.0f}s)")

    # ensembles
    print("\n[3/5] Building ensembles...")

    # Pick best model from each framework (by OOF MAE in price space)
    best_per_framework = {}
    for framework in ["CatBoost", "LightGBM", "XGBoost"]:
        candidates = {k: v for k, v in all_results.items() if k.startswith(framework)}
        best_name = min(candidates, key=lambda k: candidates[k]["overall"]["MAE_price"])
        best_per_framework[framework] = best_name
        print(f"  Best {framework}: {best_name} (MAE={candidates[best_name]['overall']['MAE_price']:,.0f})")

    # Use best-of-each for ensembles
    ens_oof = {k: all_oof_preds[v] for k, v in best_per_framework.items()}
    ens_test = {k: all_test_preds[v] for k, v in best_per_framework.items()}

    # 1. Simple Average
    avg_test = ensemble_simple_average(ens_test)
    metrics = compute_metrics(y_test.values, avg_test)
    segments = compute_segment_metrics(y_test.values, avg_test)
    all_results["Ensemble_SimpleAvg"] = {"overall": metrics, "segments": segments}
    print(f"  Simple Average:      MAE={metrics['MAE_price']:,.0f}  MedAPE={metrics['MedAPE']:.2f}%  R²={metrics['R2_log']:.4f}")

    # 2. Inverse-Error Weighted
    weighted_test, weights = ensemble_inverse_error_weighted(ens_test, ens_oof, y_train.values)
    metrics = compute_metrics(y_test.values, weighted_test)
    segments = compute_segment_metrics(y_test.values, weighted_test)
    all_results["Ensemble_InvErrorWt"] = {"overall": metrics, "segments": segments}
    print(f"  Inverse-Error Wt:    MAE={metrics['MAE_price']:,.0f}  MedAPE={metrics['MedAPE']:.2f}%  R²={metrics['R2_log']:.4f}")
    print(f"    Weights: {', '.join(f'{k}={v:.3f}' for k,v in weights.items())}")

    # 3. Stacking with Ridge
    stacked_test, coefs = ensemble_stacking_ridge(ens_oof, ens_test, y_train.values)
    metrics = compute_metrics(y_test.values, stacked_test)
    segments = compute_segment_metrics(y_test.values, stacked_test)
    all_results["Ensemble_StackedRidge"] = {"overall": metrics, "segments": segments}
    print(f"  Stacked Ridge:       MAE={metrics['MAE_price']:,.0f}  MedAPE={metrics['MedAPE']:.2f}%  R²={metrics['R2_log']:.4f}")
    print(f"    Coefs: {', '.join(f'{k}={v:.3f}' for k,v in coefs.items())}")

    # Also try: all 12 models stacked (not just best-per-framework)
    stacked_all_test, coefs_all = ensemble_stacking_ridge(all_oof_preds, all_test_preds, y_train.values)
    metrics = compute_metrics(y_test.values, stacked_all_test)
    segments = compute_segment_metrics(y_test.values, stacked_all_test)
    all_results["Ensemble_StackedAll12"] = {"overall": metrics, "segments": segments}
    print(f"  Stacked All 12:      MAE={metrics['MAE_price']:,.0f}  MedAPE={metrics['MedAPE']:.2f}%  R²={metrics['R2_log']:.4f}")
    non_zero = {k: v for k, v in coefs_all.items() if abs(v) > 0.01}
    print(f"    Top coefs: {', '.join(f'{k}={v:.3f}' for k,v in sorted(non_zero.items(), key=lambda x: -abs(x[1])))}")

    # results
    print("\n[4/5] Full results comparison...")
    print_metrics_table(all_results)

    # timings
    print(f"\n{'─'*60}")
    print("TRAINING TIMES (5-fold CV, total)")
    print(f"{'─'*60}")
    for name, t in sorted(timings.items(), key=lambda x: x[1]):
        print(f"  {name:<30} {t:>6.0f}s")

    # save
    print("\n[5/5] Saving results...")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Flatten results for CSV
    rows = []
    for name, data in all_results.items():
        row = {"model": name}
        row.update({f"overall_{k}": v for k, v in data["overall"].items()})
        for seg_name, seg_data in data.get("segments", {}).items():
            if not seg_data.get("skipped"):
                row.update({f"{seg_name}_{k}": v for k, v in seg_data.items()})
        rows.append(row)

    results_df = pd.DataFrame(rows)
    results_df.to_csv(OUTPUT_DIR / "comparison_results.csv", index=False)

    # Full JSON with all details
    json_results = {
        "config": {
            "n_folds": N_FOLDS,
            "train_size": len(train_df),
            "test_size": len(test_df),
            "features": ALL_FEATURES,
            "cat_features": CAT_FEATURES,
            "num_features": NUM_FEATURES,
            "price_segments": {
                "budget_max": BUDGET_MAX,
                "luxury_min": LUXURY_MIN,
            },
        },
        "results": {name: data for name, data in all_results.items()},
        "timings": timings,
        "ensemble_weights": {
            "inverse_error": weights,
            "stacked_ridge_best3": coefs,
            "stacked_ridge_all12": {k: float(v) for k, v in coefs_all.items()},
        },
        "best_per_framework": best_per_framework,
    }

    with open(OUTPUT_DIR / "comparison_results.json", "w") as f:
        json.dump(json_results, f, indent=2, default=str)

    # Save OOF predictions for potential further stacking
    oof_df = pd.DataFrame(all_oof_preds)
    oof_df["y_true_log"] = y_train.values
    oof_df.to_csv(OUTPUT_DIR / "oof_predictions.csv", index=False)

    # Save test predictions
    test_pred_df = pd.DataFrame(all_test_preds)
    test_pred_df["y_true_log"] = y_test.values
    test_pred_df.to_csv(OUTPUT_DIR / "test_predictions.csv", index=False)

    print(f"\n  Saved to: {OUTPUT_DIR}/")
    print(f"    - comparison_results.csv")
    print(f"    - comparison_results.json")
    print(f"    - oof_predictions.csv")
    print(f"    - test_predictions.csv")

    # summary
    print(f"\n{'='*100}")
    print("SUMMARY")
    print(f"{'='*100}")

    best_overall = min(all_results.items(), key=lambda x: x[1]["overall"]["MAE_price"])
    best_luxury = None
    for name, data in all_results.items():
        lux = data.get("segments", {}).get("luxury_>800k", {})
        if lux and not lux.get("skipped"):
            if best_luxury is None or lux["MAE_price"] < best_luxury[1]:
                best_luxury = (name, lux["MAE_price"])

    best_medape = min(all_results.items(), key=lambda x: x[1]["overall"]["MedAPE"])

    print(f"  Best overall MAE:     {best_overall[0]} - {best_overall[1]['overall']['MAE_price']:,.0f} AED")
    print(f"  Best overall MedAPE:  {best_medape[0]} - {best_medape[1]['overall']['MedAPE']:.2f}%")
    if best_luxury:
        print(f"  Best luxury MAE:      {best_luxury[0]} - {best_luxury[1]:,.0f} AED")

    print(f"\n  Current production (CatBoost two-stage): MAE=42,580 | MedAPE=12.43% | R²=0.8745")
    print(f"  (Note: production uses RMSEWithUncertainty + luxury residual correction,")
    print(f"   this comparison uses standard loss functions for apples-to-apples comparison)")

    print(f"\n{'='*100}")
    print("DONE")
    print(f"{'='*100}")


if __name__ == "__main__":
    main()
