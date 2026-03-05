"""
Populate Supabase with 2500 random listings from the enriched CSV,
run v2 ML predictions, and insert into the remote database.
This is just initial and I will get real time listings after and delete these.

Usage:
    cd server
    .venv/bin/python populate_supabase.py
"""
import sys
import csv
import random
from pathlib import Path
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv()

from db.database import engine
from sqlalchemy import text

# ── Config ──────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).parent.parent
ENRICHED_CSV = PROJECT_ROOT / "data" / "raw" / "dubuzzile" / "dubizzle_rawscrape_2_enriched.csv"
SAMPLE_SIZE = 2500

# ── Load ML service ─────────────────────────────────────────────
from api.services.ml_service import MLService
ml_service = MLService()

if not ml_service.model_loaded:
    print("ERROR: ML model not loaded. Check server/models/ directory.")
    sys.exit(1)

print(f"ML model loaded. Calibration factor: {ml_service.calibration_factor:.4f}")


def _safe_int(val):
    if not val:
        return None
    try:
        return int(str(val).replace(",", "").strip())
    except (ValueError, AttributeError):
        return None


def predict_and_label(row: dict) -> tuple[int | None, str | None]:
    """Run ML prediction on a CSV row. Returns (predicted_price, deal_label)."""
    try:
        features = {
            "brand": row.get("brand") or "Unknown",
            "model": row.get("model") or "Unknown",
            "year": int(row.get("year") or 2020),
            "mileage": int(row.get("kms") or 50000),
            "fuel_type": row.get("fuel_type") or "Petrol",
            "body_type": row.get("body_type") or "Unknown",
            "trim": row.get("trim") or "Unknown",
            "cylinders": _safe_int(row.get("cylinders")) or 4,
            "horsepower": _safe_int(row.get("horsepower")) or 200,
            "engine_cc": _safe_int(row.get("engine_capacity_cc")) or 2000,
            "regional_specs": row.get("regional_specs") or "GCC",
            "steering_side": row.get("steering_side") or "Left",
        }
        result = ml_service.predict_price(features)
        predicted_price = int(result["predicted_price"])

        actual_price = int(row.get("price_aed") or 0)
        if actual_price and predicted_price:
            diff_pct = (predicted_price - actual_price) / predicted_price * 100
            if diff_pct > 10:
                deal_label = "Good Deal"
            elif diff_pct < -5:
                deal_label = "Overpriced"
            else:
                deal_label = "Fair"
        else:
            deal_label = None

        return predicted_price, deal_label
    except Exception as e:
        print(f"  Prediction failed: {e}")
        return None, None


def main():
    print("=" * 60)
    print("Populate Supabase with listings")
    print("=" * 60)

    # 1. Read enriched CSV
    print(f"\n1. Reading {ENRICHED_CSV}...")
    all_rows = []
    with open(ENRICHED_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            # Only include rows with valid price/year/kms
            price = _safe_int(row.get("price_aed"))
            year = _safe_int(row.get("year"))
            if price and price > 0 and year and year > 1980:
                all_rows.append(row)
    print(f"   Valid rows: {len(all_rows)}")

    # 2. Sample 2500 random listings
    random.seed(42)
    sample = random.sample(all_rows, min(SAMPLE_SIZE, len(all_rows)))
    print(f"\n2. Sampled {len(sample)} listings")

    # 3. Clear existing listings from Supabase
    print("\n3. Clearing existing listings from Supabase...")
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM watchlist_matches"))
        conn.execute(text("DELETE FROM notifications"))
        conn.execute(text("DELETE FROM listings"))
    print("   Cleared.")

    # 4. Run predictions and insert
    print(f"\n4. Running predictions and inserting {len(sample)} listings...")
    inserted = 0
    prediction_ok = 0

    INSERT_SQL = text("""
        INSERT INTO listings (
            brand, model, trim, year, price, kms, url,
            horsepower, doors, fuel_type, cylinders,
            interior_color, exterior_color, body_type,
            seating_capacity, engine_capacity, steering_side,
            regional_specs, location, predicted_price, deal_label,
            created_at, updated_at
        ) VALUES (
            :brand, :model, :trim, :year, :price, :kms, :url,
            :horsepower, :doors, :fuel_type, :cylinders,
            :interior_color, :exterior_color, :body_type,
            :seating_capacity, :engine_capacity, :steering_side,
            :regional_specs, :location, :predicted_price, :deal_label,
            :created_at, :updated_at
        )
    """)

    now = datetime.now(timezone.utc)
    batch = []

    with engine.begin() as conn:
        for i, row in enumerate(sample):
            predicted_price, deal_label = predict_and_label(row)
            if predicted_price:
                prediction_ok += 1

            params = {
                "brand": row.get("brand") or "Unknown",
                "model": row.get("model") or "Unknown",
                "trim": row.get("trim") or None,
                "year": int(row.get("year")),
                "price": int(row.get("price_aed")),
                "kms": _safe_int(row.get("kms")),
                "url": row.get("url") or f"https://dubizzle.com/listing/{i}",
                "horsepower": row.get("horsepower") or None,
                "doors": row.get("doors") or None,
                "fuel_type": row.get("fuel_type") or None,
                "cylinders": row.get("cylinders") or None,
                "interior_color": row.get("interior_color") or None,
                "exterior_color": row.get("exterior_color") or None,
                "body_type": row.get("body_type") or None,
                "seating_capacity": row.get("seating_capacity") or None,
                "engine_capacity": row.get("engine_capacity_cc") or None,
                "steering_side": row.get("steering_side") or None,
                "regional_specs": row.get("regional_specs") or None,
                "location": "Dubai, UAE",
                "predicted_price": predicted_price,
                "deal_label": deal_label,
                "created_at": now,
                "updated_at": now,
            }
            batch.append(params)
            inserted += 1

            if len(batch) >= 500:
                conn.execute(INSERT_SQL, batch)
                batch.clear()
                print(f"   {i + 1}/{len(sample)} inserted ({prediction_ok} predictions OK)")

        if batch:
            conn.execute(INSERT_SQL, batch)
            print(f"   {inserted}/{len(sample)} inserted ({prediction_ok} predictions OK)")

    print(f"\n{'=' * 60}")
    print("DONE")
    print(f"  Inserted:    {inserted}")
    print(f"  Predictions: {prediction_ok}/{inserted}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
