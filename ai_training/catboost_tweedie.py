import os
import gc
import numpy as np
import pandas as pd

from catboost import CatBoostRegressor
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


# =========================
# CONFIG
# =========================
TRAIN_PATH = "ai_training/datasets/train_raw_price.csv"
TEST_PATH  = "ai_training/datasets/test_raw_price.csv"

TARGET_ORIGINAL = "price_aed"

CAT_FEATURES = [
    "brand", "model", "trim", "fuel_type", "body_type",
    "steering_side", "regional_specs", "doors", "seating_capacity",
    "cylinders", "age_bucket"
]

NUM_FEATURES = [
    "kms", "vehicle_age", "kms_per_year", "horsepower_mid", "engine_cc_mid"
]

FEATURES = CAT_FEATURES + NUM_FEATURES

# Tweedie settings
VARIANCE_POWER = 1.8   # try 1.7–1.9 for continuous positive prices
ITERATIONS = 12000
LEARNING_RATE = 0.03
DEPTH = 8
OD_WAIT = 800          # more patience than 200
N_SPLITS = 5
RANDOM_SEED = 42


# =========================
# HELPERS
# =========================
def safe_medape(y_true, y_pred):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    denom = np.maximum(y_true, 1.0)  # avoid divide by zero / tiny values
    return float(np.median(np.abs((y_true - y_pred) / denom)) * 100)

def make_scale_factor(y_price):
    """
    Scale so that median price becomes ~10 in training target.
    This keeps gradients stable without guessing /1000.
    """
    med = float(np.nanmedian(y_price))
    med = max(med, 1.0)
    return med / 10.0

def unscale(pred_scaled, scale):
    return np.asarray(pred_scaled, dtype=float) * scale

def clip_positive(y):
    # Tweedie expects non-negative targets; prices should be positive anyway.
    y = np.asarray(y, dtype=float)
    return np.maximum(y, 1.0)


# =========================
# 1) LOAD DATA
# =========================
train_df = pd.read_csv(TRAIN_PATH)
test_df  = pd.read_csv(TEST_PATH)

# =========================
# 2) CLEAN TYPES
# =========================
for col in CAT_FEATURES:
    train_df[col] = train_df[col].astype("string").fillna("Unknown")
    test_df[col]  = test_df[col].astype("string").fillna("Unknown")

for col in NUM_FEATURES + [TARGET_ORIGINAL]:
    train_df[col] = pd.to_numeric(train_df[col], errors="coerce")
    test_df[col]  = pd.to_numeric(test_df[col], errors="coerce")

train_df = train_df.dropna(subset=[TARGET_ORIGINAL])
test_df  = test_df.dropna(subset=[TARGET_ORIGINAL])

# ensure positive prices
train_df[TARGET_ORIGINAL] = clip_positive(train_df[TARGET_ORIGINAL].values)
test_df[TARGET_ORIGINAL]  = clip_positive(test_df[TARGET_ORIGINAL].values)

# =========================
# 3) SCALE TARGET (SMART SCALING)
# =========================
scale = make_scale_factor(train_df[TARGET_ORIGINAL].values)
train_df["price_scaled"] = train_df[TARGET_ORIGINAL] / scale
test_df["price_scaled"]  = test_df[TARGET_ORIGINAL] / scale

print(f"Scale factor: {scale:,.2f} AED (median -> ~10.0 in target space)")

# =========================
# 4) STRATIFIED FOLDS (BIN BY log1p(price))
# =========================
X_train_full = train_df[FEATURES]
y_train_scaled = train_df["price_scaled"].values
y_train_true = train_df[TARGET_ORIGINAL].values

# strat bins from original price distribution
bins = pd.qcut(np.log1p(y_train_true), q=10, labels=False, duplicates="drop")
skf = StratifiedKFold(n_splits=N_SPLITS, shuffle=True, random_state=RANDOM_SEED)

fold_metrics = []

print(f"\nStarting {N_SPLITS}-Fold Stratified CV (Tweedie)...")

