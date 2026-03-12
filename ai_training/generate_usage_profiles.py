"""
Generate usage_profiles.json from the training CSV.
Maps (brand, model) → median kms/year with brand-level fallback for rare models.
"""
import json
import pandas as pd
from pathlib import Path

MIN_SAMPLES = 10  # Fallback to brand avg if model has fewer samples

def main():
    csv_path = Path(__file__).parent / "datasets" / "full_dataset_v2.csv"
    out_path = Path(__file__).parent.parent / "server" / "models" / "usage_profiles.json"

    df = pd.read_csv(csv_path)

    # Filter out invalid rows
    df = df[df["kms_per_year"] > 0].copy()

    # Global median
    global_median = float(df["kms_per_year"].median())

    # Brand-level medians
    brand_stats = df.groupby("brand")["kms_per_year"].median().to_dict()

    # Model-level medians + sample counts
    model_groups = df.groupby(["brand", "model"]).agg(
        median_kms_per_year=("kms_per_year", "median"),
        sample_count=("kms_per_year", "count"),
    ).reset_index()

    # Build output structure
    brands = {}
    for brand in df["brand"].unique():
        brand_models = model_groups[model_groups["brand"] == brand]
        models = {}
        for _, row in brand_models.iterrows():
            if row["sample_count"] >= MIN_SAMPLES:
                models[row["model"]] = {
                    "median_kms_per_year": round(float(row["median_kms_per_year"])),
                    "sample_count": int(row["sample_count"]),
                }
        brands[brand] = {
            "brand_median_kms_per_year": round(float(brand_stats[brand])),
            "models": models,
        }

    result = {
        "global_median_kms_per_year": round(global_median),
        "brands": brands,
    }

    out_path.write_text(json.dumps(result, indent=2))
    print(f"Wrote {out_path}")
    print(f"  Global median: {global_median:,.0f} kms/year")
    print(f"  Brands: {len(brands)}")
    total_models = sum(len(b["models"]) for b in brands.values())
    print(f"  Models (>={MIN_SAMPLES} samples): {total_models}")


if __name__ == "__main__":
    main()
