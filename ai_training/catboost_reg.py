import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import json
from scipy.optimize import minimize_scalar
from scipy.stats import norm
from catboost import CatBoostRegressor
from sklearn.model_selection import KFold
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupKFold


# -----------------------------
# Helper: mean + uncertainty from RMSEWithUncertainty
# -----------------------------
def predict_mean_and_sigma(model, X):
    """
    Returns:
      mu_log   : predicted mean in log-space (shape: [n])
      sigma_log: predicted std-dev (uncertainty) in log-space (shape: [n])
    """
    try:
        pred = model.predict(X, prediction_type="RMSEWithUncertainty")
        pred = np.asarray(pred)

        if pred.ndim == 2 and pred.shape[1] >= 2:
            mu_log = pred[:, 0]
            second = pred[:, 1]

            # Interpret 'second' as variance (CatBoost usually returns variance here)
            sigma_log = np.sqrt(np.maximum(second, 0.0))
            return np.asarray(mu_log), np.asarray(sigma_log)

    except Exception:
        pass

    # Fallback: mean only, no uncertainty
    mu_log = np.asarray(model.predict(X))
    sigma_log = np.full(shape=len(mu_log), fill_value=np.nan, dtype=float)
    return mu_log, sigma_log


# -----------------------------
# Helpers: back-transform for log1p(price)
# -----------------------------
def backtransform_median_log1p(mu_log):
    """Median in original space when modeling log1p(y): expm1(mu)."""
    return np.expm1(mu_log)

def backtransform_mean_log1p(mu_log, sigma_log):
    """Mean in original space for log-normal assumption: expm1(mu + 0.5*sigma^2)."""
    return np.expm1(mu_log + 0.5 * (sigma_log ** 2))


# -----------------------------
# Calibration: find sigma scale to hit target coverage
# -----------------------------
def calibrate_uncertainty(mu_log, sigma_log, y_true_log, target_coverage=0.90, verbose=True):
    mu_log = np.asarray(mu_log)
    sigma_log = np.asarray(sigma_log)
    y_true_log = np.asarray(y_true_log)

    z_target = norm.ppf(0.5 + target_coverage / 2)

    current_coverage = np.mean(
        (y_true_log >= (mu_log - z_target * sigma_log)) &
        (y_true_log <= (mu_log + z_target * sigma_log))
    )

    if verbose:
        print(f"  Before calibration: {current_coverage*100:.2f}% coverage (target: {target_coverage*100:.0f}%)")

    def coverage_error(scale):
        coverage = np.mean(
            (y_true_log >= (mu_log - z_target * scale * sigma_log)) &
            (y_true_log <= (mu_log + z_target * scale * sigma_log))
        )
        return abs(coverage - target_coverage)

    result = minimize_scalar(coverage_error, bounds=(0.5, 3.0), method='bounded')
    calibration_factor = float(result.x)

    if verbose:
        sigma_calibrated = sigma_log * calibration_factor
        new_coverage = np.mean(
            (y_true_log >= (mu_log - z_target * sigma_calibrated)) &
            (y_true_log <= (mu_log + z_target * sigma_calibrated))
        )
        print(f"  Calibration factor: {calibration_factor:.4f}")
        print(f"  After calibration:  {new_coverage*100:.2f}% coverage")

    return calibration_factor


# -----------------------------
# 1) Load Data
# -----------------------------
train_path = "ai_training/datasets/train.csv"
test_path  = "ai_training/datasets/test.csv"

train_df = pd.read_csv(train_path)
test_df  = pd.read_csv(test_path)


# -----------------------------
# 2) Define Features
# -----------------------------
cat_features = [
   "brand", "model", "trim", "fuel_type", "body_type",
   "steering_side", "regional_specs", "doors", "seating_capacity",
   "cylinders", "age_bucket"
]

num_features = [
   "kms", "vehicle_age", "kms_per_year", "horsepower_mid", "engine_cc_mid"
]

target = "log_price"  # this is log1p(price)
features = cat_features + num_features


