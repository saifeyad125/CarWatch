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
print(f"\n✅ Cleaned dataset saved to: {output_path}")

# Also create cleaned train and test sets
print("\nCleaning train and test sets...")

# Train set
train_df = pd.read_csv('datasets/train.csv')
for col in cat_features:
    if col in train_df.columns:
        train_df[col] = train_df[col].fillna("Unknown").astype(str)
train_df.to_csv('datasets/train_cleaned.csv', index=False)
print("✅ train_cleaned.csv saved")

# Test set
test_df = pd.read_csv('datasets/test.csv')
for col in cat_features:
    if col in test_df.columns:
        test_df[col] = test_df[col].fillna("Unknown").astype(str)
test_df.to_csv('datasets/test_cleaned.csv', index=False)
print("✅ test_cleaned.csv saved")

print("\n" + "="*70)
print("CLEANING COMPLETE!")
print("="*70)
