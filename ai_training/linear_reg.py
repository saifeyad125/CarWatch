import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import numpy as np

# Load training data
df_train = pd.read_csv("/Users/saif/Desktop/University Saif/Y3/dissertion/project/ai_training/datasets/train.csv")

# Load test data
df_test = pd.read_csv("/Users/saif/Desktop/University Saif/Y3/dissertion/project/ai_training/datasets/test.csv")

# We will only use neumeric features
features = [
    "kms",
    "vehicle_age",
    "kms_per_year",
    "horsepower_mid",
    "engine_cc_mid"
]

# Fill missing values with median (simple imputation for baseline)
for feature in features:
    if df_train[feature].isnull().any():
        median_val = df_train[feature].median()
        df_train.loc[:, feature] = df_train[feature].fillna(median_val)
        df_test.loc[:, feature] = df_test[feature].fillna(median_val)

X_train = df_train[features]
y_train = df_train["log_price"]

X_test = df_test[features]
y_test = df_test["log_price"]


# Pipeline: scaling + regression (instead of manually doing it this normalizes then fits)
pipeline = Pipeline([
    ("scaler", StandardScaler()),
    ("lr", LinearRegression())
])

# Train on training set
pipeline.fit(X_train, y_train)

# -----------------------------
# Evaluation on Training Set
# -----------------------------
y_train_pred = pipeline.predict(X_train)

train_rmse = np.sqrt(mean_squared_error(y_train, y_train_pred))
train_mae = mean_absolute_error(y_train, y_train_pred)
train_r2 = r2_score(y_train, y_train_pred)

print("=" * 50)
print("TRAINING SET PERFORMANCE")
print("=" * 50)
print(f"Linear Regression RMSE: {train_rmse:.4f}")
print(f"Linear Regression MAE : {train_mae:.4f}")
print(f"Linear Regression R²  : {train_r2:.4f}")

# -----------------------------
# Evaluation on Test Set
# -----------------------------
y_test_pred = pipeline.predict(X_test)

# Log-space metrics
test_rmse = np.sqrt(mean_squared_error(y_test, y_test_pred))
test_mae = mean_absolute_error(y_test, y_test_pred)
test_r2 = r2_score(y_test, y_test_pred)

# Convert back to actual prices
y_test_actual_price = np.exp(y_test)
y_test_pred_actual_price = np.exp(y_test_pred)

# Actual currency metrics
test_rmse_currency = np.sqrt(mean_squared_error(y_test_actual_price, y_test_pred_actual_price))
test_mae_currency = mean_absolute_error(y_test_actual_price, y_test_pred_actual_price)
test_r2_currency = r2_score(y_test_actual_price, y_test_pred_actual_price)

print("\n" + "=" * 50)
print("TEST SET PERFORMANCE (Log Space)")
print("=" * 50)
print(f"Linear Regression RMSE: {test_rmse:.4f}")
print(f"Linear Regression MAE : {test_mae:.4f}")
print(f"Linear Regression R²  : {test_r2:.4f}")

print("\n" + "=" * 50)
print("TEST SET PERFORMANCE (Actual Currency)")
print("=" * 50)
print(f"Linear Regression RMSE: {test_rmse_currency:.2f} AED")
print(f"Linear Regression MAE : {test_mae_currency:.2f} AED")
print(f"Linear Regression R²  : {test_r2_currency:.4f}")
