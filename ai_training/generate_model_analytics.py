"""
Generate per-model chart data from the training CSV and insert into model_analytics table.
Requires: running database with model_analytics table (run migration first).
"""
import json
import os
import numpy as np
import pandas as pd
from pathlib import Path
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

MAX_SCATTER_POINTS = 200

def main():
    csv_path = Path(__file__).parent / "datasets" / "full_dataset_v2.csv"

    # Load db connection
    env_path = Path(__file__).parent.parent / "server" / ".env"
    load_dotenv(env_path)
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL not set. Check server/.env")
    engine = create_engine(db_url)

    df = pd.read_csv(csv_path)

    # Convert log_price to AED
    df["price_aed"] = np.expm1(df["log_price"]).astype(int)

    # Compute current_year for deriving actual year from vehicle_age
    current_year = 2026
    df["year"] = current_year - df["vehicle_age"]

    groups = df.groupby(["brand", "model"])
    rows = []

    for (brand, model), grp in groups:
        sample_count = len(grp)
        if sample_count < 3:
            continue  # skip models with too few listings

        # Price vs Mileage scatter (capped at 200 points)
        pvk = grp[["kms", "price_aed"]].dropna()
        if len(pvk) > MAX_SCATTER_POINTS:
            pvk = pvk.sample(MAX_SCATTER_POINTS, random_state=42)
        price_vs_mileage = [
            {"kms": int(r["kms"]), "price": int(r["price_aed"])}
            for _, r in pvk.iterrows()
        ]

        # price vs year (grouped by year)
        pvy = grp.groupby("year").agg(
            avg_price=("price_aed", "mean"),
            count=("price_aed", "count"),
        ).reset_index()
        price_vs_year = [
            {"year": int(r["year"]), "avgPrice": int(r["avg_price"]), "count": int(r["count"])}
            for _, r in pvy.iterrows()
        ]

        # competitors: same body_type, closest median price, top 5
        body_types = grp["body_type"].mode()
        if len(body_types) == 0:
            competitors = []
        else:
            primary_body = body_types.iloc[0]
            own_median = grp["price_aed"].median()
            # all models with same body_type (excluding self)
            cand = df[
                (df["body_type"] == primary_body)
                & ~((df["brand"] == brand) & (df["model"] == model))
            ]
            comp_stats = cand.groupby(["brand", "model"]).agg(
                avg_price=("price_aed", "mean"),
                avg_kms=("kms", "mean"),
                avg_year=("year", "mean"),
                count=("price_aed", "count"),
                median_price=("price_aed", "median"),
            ).reset_index()
            comp_stats["price_diff"] = (comp_stats["median_price"] - own_median).abs()
            comp_stats = comp_stats[comp_stats["count"] >= 3]  # min samples for meaningful comparison
            comp_stats = comp_stats.sort_values("price_diff").head(5)
            competitors = [
                {
                    "brand": r["brand"],
                    "model": r["model"],
                    "avgPrice": int(r["avg_price"]),
                    "avgKms": int(r["avg_kms"]),
                    "avgYear": int(r["avg_year"]),
                    "count": int(r["count"]),
                }
                for _, r in comp_stats.iterrows()
            ]

        chart_data = {
            "priceVsMileage": price_vs_mileage,
            "priceVsYear": price_vs_year,
            "competitors": competitors,
        }

        rows.append({
            "brand": brand,
            "model": model,
            "chart_data": json.dumps(chart_data),
            "sample_count": sample_count,
        })

    # fallback for rare models (use brand instead of model)
    brand_groups = df.groupby("brand")
    for brand, grp in brand_groups:
        sample_count = len(grp)
        if sample_count < 3:
            continue

        # Price vs Mileage scatter
        pvk = grp[["kms", "price_aed"]].dropna()
        if len(pvk) > MAX_SCATTER_POINTS:
            pvk = pvk.sample(MAX_SCATTER_POINTS, random_state=42)
        price_vs_mileage = [
            {"kms": int(r["kms"]), "price": int(r["price_aed"])}
            for _, r in pvk.iterrows()
        ]

        # Price vs Year
        pvy = grp.groupby("year").agg(
            avg_price=("price_aed", "mean"),
            count=("price_aed", "count"),
        ).reset_index()
        price_vs_year = [
            {"year": int(r["year"]), "avgPrice": int(r["avg_price"]), "count": int(r["count"])}
            for _, r in pvy.iterrows()
        ]

        # Competitors: cross-brand comparison using the most common body_type
        body_types = grp["body_type"].mode()
        if len(body_types) == 0:
            competitors = []
        else:
            primary_body = body_types.iloc[0]
            own_median = grp["price_aed"].median()
            cand = df[
                (df["body_type"] == primary_body)
                & (df["brand"] != brand)
            ]
            comp_stats = cand.groupby(["brand", "model"]).agg(
                avg_price=("price_aed", "mean"),
                avg_kms=("kms", "mean"),
                avg_year=("year", "mean"),
                count=("price_aed", "count"),
                median_price=("price_aed", "median"),
            ).reset_index()
            comp_stats["price_diff"] = (comp_stats["median_price"] - own_median).abs()
            comp_stats = comp_stats[comp_stats["count"] >= 3]
            comp_stats = comp_stats.sort_values("price_diff").head(5)
            competitors = [
                {
                    "brand": r["brand"],
                    "model": r["model"],
                    "avgPrice": int(r["avg_price"]),
                    "avgKms": int(r["avg_kms"]),
                    "avgYear": int(r["avg_year"]),
                    "count": int(r["count"]),
                }
                for _, r in comp_stats.iterrows()
            ]

        chart_data = {
            "priceVsMileage": price_vs_mileage,
            "priceVsYear": price_vs_year,
            "competitors": competitors,
        }

        rows.append({
            "brand": brand,
            "model": "__brand__",
            "chart_data": json.dumps(chart_data),
            "sample_count": sample_count,
        })

    # Insert in DB
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM model_analytics"))  # Clear old data
        for row in rows:
            conn.execute(
                text("""
                    INSERT INTO model_analytics (brand, model, chart_data, sample_count)
                    VALUES (:brand, :model, CAST(:chart_data AS json), :sample_count)
                """),
                row,
            )

    print(f"Inserted {len(rows)} analytics entries (model + brand-level)")
    print(f"  Skipped models with <3 samples")


if __name__ == "__main__":
    main()