# -----------------------------
# 3) Clean dtypes & missing values
# -----------------------------
for col in cat_features:
    train_df[col] = train_df[col].astype("string").fillna("Unknown")
    test_df[col]  = test_df[col].astype("string").fillna("Unknown")

for col in num_features + [target]:
    train_df[col] = pd.to_numeric(train_df[col], errors="coerce")
    test_df[col]  = pd.to_numeric(test_df[col], errors="coerce")

train_df = train_df.dropna(subset=[target])
test_df  = test_df.dropna(subset=[target])


# -----------------------------
# 4) K-Fold Cross-Validation Setup
# -----------------------------
X_train_full = train_df[features]
y_train_full = train_df[target]

X_test = test_df[features]
y_test = test_df[target]

kf = KFold(n_splits=5, shuffle=True, random_state=42)
fold_metrics = []

all_val_mu_log = []
all_val_sigma_log = []
all_val_y_true = []

print(f"Starting 5-Fold CV on {len(X_train_full)} training samples...")

for fold, (train_idx, val_idx) in enumerate(kf.split(X_train_full)):
    X_fold_train, X_fold_val = X_train_full.iloc[train_idx], X_train_full.iloc[val_idx]
    y_fold_train, y_fold_val = y_train_full.iloc[train_idx], y_train_full.iloc[val_idx]

    model = CatBoostRegressor(
        loss_function="RMSEWithUncertainty",
        eval_metric="RMSE",
        iterations=5000,
        learning_rate=0.05,
        depth=8,
        random_seed=42,
        verbose=0,
        early_stopping_rounds=100,
        allow_writing_files=False
    )

    model.fit(
        X_fold_train, y_fold_train,
        cat_features=cat_features,
        eval_set=(X_fold_val, y_fold_val),
        use_best_model=True
    )

    # mean + sigma in log-space
    mu_log, sigma_log = predict_mean_and_sigma(model, X_fold_val)

    # store for calibration
    all_val_mu_log.append(mu_log)
    all_val_sigma_log.append(sigma_log)
    all_val_y_true.append(y_fold_val.values)

    # back-transform (log1p)
    y_true_price = np.expm1(y_fold_val.values)

    # CLEAN version: point prediction uses RAW sigma (fold sigma is raw)
    y_pred_price = backtransform_mean_log1p(mu_log, sigma_log)

    # (optional) clip negatives to 0, just in case
    y_pred_price = np.maximum(y_pred_price, 0.0)

    fold_metrics.append({
        "RMSE_log": float(np.sqrt(mean_squared_error(y_fold_val, mu_log))),
        "R2_log": float(r2_score(y_fold_val, mu_log)),
        "MAE_price": float(mean_absolute_error(y_true_price, y_pred_price)),
        "MedAPE": float(np.median(np.abs((y_true_price - y_pred_price) / np.maximum(y_true_price, 1e-9))) * 100),

        "Mean_sigma_log": float(np.nanmean(sigma_log)),
        "Median_sigma_log": float(np.nanmedian(sigma_log)),

        "Coverage_2sigma_log_%": float(np.mean(
            (y_fold_val.values >= (mu_log - 2*sigma_log)) &
            (y_fold_val.values <= (mu_log + 2*sigma_log))
        ) * 100) if np.all(np.isfinite(sigma_log)) else np.nan
    })

    print(f"Fold {fold+1} complete.")


cv_results = pd.DataFrame(fold_metrics)
print("\n" + "="*34)
print("AVERAGE CROSS-VALIDATION PERFORMANCE")
print(f"Mean RMSE (Log):        {cv_results['RMSE_log'].mean():.4f}")
print(f"Mean R² (Log):          {cv_results['R2_log'].mean():.4f}")
print(f"Mean MAE (AED):         {cv_results['MAE_price'].mean():,.2f}")
print(f"Mean MedAPE (%):        {cv_results['MedAPE'].mean():.2f}")
print("-" * 34)
print(f"Mean σ (log):           {cv_results['Mean_sigma_log'].mean():.4f}")
print(f"Median σ (log):         {cv_results['Median_sigma_log'].mean():.4f}")
print(f"Mean Coverage ±2σ (%):  {cv_results['Coverage_2sigma_log_%'].mean():.2f}")
print("="*34)


