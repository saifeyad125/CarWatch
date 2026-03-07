"""
Preprocess dubizzle_rawscrape_2_enriched.csv → model-ready format,
merge with old full_dataset.csv, deduplicate, split 80/20 → train2.csv, test2.csv.

Usage:
    cd ai_training
    python preprocess_and_merge.py
"""

import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.model_selection import train_test_split

# ── Paths ────────────────────────────────────────────────────────────

PROJECT_ROOT = Path(__file__).parent.parent
ENRICHED_CSV = PROJECT_ROOT / "data" / "raw" / "dubuzzile" / "dubizzle_rawscrape_2_enriched.csv"
OLD_DATASET = Path(__file__).parent / "datasets" / "full_dataset.csv"
OUTPUT_DIR = Path(__file__).parent / "datasets"
NEW_PROCESSED = PROJECT_ROOT / "data" / "processed" / "dubizzile" / "dubizzle_rawscrape_2_model_ready.csv"

# ── Column config ────────────────────────────────────────────────────

# Final 17 columns in the model-ready CSV (must match exactly)
FINAL_COLS = [
    "brand", "model", "kms", "trim", "doors", "fuel_type", "cylinders",
    "body_type", "seating_capacity", "steering_side", "regional_specs",
    "vehicle_age", "horsepower_mid", "engine_cc_mid", "kms_per_year",
    "log_price", "age_bucket",
]

# Columns to drop from the enriched CSV (not used in model)
DROP_COLS = [
    "type", "url", "interior_color", "exterior_color",
    "entertainment_and_technology", "transmission_type",
    "seller_type", "warranty",
]

# ── Horsepower midpoint mapping ──────────────────────────────────────

HP_MIDPOINTS = {
    "0 - 99 HP": 49.5,
    "100 - 199 HP": 149.5,
    "200 - 299 HP": 249.5,
    "300 - 399 HP": 349.5,
    "400 - 499 HP": 449.5,
    "500 - 599 HP": 549.5,
    "600 - 699 HP": 649.5,
    "700 - 799 HP": 749.5,
    "800 - 899 HP": 849.5,
    "900+ HP": 950.0,
}

# ── Engine CC midpoint mapping ───────────────────────────────────────

CC_MIDPOINTS = {
    "0 - 499 cc": 249.5,
    "500 - 999 cc": 749.5,
    "1000 - 1499 cc": 1249.5,
    "1500 - 1999 cc": 1749.5,
    "2000 - 2499 cc": 2249.5,
    "2500 - 2999 cc": 2749.5,
    "3000 - 3499 cc": 3249.5,
    "3500 - 3999 cc": 3749.5,
    "4000+ cc": 4000.0,
}

CURRENT_YEAR = 2026


def age_to_bucket(age: int) -> str:
    if age <= 1:
        return "0-1"
    elif age <= 3:
        return "2-3"
    elif age <= 6:
        return "4-6"
    elif age <= 10:
        return "7-10"
    else:
        return "10+"


def preprocess_enriched(df: pd.DataFrame) -> pd.DataFrame:
    """Transform enriched CSV into model-ready format."""
    print(f"  Starting rows: {len(df)}")

    # Drop rows missing critical fields: price_aed, year, kms
    df = df.copy()
    df["price_aed"] = pd.to_numeric(df["price_aed"], errors="coerce")
    df["year"] = pd.to_numeric(df["year"], errors="coerce")
    df["kms"] = pd.to_numeric(df["kms"], errors="coerce")

    before = len(df)
    df = df.dropna(subset=["price_aed", "year", "kms"])
    df = df[df["price_aed"] > 0]
    df = df[df["year"] > 1980]
    print(f"  After dropping invalid price/year/kms: {len(df)} (removed {before - len(df)})")

    # Compute derived features
    df["vehicle_age"] = CURRENT_YEAR - df["year"].astype(int)
    df["kms_per_year"] = df["kms"] / df["vehicle_age"].clip(lower=1)
    df["log_price"] = np.log1p(df["price_aed"])
    df["age_bucket"] = df["vehicle_age"].astype(int).apply(age_to_bucket)

    # Map horsepower to midpoints
    df["horsepower_mid"] = df["horsepower"].map(HP_MIDPOINTS)
    # Map engine CC to midpoints
    df["engine_cc_mid"] = df["engine_capacity_cc"].map(CC_MIDPOINTS)

    # Handle "Unknown" and empty strings → keep as NaN (already NaN from .map)
    # For cylinders: clean up "Unknown" → NaN, keep numeric as-is
    df["cylinders"] = df["cylinders"].replace({"Unknown": "", "": np.nan})
    # Keep as string for CatBoost categorical
    df["cylinders"] = df["cylinders"].where(df["cylinders"].notna(), "")

    # Clean empty strings in categorical columns
    for col in ["trim", "doors", "fuel_type", "body_type", "seating_capacity",
                 "steering_side", "regional_specs"]:
        df[col] = df[col].fillna("").str.strip()

    # Drop columns not used in model
    df = df.drop(columns=[c for c in DROP_COLS if c in df.columns], errors="ignore")
    # Also drop year, price_aed, horsepower, engine_capacity_cc (replaced by derived cols)
    df = df.drop(columns=["year", "price_aed", "horsepower", "engine_capacity_cc"], errors="ignore")

    # Select and reorder to final columns
    df = df[FINAL_COLS]

    print(f"  Final preprocessed rows: {len(df)}")
    return df


