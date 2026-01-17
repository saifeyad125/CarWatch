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


# -----------------------------
# This function returns the mean and uncertainty from the RMSWithUncertainty model
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

        # Expect 2 columns: [mean, (variance or std)]
        if pred.ndim == 2 and pred.shape[1] >= 2:
            mu_log = pred[:, 0]
            second = pred[:, 1]

            # We will interpret 'second' as variance by default and sqrt it.
            sigma_log = np.sqrt(np.maximum(second, 0.0))

            return mu_log, sigma_log

    except Exception:
        pass

    # Fallback: if there is no uncertainty output, return NaNs
    mu_log = model.predict(X)
    sigma_log = np.full(shape=len(mu_log), fill_value=np.nan, dtype=float)
    return np.asarray(mu_log), sigma_log


# -----------------------------
# CALIBRATION FUNCTION
# -----------------------------
def calibrate_uncertainty(mu_log, sigma_log, y_true_log, target_coverage=0.90, verbose=True):
    """
    Find optimal calibration factor to achieve target coverage.
    
    Parameters explained:
    -----------
    mu_log : array-like
        Predicted mean values in log space
    sigma_log : array-like
        Predicted uncertainty (standard deviation) in log space
    y_true_log : array-like
        True target values in log space
    target_coverage : float, default=0.90
        Desired coverage probability (e.g., 0.90 for 90% intervals)
    verbose : bool
        Whether to print detailed output
    
    Returns:
    --------
    float : calibration_factor for example 1.234
    """
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
    
    #-----------------------------
    #We use scale (like 1.234), multiply by sigma and zvalue, then see how many
    #values are within the interval. 
    #if inside the band, we get true, then we get the mean to get percentage
    #we subtract the percentage with value we want, our goal is for it to be 0
    #-----------------------------
    def coverage_error(scale):
        coverage = np.mean(
            (y_true_log >= (mu_log - z_target * scale * sigma_log)) &
            (y_true_log <= (mu_log + z_target * scale * sigma_log))
        )
        return abs(coverage - target_coverage)
    
    #premade function which takes a value between 0.5-3, and finds the constant which returns the smallest value
    result = minimize_scalar(coverage_error, bounds=(0.5, 3.0), method='bounded')
    calibration_factor = result.x
    
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

target = "log_price"
features = cat_features + num_features


# -----------------------------
# 3) Clean dtypes & missing values (added back for safety)
#   we want empty cat features as strings, we want empty num features as NaN
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

# Here we collect all validation predictions for calibration later
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
       iterations=3000,
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

   # Predictions (mean + uncertainty)
   mu_log, sigma_log = predict_mean_and_sigma(model, X_fold_val)

   # NEW: Store validation predictions for calibration
   all_val_mu_log.append(mu_log)
   all_val_sigma_log.append(sigma_log)
   all_val_y_true.append(y_fold_val.values)

    #here we just convert log back to real price
   y_true_price = np.exp(y_fold_val)
   y_pred_price = np.exp(mu_log)

   # Fold Metrics (same as before, using mean prediction)
   fold_metrics.append({
       'RMSE_log': np.sqrt(mean_squared_error(y_fold_val, mu_log)),
       'R2_log': r2_score(y_fold_val, mu_log),
       'MAE_price': mean_absolute_error(y_true_price, y_pred_price),
       'MedAPE': np.median(np.abs((y_true_price - y_pred_price) / y_true_price)) * 100,

       # Uncertainty summaries
       'Mean_sigma_log': float(np.nanmean(sigma_log)),
       'Median_sigma_log': float(np.nanmedian(sigma_log)),
       # coverage: how often true log price falls within mean ± 2σ
       'Coverage_2sigma_log_%': float(np.mean(
           (y_fold_val.values >= (mu_log - 2*sigma_log)) & (y_fold_val.values <= (mu_log + 2*sigma_log))
       ) * 100) if np.all(np.isfinite(sigma_log)) else np.nan
   })

   print(f"Fold {fold+1} complete.")


# Summary of CV results
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
# NEW: Calibrate on all K-fold validation predictions
# -----------------------------
print("\n" + "="*60)
print("CALIBRATING ON ALL K-FOLD VALIDATION PREDICTIONS")
print("="*60)

# Concatenate all validation predictions from all folds
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
# 5) Final Model Training & Test Evaluation
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

# Save model
os.makedirs("ai_training/outputs", exist_ok=True)
final_model.save_model("ai_training/outputs/final_model_uncertainty.cbm")
print("Saved model to: ai_training/outputs/final_model_uncertainty.cbm")


# -----------------------------
# Apply calibration to test set
# -----------------------------
print("\n" + "="*60)
print("TESTING ON TEST SET (with K-fold calibration)")
print("="*60)

# Final Evaluation (mean + uncertainty)
mu_test_log, sigma_test_log = predict_mean_and_sigma(final_model, X_test)

# Apply calibration factor from K-fold validation
sigma_test_log_calibrated = sigma_test_log * calibration_factor