# -----------------------------
# Calibrate on all K-fold validation predictions
# -----------------------------
print("\n" + "="*60)
print("CALIBRATING ON ALL K-FOLD VALIDATION PREDICTIONS")
print("="*60)

all_val_mu_log = np.concatenate(all_val_mu_log)
all_val_sigma_log = np.concatenate(all_val_sigma_log)
all_val_y_true = np.concatenate(all_val_y_true)

print(f"Total validation samples: {len(all_val_mu_log):,} (100% of training data)")

calibration_factor = calibrate_uncertainty(
    mu_log=all_val_mu_log,
    sigma_log=all_val_sigma_log,
    y_true_log=all_val_y_true,
    target_coverage=0.90,
    verbose=True
)


# -----------------------------
# STAGE 2: Luxury Car Residual Model (to combat right skew)
# -----------------------------
print("\n" + "="*60)
print("STAGE 2: TRAINING LUXURY CAR RESIDUAL MODEL")
print("="*60)

# Stage 2 Config
LUX_THRESHOLD = 800_000  # AED threshold for luxury cars
TAU = 0.15  # sigmoid smoothness (will be tuned later)
BETA = 0.4  # sigma inflation factor for luxury (0.2-0.6)

def sigmoid(x):
    return 1 / (1 + np.exp(-np.clip(x, -500, 500)))  # clip to avoid overflow

# Create OOF predictions DataFrame for Stage 2 training
# We need to map the concatenated validation predictions back to training rows
train_df_stage2 = train_df.copy()

# Get OOF predictions for each training sample
# Since K-fold covers all training data exactly once, we can assign directly
train_df_stage2["mu_log_stage1"] = np.nan
train_df_stage2["sigma_log_stage1"] = np.nan

# Rebuild fold indices to assign OOF predictions
kf_stage2 = KFold(n_splits=5, shuffle=True, random_state=42)
oof_idx = 0
for fold, (train_idx, val_idx) in enumerate(kf_stage2.split(X_train_full)):
    n_val = len(val_idx)
    train_df_stage2.iloc[val_idx, train_df_stage2.columns.get_loc("mu_log_stage1")] = all_val_mu_log[oof_idx:oof_idx+n_val]
    train_df_stage2.iloc[val_idx, train_df_stage2.columns.get_loc("sigma_log_stage1")] = all_val_sigma_log[oof_idx:oof_idx+n_val]
    oof_idx += n_val

# Fallback for any missing sigma
train_df_stage2["sigma_log_stage1"] = train_df_stage2["sigma_log_stage1"].fillna(0.25)

# Get original price from log_price (which is log1p(price))
train_df_stage2["price_original"] = np.expm1(train_df_stage2[target])

# Filter luxury cars for Stage 2 training
lux_mask = train_df_stage2["price_original"] > LUX_THRESHOLD
lux_df = train_df_stage2[lux_mask].copy()

print(f"Luxury threshold: {LUX_THRESHOLD:,} AED")
print(f"Luxury cars in training: {len(lux_df):,} ({len(lux_df)/len(train_df_stage2)*100:.1f}%)")

# Stage 2 target: residual in log space
lux_df["residual_log"] = lux_df[target] - lux_df["mu_log_stage1"]

# Stage 2 features (base features + Stage 1 outputs)
stage2_base_features = [
    "brand", "model", "vehicle_age", "kms_per_year",
    "horsepower_mid", "engine_cc_mid",
    "fuel_type", "body_type", "regional_specs", "trim"
]
stage2_base_features = [c for c in stage2_base_features if c in train_df_stage2.columns]
stage2_features = stage2_base_features + ["mu_log_stage1", "sigma_log_stage1"]
stage2_cat_features = [c for c in ["brand", "model", "fuel_type", "body_type", "regional_specs", "trim"] if c in stage2_features]

