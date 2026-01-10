import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns


from catboost import CatBoostRegressor
from sklearn.model_selection import KFold
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


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
# -----------------------------
for col in cat_features:
   train_df[col] = train_df[col].astype("string").fillna("Unknown")
   test_df[col]  = test_df[col].astype("string").fillna("Unknown")


for col in num_features + [target]:
   train_df[col] = pd.to_numeric(train_df[col], errors="coerce")
   test_df[col]  = pd.to_numeric(test_df[col], errors="coerce")


train_df = train_df.dropna(subset=[target])
test_df = test_df.dropna(subset=[target])


# -----------------------------
# 4) K-Fold Cross-Validation Setup
# -----------------------------
X_train_full = train_df[features]
y_train_full = train_df[target]


X_test = test_df[features]
y_test = test_df[target]


kf = KFold(n_splits=5, shuffle=True, random_state=42)
fold_metrics = []


print(f"Starting 5-Fold CV on {len(X_train_full)} training samples...")


for fold, (train_idx, val_idx) in enumerate(kf.split(X_train_full)):
   X_fold_train, X_fold_val = X_train_full.iloc[train_idx], X_train_full.iloc[val_idx]
   y_fold_train, y_fold_val = y_train_full.iloc[train_idx], y_train_full.iloc[val_idx]
  
   model = CatBoostRegressor(
       loss_function="RMSE",
       eval_metric="RMSE",
       iterations=3000,
       learning_rate=0.05,
       depth=8,
       random_seed=42,
       verbose=0,
       early_stopping_rounds=100,
       allow_writing_files=False # Prevents catboost_info folder creation
   )
  
   model.fit(
       X_fold_train, y_fold_train,
       cat_features=cat_features,
       eval_set=(X_fold_val, y_fold_val),
       use_best_model=True
   )
  
   # Predictions
   y_pred_log = model.predict(X_fold_val)
   y_true_price = np.exp(y_fold_val)
   y_pred_price = np.exp(y_pred_log)
  
   # Fold Metrics
   fold_metrics.append({
       'RMSE_log': np.sqrt(mean_squared_error(y_fold_val, y_pred_log)),
       'R2_log': r2_score(y_fold_val, y_pred_log),
       'MAE_price': mean_absolute_error(y_true_price, y_pred_price),
       'MedAPE': np.median(np.abs((y_true_price - y_pred_price) / y_true_price)) * 100
   })
   print(f"Fold {fold+1} complete.")


# Summary of CV results
cv_results = pd.DataFrame(fold_metrics)
print("\n" + "="*34)
print("AVERAGE CROSS-VALIDATION PERFORMANCE")
print(f"Mean RMSE (Log):  {cv_results['RMSE_log'].mean():.4f}")
print(f"Mean R² (Log):    {cv_results['R2_log'].mean():.4f}")
print(f"Mean MAE (AED):   {cv_results['MAE_price'].mean():,.2f}")
print(f"Mean MedAPE (%):  {cv_results['MedAPE'].mean():.2f}")
print("="*34)


# -----------------------------
# 5) Final Model Training & Test Evaluation
# -----------------------------
print("\nTraining final model on full training set...")
final_model = CatBoostRegressor(
   loss_function="RMSE",
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


# Final Evaluation
y_final_log = final_model.predict(X_test)
y_final_true_price = np.exp(y_test)
y_final_pred_price = np.exp(y_final_log)


# Calculate final full metric set
final_metrics = {
   "RMSE_log": np.sqrt(mean_squared_error(y_test, y_final_log)),
   "MAE_log": mean_absolute_error(y_test, y_final_log),
   "R2_log": r2_score(y_test, y_final_log),
   "MAE_price": mean_absolute_error(y_final_true_price, y_final_pred_price),
   "RMSE_price": np.sqrt(mean_squared_error(y_final_true_price, y_final_pred_price)),
   "R2_price": r2_score(y_final_true_price, y_final_pred_price),
   "MedAPE": np.median(np.abs((y_final_true_price - y_final_pred_price) / y_final_true_price)) * 100
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
print("="*34)

