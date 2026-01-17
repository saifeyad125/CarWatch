import pandas as pd

# Load the dataset
df = pd.read_csv('datasets/full_dataset.csv')

print(f"Original dataset shape: {df.shape}")

# ===========================
# CATEGORICAL FEATURES
# ===========================
cat_features = [
    "brand", "model", "trim", "fuel_type", "body_type", 
    "steering_side", "regional_specs", "doors", 
    "seating_capacity", "cylinders", "age_bucket"
]

# Convert NaN to "Unknown" for categorical features
for col in cat_features:
    if col in df.columns:
        # Replace NaN with "Unknown"
        df[col] = df[col].fillna("Unknown")
        # Also convert any existing "Unknown" strings to ensure consistency
        df[col] = df[col].astype(str)
        print(f"{col}: Converted NaN to 'Unknown'")

# ===========================
# NUMERIC FEATURES
# ===========================
num_features = [
    "kms", "vehicle_age", "kms_per_year", 
    "horsepower_mid", "engine_cc_mid"
]

# These should remain as NaN (numeric types)
# No action needed, they're already correct

# ===========================
# VERIFICATION
# ===========================
print("\n" + "="*70)
print("VERIFICATION AFTER CLEANING")
print("="*70)

print("\nCategorical Features Check:")
for col in cat_features:
    if col in df.columns:
        nan_count = df[col].isnull().sum()
        unknown_count = (df[col] == 'Unknown').sum()
        print(f"  {col}: NaN={nan_count}, Unknown={unknown_count}")

print("\nNumeric Features Check:")
for col in num_features:
    if col in df.columns:
        nan_count = df[col].isnull().sum()
        print(f"  {col}: NaN={nan_count}")

# ===========================
# SAVE CLEANED DATASET
# ===========================
output_path = 'datasets/full_dataset_cleaned.csv'
df.to_csv(output_path, index=False)
print(f"\nCleaned dataset saved to: {output_path}")