X_stage2 = lux_df[stage2_features]
y_stage2 = lux_df["residual_log"]

# -----------------------------
# Stage 2: GroupKFold Validation + TAU Tuning
# -----------------------------

print("\n--- Stage 2 GroupKFold Validation ---")

taus = [0.05, 0.08, 0.10, 0.12, 0.15, 0.20, 0.25, 0.30]
gkf = GroupKFold(n_splits=5)

# Group by brand+model so the same model doesn't appear in train & val
groups = (lux_df["brand"].astype(str) + "_" + lux_df["model"].astype(str)).values

def train_stage2_model(Xtr, ytr, Xva, yva):
    m2 = CatBoostRegressor(
        loss_function="RMSE",
        iterations=5000,               # big number, let early stopping pick best
        depth=5,
        learning_rate=0.05,
        l2_leaf_reg=10,                # stronger reg helps luxury
        random_seed=42,
        verbose=0,
        early_stopping_rounds=200,
        allow_writing_files=False
    )
    m2.fit(
        Xtr, ytr,
        cat_features=stage2_cat_features,
        eval_set=(Xva, yva),
        use_best_model=True
    )
    return m2

tau_scores = {t: [] for t in taus}
best_iters = []

for fold, (tr_idx, va_idx) in enumerate(gkf.split(X_stage2, y_stage2, groups), 1):
    Xtr, Xva = X_stage2.iloc[tr_idx], X_stage2.iloc[va_idx]
    ytr, yva = y_stage2.iloc[tr_idx], y_stage2.iloc[va_idx]

    m2 = train_stage2_model(Xtr, ytr, Xva, yva)
    best_iters.append(m2.get_best_iteration())

    # Stage 1 context for this val fold
    mu1 = lux_df.iloc[va_idx]["mu_log_stage1"].values
    sig1 = lux_df.iloc[va_idx]["sigma_log_stage1"].values
    true_price = lux_df.iloc[va_idx]["price_original"].values

    # Stage 1 only (mean in price space)
    pred1 = np.expm1(mu1 + 0.5 * (sig1 ** 2))

    # Stage 2 residual prediction (delta log)
    delta = m2.predict(Xva)

    # Evaluate different TAU without retraining m2
    for TAU_try in taus:
        w = 1 / (1 + np.exp(-np.clip((mu1 - np.log1p(LUX_THRESHOLD)) / TAU_try, -500, 500)))
        final_log = mu1 + w * delta
        pred2 = np.expm1(final_log + 0.5 * (sig1 ** 2))

        medape2 = np.median(np.abs((true_price - pred2) / np.maximum(true_price, 1e-9))) * 100
        mae2 = mean_absolute_error(true_price, pred2)

        tau_scores[TAU_try].append((medape2, mae2))

    # Stage 1 only for comparison
    medape1 = np.median(np.abs((true_price - pred1) / np.maximum(true_price, 1e-9))) * 100
    mae1 = mean_absolute_error(true_price, pred1)
    
    print(f"Fold {fold}: best_iter={m2.get_best_iteration():>4} | val_size={len(va_idx):>4} | S1 MedAPE={medape1:.1f}%")

# Pick best TAU by mean MedAPE across folds
tau_summary = []
for t in taus:
    medapes = [x[0] for x in tau_scores[t]]
    maes = [x[1] for x in tau_scores[t]]
    tau_summary.append((t, float(np.mean(medapes)), float(np.mean(maes))))

tau_summary.sort(key=lambda x: x[1])
best_tau, best_medape, best_mae = tau_summary[0]

print("\n--- Stage 2 GroupKFold TAU Tuning Results ---")
for t, mape, mae in tau_summary:
    print(f"TAU={t:>4.2f}: Mean MedAPE={mape:.2f}% | Mean MAE={mae:,.0f}")