for fold, (train_idx, val_idx) in enumerate(skf.split(X_train_full, bins), start=1):
    X_tr = X_train_full.iloc[train_idx]
    X_va = X_train_full.iloc[val_idx]
    y_tr = y_train_scaled[train_idx]
    y_va = y_train_scaled[val_idx]

    # IMPORTANT: early stop based on Tweedie, not RMSE
    model = CatBoostRegressor(
        loss_function=f"Tweedie:variance_power={VARIANCE_POWER}",
        eval_metric=f"Tweedie:variance_power={VARIANCE_POWER}",
        custom_metric=["RMSE", "MAE"],

        iterations=ITERATIONS,
        learning_rate=LEARNING_RATE,
        depth=DEPTH,
        random_seed=RANDOM_SEED,

        # Stability helpers
        leaf_estimation_method="Newton",
        leaf_estimation_iterations=10,

        od_type="Iter",
        od_wait=OD_WAIT,

        verbose=300,
        allow_writing_files=False
    )

    model.fit(
        X_tr, y_tr,
        cat_features=CAT_FEATURES,
        eval_set=(X_va, y_va),
        use_best_model=True
    )

    # Predict (scaled -> unscaled)
    pred_va_scaled = model.predict(X_va)
    pred_va_price = unscale(pred_va_scaled, scale)
    true_va_price = y_train_true[val_idx]

    fold_metrics.append({
        "MAE_AED": mean_absolute_error(true_va_price, pred_va_price),
        "RMSE_AED": np.sqrt(mean_squared_error(true_va_price, pred_va_price)),
        "R2_AED": r2_score(true_va_price, pred_va_price),
        "MedAPE_%": safe_medape(true_va_price, pred_va_price),
        "best_iteration": int(model.get_best_iteration() if model.get_best_iteration() is not None else -1)
    })

    print(f"\nFold {fold} done | "
          f"R2: {fold_metrics[-1]['R2_AED']:.4f} | "
          f"MAE: {fold_metrics[-1]['MAE_AED']:,.0f} | "
          f"MedAPE: {fold_metrics[-1]['MedAPE_%']:.2f}% | "
          f"best_iter: {fold_metrics[-1]['best_iteration']}")

    del model
    gc.collect()

cv = pd.DataFrame(fold_metrics)

print("\n" + "="*44)
print("AVERAGE CV PERFORMANCE (TWEEDIE, UNSCALED AED)")
print(f"Mean MAE (AED):   {cv['MAE_AED'].mean():,.2f}")
print(f"Mean RMSE (AED):  {cv['RMSE_AED'].mean():,.2f}")
print(f"Mean R² (AED):    {cv['R2_AED'].mean():.4f}")
print(f"Mean MedAPE (%):  {cv['MedAPE_%'].mean():.2f}")
print(f"Avg best_iter:    {cv['best_iteration'].replace(-1, np.nan).mean():.0f}")
print("="*44)


# =========================
# 5) FINAL MODEL (FULL TRAIN)
# =========================
print("\nTraining final Tweedie model on full training set...")

final_model = CatBoostRegressor(
    loss_function=f"Tweedie:variance_power={VARIANCE_POWER}",
    eval_metric=f"Tweedie:variance_power={VARIANCE_POWER}",
    custom_metric=["RMSE", "MAE"],

    iterations=ITERATIONS,
    learning_rate=LEARNING_RATE,
    depth=DEPTH,
    random_seed=RANDOM_SEED,

    leaf_estimation_method="Newton",
    leaf_estimation_iterations=10,

    # More patience (no eval_set here by default)
    verbose=500,
    allow_writing_files=False
)

final_model.fit(X_train_full, y_train_scaled, cat_features=CAT_FEATURES)

os.makedirs("ai_training/outputs", exist_ok=True)
final_model.save_model("ai_training/outputs/final_model_tweedie_fixed.cbm")

# save scale too (so inference can unscale)
with open("ai_training/outputs/tweedie_scale.txt", "w") as f:
    f.write(str(scale))

print("Saved model to: ai_training/outputs/final_model_tweedie_fixed.cbm")
print("Saved scale to: ai_training/outputs/tweedie_scale.txt")


# =========================
# 6) TEST EVALUATION
# =========================
X_test = test_df[FEATURES]
y_test_true = test_df[TARGET_ORIGINAL].values

pred_test_scaled = final_model.predict(X_test)
pred_test_price = unscale(pred_test_scaled, scale)

final_metrics = {
    "MAE_AED": mean_absolute_error(y_test_true, pred_test_price),
    "RMSE_AED": np.sqrt(mean_squared_error(y_test_true, pred_test_price)),
    "R2_AED": r2_score(y_test_true, pred_test_price),
    "MedAPE_%": safe_medape(y_test_true, pred_test_price),
}

print("\n" + "="*34)
print("FINAL TEST PERFORMANCE (TWEEDIE FIXED)")
print("-" * 34)
print(f"MAE (AED):    {final_metrics['MAE_AED']:,.2f}")
print(f"RMSE (AED):   {final_metrics['RMSE_AED']:,.2f}")
print(f"R² (AED):     {final_metrics['R2_AED']:.4f}")
print(f"MedAPE (%):   {final_metrics['MedAPE_%']:.2f}")
print("="*34)

# Save predictions
out_pred = pd.DataFrame({
    "true_price": y_test_true,
    "pred_price": pred_test_price
})
out_pred.to_csv("ai_training/outputs/test_predictions_tweedie_fixed.csv", index=False)
print("Saved predictions to: ai_training/outputs/test_predictions_tweedie_fixed.csv")
print("Done.")