y_final_true_price = np.exp(y_test)
y_final_pred_price = np.exp(mu_test_log)

# Convert uncertainty to a human-friendly price interval
# 90% interval ~ mean ± 1.645σ in log-space
z90 = 1.645
price_low_90  = np.exp(mu_test_log - z90 * sigma_test_log_calibrated)
price_high_90 = np.exp(mu_test_log + z90 * sigma_test_log_calibrated)

# Calculate final full metric set (using calibrated uncertainty)
final_metrics = {
   "RMSE_log": np.sqrt(mean_squared_error(y_test, mu_test_log)),
   "MAE_log": mean_absolute_error(y_test, mu_test_log),
   "R2_log": r2_score(y_test, mu_test_log),
   "MAE_price": mean_absolute_error(y_final_true_price, y_final_pred_price),
   "RMSE_price": np.sqrt(mean_squared_error(y_final_true_price, y_final_pred_price)),
   "R2_price": r2_score(y_final_true_price, y_final_pred_price),
   "MedAPE": np.median(np.abs((y_final_true_price - y_final_pred_price) / y_final_true_price)) * 100,

   # Uncertainty + coverage (CALIBRATED)
   "Mean_sigma_log": float(np.nanmean(sigma_test_log_calibrated)),
   "Median_sigma_log": float(np.nanmedian(sigma_test_log_calibrated)),
   "Coverage_90pct_%": float(np.mean(
       (y_test.values >= (mu_test_log - z90*sigma_test_log_calibrated)) &
       (y_test.values <= (mu_test_log + z90*sigma_test_log_calibrated))
   ) * 100) if np.all(np.isfinite(sigma_test_log_calibrated)) else np.nan
}

print("\n" + "="*34)
print("FINAL HELD-OUT TEST PERFORMANCE")
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
# NEW: Compare with test-based calibration
# -----------------------------
print("\n" + "="*60)
print("COMPARISON: Test-based calibration")
print("="*60)

calibration_factor_test = calibrate_uncertainty(
    mu_log=mu_test_log,
    sigma_log=sigma_test_log,
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
# 5.1) SAVE PREDICTIONS + UNCERTAINTY
# -----------------------------
results_df = pd.DataFrame({
    "true_log_price": y_test.values,
    "pred_log_price": mu_test_log,
    "sigma_log_raw": sigma_test_log,
    "sigma_log_calibrated": sigma_test_log_calibrated,

    "true_price": y_final_true_price.values,
    "pred_price": y_final_pred_price,

    "pred_low_90": price_low_90,
    "pred_high_90": price_high_90
})

# Optional: include original test features alongside outputs for debugging / UI later
results_with_features = pd.concat([test_df.reset_index(drop=True), results_df], axis=1)

out_path = "ai_training/outputs/test_predictions_with_uncertainty.csv"
results_with_features.to_csv(out_path, index=False)
print(f"\nSaved predictions+uncertainty to: {out_path}")
print(f"Rows saved: {len(results_with_features)}")

# Save calibration info
calibration_info = {
    'calibration_method': 'K-fold validation (all folds)',
    'calibration_factor_from_kfold': float(calibration_factor),
    'calibration_factor_from_test': float(calibration_factor_test),
    'recommended_for_production': float(calibration_factor),
    'kfold_validation_samples': int(len(all_val_mu_log)),
    'test_set_size': int(len(X_test)),
    'final_test_metrics': {k: float(v) for k, v in final_metrics.items()}
}

with open("ai_training/outputs/calibration_info.json", 'w') as f:
    json.dump(calibration_info, f, indent=2)

print(f"Saved calibration info to: ai_training/outputs/calibration_info.json")


# -----------------------------
# 6) Display a few example predictions with uncertainty 
# -----------------------------
examples = pd.DataFrame({
    "true_price": y_final_true_price.values,
    "pred_price": y_final_pred_price,
    "pred_low_90": price_low_90,
    "pred_high_90": price_high_90,
    "sigma_log": sigma_test_log_calibrated
})

# Show the "most uncertain" and "most confident" examples
examples_sorted = examples.sort_values("sigma_log", ascending=False)

print("\nMost uncertain examples (top 10):")
print(examples_sorted.head(10).round(2).to_string(index=False))

print("\nMost confident examples (top 10):")
print(examples_sorted.tail(10).round(2).to_string(index=False))

# Optional: quick plot of uncertainty distribution
plt.figure(figsize=(8, 4))
plt.hist(examples["sigma_log"].dropna(), bins=40)
plt.xlabel("Uncertainty (sigma) in log space - CALIBRATED")
plt.ylabel("Count")
plt.title("Distribution of Prediction Uncertainty (σ) - After Calibration")
plt.tight_layout()
plt.show()

print("\n" + "="*60)
print("TRAINING AND CALIBRATION COMPLETE!")
print(f"Use calibration factor {calibration_factor:.4f}")
print("="*60)