print(f"\nBEST TAU = {best_tau}  (Mean MedAPE={best_medape:.2f}%, Mean MAE={best_mae:,.0f})")
print(f"Suggested Stage2 iterations (median best_iter): {int(np.median(best_iters))}")

# Update TAU and iterations to CV-chosen values
TAU = float(best_tau)
BEST_ITERS = int(np.median(best_iters))

# Train FINAL Stage-2 model with CV-chosen iterations
print(f"\n--- Training Final Stage 2 Model ---")
stage2_model = CatBoostRegressor(
    loss_function="RMSE",
    iterations=BEST_ITERS,
    depth=5,
    learning_rate=0.05,
    l2_leaf_reg=10,
    random_seed=42,
    verbose=200,
    allow_writing_files=False
)

stage2_model.fit(X_stage2, y_stage2, cat_features=stage2_cat_features)
print(f"Final Stage2 trained with iterations={BEST_ITERS}, TAU={TAU}")


def predict_price_two_stage(df_rows, mu1, sig1, stage1_model, stage2_model, stage2_features, calibration_factor):
    """
    Two-stage prediction with sigmoid gating.
    
    Parameters:
    -----------
    df_rows : DataFrame with base features
    mu1 : Stage 1 predicted mean (log-space)
    sig1 : Stage 1 predicted sigma (log-space, RAW)
    stage1_model : Stage 1 CatBoost model (for reference)
    stage2_model : Stage 2 CatBoost model
    stage2_features : list of features for Stage 2
    calibration_factor : calibration factor for intervals
    
    Returns:
    --------
    final_price, final_log, gate_weight, sigma_calibrated_adjusted
    """
    mu1 = np.asarray(mu1)
    sig1 = np.asarray(sig1)
    
    # Soft gate based on predicted price regime (using CV-tuned TAU)
    w = sigmoid((mu1 - np.log1p(LUX_THRESHOLD)) / TAU)
    
    # Prepare Stage 2 input
    X2_rows = df_rows[stage2_base_features].copy()
    X2_rows["mu_log_stage1"] = mu1
    X2_rows["sigma_log_stage1"] = sig1
    
    # Get Stage 2 residual prediction
    delta = stage2_model.predict(X2_rows[stage2_features])
    
    # Final log prediction: Stage 1 + gated Stage 2 correction
    final_log = mu1 + w * delta
    
    # Bias-correct back-transform (using RAW sigma)
    final_price = np.expm1(final_log + 0.5 * (sig1 ** 2))
    final_price = np.maximum(final_price, 0.0)
    
    # Calibrated sigma with inflation for luxury cars
    # Luxury corrections add uncertainty, so widen intervals when gate weight is high
    sig1_cal = sig1 * calibration_factor
    sig1_cal_adjusted = sig1_cal * (1 + BETA * w)
    
    return final_price, final_log, w, sig1_cal_adjusted


# -----------------------------
# 5) Final Model Training (Stage 1)
# -----------------------------
print("\n" + "="*60)
print("TRAINING FINAL MODEL ON FULL TRAINING SET")
print("="*60)

final_model = CatBoostRegressor(
    loss_function="RMSEWithUncertainty",
    eval_metric="RMSE",
    iterations=3000,
    learning_rate=0.05,
    depth=8,
    random_seed=42,
    verbose=200,
    early_stopping_rounds=100,
    allow_writing_files=False
)

final_model.fit(X_train_full, y_train_full, cat_features=cat_features)

os.makedirs("ai_training/outputs", exist_ok=True)
final_model.save_model("ai_training/outputs/final_model_uncertainty.cbm")
print("Saved model to: ai_training/outputs/final_model_uncertainty.cbm")


# -----------------------------
# 6) Test Evaluation (Stage 1 + Two-Stage comparison)
# -----------------------------
print("\n" + "="*60)
print("TESTING ON TEST SET (with K-fold calibration)")
print("="*60)

mu_test_log, sigma_test_log = predict_mean_and_sigma(final_model, X_test)