def main():
    print("=" * 60)
    print("Preprocess → Merge → Split")
    print("=" * 60)

    # 1. Load and preprocess new enriched data
    print(f"\n1. Loading enriched CSV: {ENRICHED_CSV}")
    df_new = pd.read_csv(ENRICHED_CSV, dtype=str)
    print(f"   Loaded {len(df_new)} rows, {len(df_new.columns)} columns")

    print("\n2. Preprocessing new data...")
    df_new_processed = preprocess_enriched(df_new)

    # Save new processed data separately
    NEW_PROCESSED.parent.mkdir(parents=True, exist_ok=True)
    df_new_processed.to_csv(NEW_PROCESSED, index=False)
    print(f"   Saved new processed data: {NEW_PROCESSED}")

    # 2. Load old dataset
    print(f"\n3. Loading old dataset: {OLD_DATASET}")
    df_old = pd.read_csv(OLD_DATASET)
    print(f"   Loaded {len(df_old)} rows, {len(df_old.columns)} columns")

    # Ensure same columns
    assert list(df_old.columns) == FINAL_COLS, (
        f"Column mismatch!\n  Old: {list(df_old.columns)}\n  New: {FINAL_COLS}"
    )

    # 3. Merge
    print(f"\n4. Merging datasets...")
    df_merged = pd.concat([df_old, df_new_processed], ignore_index=True)
    print(f"   Merged: {len(df_merged)} rows ({len(df_old)} old + {len(df_new_processed)} new)")

    # 4. Deduplicate
    # Two rows are duplicates if brand, model, kms, trim, vehicle_age, and log_price all match
    dedup_cols = ["brand", "model", "kms", "trim", "vehicle_age", "log_price"]
    before = len(df_merged)
    df_merged = df_merged.drop_duplicates(subset=dedup_cols, keep="last")
    dupes = before - len(df_merged)
    print(f"   After dedup on {dedup_cols}: {len(df_merged)} rows (removed {dupes} duplicates)")

    # 5. Shuffle and split 80/20
    print(f"\n5. Splitting 80/20...")
    df_train, df_test = train_test_split(df_merged, test_size=0.2, random_state=42)
    print(f"   Train: {len(df_train)} rows")
    print(f"   Test:  {len(df_test)} rows")

    # 6. Save
    train_path = OUTPUT_DIR / "train2.csv"
    test_path = OUTPUT_DIR / "test2.csv"
    full_path = OUTPUT_DIR / "full_dataset_v2.csv"

    df_merged.to_csv(full_path, index=False)
    df_train.to_csv(train_path, index=False)
    df_test.to_csv(test_path, index=False)

    print(f"\n6. Saved:")
    print(f"   Full:  {full_path} ({len(df_merged)} rows)")
    print(f"   Train: {train_path} ({len(df_train)} rows)")
    print(f"   Test:  {test_path} ({len(df_test)} rows)")

    # Summary stats
    print(f"\n{'=' * 60}")
    print("SUMMARY")
    print(f"{'=' * 60}")
    print(f"  Old dataset:     {len(df_old):,} rows")
    print(f"  New enriched:    {len(df_new):,} rows (raw)")
    print(f"  New processed:   {len(df_new_processed):,} rows")
    print(f"  Merged:          {before:,} rows")
    print(f"  Duplicates:      {dupes:,}")
    print(f"  Final dataset:   {len(df_merged):,} rows")
    print(f"  Train (80%):     {len(df_train):,} rows")
    print(f"  Test  (20%):     {len(df_test):,} rows")

    # Check NaN stats
    print(f"\n  NaN counts in final dataset:")
    for col in FINAL_COLS:
        nan_count = df_merged[col].isna().sum()
        empty_count = (df_merged[col] == "").sum() if df_merged[col].dtype == object else 0
        if nan_count > 0 or empty_count > 0:
            print(f"    {col}: {nan_count} NaN, {empty_count} empty")

    print(f"\n{'=' * 60}")
    print("DONE — Ready to train with catboost_reg.py")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