# CLEAN: separate raw vs calibrated sigma
sigma_test_log_raw = sigma_test_log
sigma_test_log_cal = sigma_test_log_raw * calibration_factor

# back-transform (log1p)
y_final_true_price = np.expm1(y_test.values)

# ----- STAGE 1 ONLY predictions -----
y_stage1_pred_price = backtransform_mean_log1p(mu_test_log, sigma_test_log_raw)
y_stage1_pred_price = np.maximum(y_stage1_pred_price, 0.0)

# ----- TWO-STAGE predictions -----
y_final_pred_price, final_log_twostage, gate_weights, sigma_test_log_adjusted = predict_price_two_stage(
    test_df, mu_test_log, sigma_test_log_raw,
    final_model, stage2_model, stage2_features, calibration_factor
)

# interval uses ADJUSTED sigma (calibrated + inflated for luxury)
z90 = 1.645
price_low_90  = np.expm1(final_log_twostage - z90 * sigma_test_log_adjusted)
price_high_90 = np.expm1(final_log_twostage + z90 * sigma_test_log_adjusted)

# Clip interval bounds to >= 0 (avoid negative AED)
price_low_90  = np.maximum(price_low_90, 0.0)
price_high_90 = np.maximum(price_high_90, 0.0)

# ----- Stage 1 only metrics -----
stage1_metrics = {
    "RMSE_log": float(np.sqrt(mean_squared_error(y_test, mu_test_log))),
    "MAE_log": float(mean_absolute_error(y_test, mu_test_log)),
    "R2_log": float(r2_score(y_test, mu_test_log)),

    "MAE_price": float(mean_absolute_error(y_final_true_price, y_stage1_pred_price)),
    "RMSE_price": float(np.sqrt(mean_squared_error(y_final_true_price, y_stage1_pred_price))),
    "R2_price": float(r2_score(y_final_true_price, y_stage1_pred_price)),

    "MedAPE": float(np.median(np.abs(
        (y_final_true_price - y_stage1_pred_price) / np.maximum(y_final_true_price, 1e-9)
    )) * 100),
}

# ----- Two-Stage metrics -----
final_metrics = {
    "RMSE_log": float(np.sqrt(mean_squared_error(y_test, final_log_twostage))),
    "MAE_log": float(mean_absolute_error(y_test, final_log_twostage)),
    "R2_log": float(r2_score(y_test, final_log_twostage)),

    "MAE_price": float(mean_absolute_error(y_final_true_price, y_final_pred_price)),
    "RMSE_price": float(np.sqrt(mean_squared_error(y_final_true_price, y_final_pred_price))),
    "R2_price": float(r2_score(y_final_true_price, y_final_pred_price)),

    "MedAPE": float(np.median(np.abs(
        (y_final_true_price - y_final_pred_price) / np.maximum(y_final_true_price, 1e-9)
    )) * 100),

    # uncertainty stats (ADJUSTED = calibrated + inflated for luxury)
    "Mean_sigma_log": float(np.nanmean(sigma_test_log_adjusted)),
    "Median_sigma_log": float(np.nanmedian(sigma_test_log_adjusted)),
    "Coverage_90pct_%": float(np.mean(
        (y_test.values >= (final_log_twostage - z90*sigma_test_log_adjusted)) &
        (y_test.values <= (final_log_twostage + z90*sigma_test_log_adjusted))
    ) * 100) if np.all(np.isfinite(sigma_test_log_adjusted)) else np.nan
}

print("\n" + "="*50)
print("STAGE 1 ONLY vs TWO-STAGE COMPARISON")
print("="*50)
print(f"{'Metric':<20} {'Stage 1 Only':<18} {'Two-Stage':<18} {'Improvement':<15}")
print("-" * 70)
print(f"{'MAE (AED)':<20} {stage1_metrics['MAE_price']:>15,.2f}   {final_metrics['MAE_price']:>15,.2f}   {stage1_metrics['MAE_price']-final_metrics['MAE_price']:>12,.2f}")
print(f"{'RMSE (AED)':<20} {stage1_metrics['RMSE_price']:>15,.2f}   {final_metrics['RMSE_price']:>15,.2f}   {stage1_metrics['RMSE_price']-final_metrics['RMSE_price']:>12,.2f}")
print(f"{'R² (Price)':<20} {stage1_metrics['R2_price']:>15.4f}   {final_metrics['R2_price']:>15.4f}   {final_metrics['R2_price']-stage1_metrics['R2_price']:>12.4f}")
print(f"{'MedAPE (%)':<20} {stage1_metrics['MedAPE']:>15.2f}   {final_metrics['MedAPE']:>15.2f}   {stage1_metrics['MedAPE']-final_metrics['MedAPE']:>12.2f}")
print(f"{'R² (Log)':<20} {stage1_metrics['R2_log']:>15.4f}   {final_metrics['R2_log']:>15.4f}   {final_metrics['R2_log']-stage1_metrics['R2_log']:>12.4f}")
print("="*70)
print(f"Avg gate weight on test set: {np.mean(gate_weights):.3f}")
print(f"Gate > 0.5 (luxury-like): {np.sum(gate_weights > 0.5):,} ({np.mean(gate_weights > 0.5)*100:.1f}%)")

# ----- Luxury subset analysis -----
test_price_original = y_final_true_price
lux_test_mask = test_price_original > LUX_THRESHOLD
n_lux_test = np.sum(lux_test_mask)

if n_lux_test > 10:
    print(f"\n--- Luxury Cars in Test Set (price > {LUX_THRESHOLD:,} AED) ---")
    print(f"Count: {n_lux_test:,} ({n_lux_test/len(test_price_original)*100:.1f}%)")
    
    lux_true = test_price_original[lux_test_mask]
    lux_s1 = y_stage1_pred_price[lux_test_mask]
    lux_s2 = y_final_pred_price[lux_test_mask]
    
    mae_lux_s1 = mean_absolute_error(lux_true, lux_s1)
    mae_lux_s2 = mean_absolute_error(lux_true, lux_s2)
    medape_lux_s1 = np.median(np.abs((lux_true - lux_s1) / lux_true)) * 100
    medape_lux_s2 = np.median(np.abs((lux_true - lux_s2) / lux_true)) * 100
    
    print(f"MAE Stage 1:   {mae_lux_s1:,.2f} AED")
    print(f"MAE Two-Stage: {mae_lux_s2:,.2f} AED  (improvement: {mae_lux_s1-mae_lux_s2:,.2f})")
    print(f"MedAPE Stage 1:   {medape_lux_s1:.2f}%")
    print(f"MedAPE Two-Stage: {medape_lux_s2:.2f}%  (improvement: {medape_lux_s1-medape_lux_s2:.2f}%)")

print("\n" + "="*34)
print("FINAL TWO-STAGE TEST PERFORMANCE")
print(f"RMSE (Log):   {final_metrics['RMSE_log']:.4f}")
print(f"MAE (Log):    {final_metrics['MAE_log']:.4f}")
print(f"R² (Log):     {final_metrics['R2_log']:.4f}")
print("-" * 34)
print(f"MAE (AED):    {final_metrics['MAE_price']:,.2f}")
print(f"RMSE (AED):   {final_metrics['RMSE_price']:,.2f}")
print(f"R² (Price):   {final_metrics['R2_price']:.4f}")
print(f"MedAPE (%):   {final_metrics['MedAPE']:.2f}")
print("-" * 34)
print(f"Mean σ (log):          {final_metrics['Mean_sigma_log']:.4f} (calibrated)")
print(f"Median σ (log):        {final_metrics['Median_sigma_log']:.4f} (calibrated)")
print(f"Coverage 90% band (%): {final_metrics['Coverage_90pct_%']:.2f}")
print("="*34)


# -----------------------------
# 7) Compare with test-based calibration (diagnostic)
# -----------------------------
print("\n" + "="*60)
print("COMPARISON: Test-based calibration")
print("="*60)

calibration_factor_test = calibrate_uncertainty(
    mu_log=mu_test_log,
    sigma_log=sigma_test_log_raw,
    y_true_log=y_test.values,
    target_coverage=0.90,
    verbose=True
)

print(f"\nCalibration factors:")
print(f"  From K-fold validation: {calibration_factor:.4f}")
print(f"  From test:              {calibration_factor_test:.4f}")
print(f"  Difference:             {abs(calibration_factor - calibration_factor_test):.4f}")

if abs(calibration_factor - calibration_factor_test) < 0.05:
    print("\n✓ Factors are very close → K-fold calibration is reliable!")
else:
    print("\n⚠ Factors differ → consider which to use for production")


# -----------------------------
# 8) Save predictions + uncertainty + models
# -----------------------------

# Save Stage 2 model
stage2_model.save_model("ai_training/outputs/stage2_luxury_model.cbm")
print(f"Saved Stage 2 model to: ai_training/outputs/stage2_luxury_model.cbm")

results_df = pd.DataFrame({
    "true_log_price": y_test.values,
    "pred_log_price_stage1": mu_test_log,
    "pred_log_price_twostage": final_log_twostage,

    "sigma_log_raw": sigma_test_log_raw,
    "sigma_log_calibrated": sigma_test_log_cal,
    "sigma_log_adjusted": sigma_test_log_adjusted,  # calibrated + luxury inflation

    "true_price": y_final_true_price,
    "pred_price_stage1": y_stage1_pred_price,
    "pred_price_twostage": y_final_pred_price,
    "gate_weight": gate_weights,

    "pred_low_90": price_low_90,
    "pred_high_90": price_high_90
})

results_with_features = pd.concat([test_df.reset_index(drop=True), results_df.reset_index(drop=True)], axis=1)

out_path = "ai_training/outputs/test_predictions_with_uncertainty.csv"
results_with_features.to_csv(out_path, index=False)
print(f"\nSaved predictions+uncertainty to: {out_path}")
print(f"Rows saved: {len(results_with_features)}")

calibration_info = {
    "calibration_method": "K-fold validation (all folds)",
    "calibration_factor_from_kfold": float(calibration_factor),
    "calibration_factor_from_test": float(calibration_factor_test),
    "recommended_for_production": float(calibration_factor),
    "kfold_validation_samples": int(len(all_val_mu_log)),
    "test_set_size": int(len(X_test)),
    
    # Stage 2 config
    "stage2_config": {
        "luxury_threshold_aed": int(LUX_THRESHOLD),
        "sigmoid_tau": float(TAU),
        "sigma_inflation_beta": float(BETA),
        "stage2_features": stage2_features
    },
    
    # Metrics comparison
    "stage1_only_metrics": {k: float(v) for k, v in stage1_metrics.items()},
    "twostage_metrics": {k: float(v) for k, v in final_metrics.items()}
}

with open("ai_training/outputs/calibration_info.json", "w") as f:
    json.dump(calibration_info, f, indent=2)

print("Saved calibration info to: ai_training/outputs/calibration_info.json")


# -----------------------------
# 9) Show example predictions with uncertainty
# -----------------------------
examples = pd.DataFrame({
    "true_price": y_final_true_price,
    "pred_s1": y_stage1_pred_price,
    "pred_s2": y_final_pred_price,
    "gate_w": gate_weights,
    "pred_low_90": price_low_90,
    "pred_high_90": price_high_90,
    "sigma_adj": sigma_test_log_adjusted
})

examples_sorted = examples.sort_values("sigma_adj", ascending=False)

print("\nMost uncertain examples (top 10):")
print(examples_sorted.head(10).round(2).to_string(index=False))

print("\nMost confident examples (top 10):")
print(examples_sorted.tail(10).round(2).to_string(index=False))


print("\n" + "="*60)
print("TRAINING AND CALIBRATION COMPLETE!")
print(f"Use calibration factor {calibration_factor:.4f} (for intervals/coverage)")
print("="*60)