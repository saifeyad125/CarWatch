"""
Test script: scrape 5 real Dubizzle listings, extract images,
run ML predictions, and insert into Supabase.

Usage:
    cd server
    .venv/bin/python test_scrape_5.py
"""
import sys
import random
import logging
from datetime import datetime, timezone

from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(message)s")

from db.database import engine
from sqlalchemy import text
from api.services.scraper_service import (
    _fetch_detail_html,
    _parse_detail_page,
    DEFAULT_IMAGE,
    UAE_LOCATIONS,
)

# 5 real listings from the user's Railway logs (active URLs)
TEST_URLS = [
    {
        "url": "https://uae.dubizzle.com/motors/used-cars/bmw/x5/2026/3/5/3721-pm-x5-xdrive40i-m-sport-0-downpayment-2-570---0170b3c0a5ec42778db73083a81a5a0e/",
        "brand": "BMW", "model": "X5", "price": 250000, "year": 2023, "kms": 30000,
    },
    {
        "url": "https://uae.dubizzle.com/motors/used-cars/mercedes-benz/c-class/2026/3/5/aed-1590month-mercedes-c200-amg-coupe-gcc--2-753---767dd2652af74f9fac04d9ea5e935354/",
        "brand": "Mercedes-Benz", "model": "C-Class", "price": 120000, "year": 2021, "kms": 45000,
    },
    {
        "url": "https://uae.dubizzle.com/motors/used-cars/toyota/land-cruiser/2026/3/5/toyota-land-cruiser-v8-very-brand-new-cond-2-252---2c45a3eae16741058f5ed53a17dc0111/",
        "brand": "Toyota", "model": "Land Cruiser", "price": 180000, "year": 2020, "kms": 60000,
    },
    {
        "url": "https://uae.dubizzle.com/motors/used-cars/porsche/macan/2026/3/5/porsche-macan-s-2-071---e26a74f791f44f6d9492b219fe6622eb/",
        "brand": "Porsche", "model": "Macan", "price": 160000, "year": 2019, "kms": 55000,
    },
    {
        "url": "https://uae.dubizzle.com/motors/used-cars/lamborghini/urus/2026/3/5/2024-lamborghini-urus-performante-carbon-f-2-690---d2f70ff8988343c2b5905700c35669c1/",
        "brand": "Lamborghini", "model": "Urus", "price": 950000, "year": 2024, "kms": 5000,
    },
]

# ── Load ML service ──
from api.services.ml_service import MLService
ml_service = MLService()
if not ml_service.model_loaded:
    print("ERROR: ML model not loaded")
    sys.exit(1)


def _safe_int(val):
    if not val:
        return None
    try:
        return int(str(val).replace(",", "").strip())
    except (ValueError, AttributeError):
        return None


def predict(listing_data: dict) -> tuple[int | None, str | None]:
    try:
        features = {
            "brand": listing_data.get("brand") or "Unknown",
            "model": listing_data.get("model") or "Unknown",
            "year": listing_data.get("year") or 2020,
            "mileage": listing_data.get("kms") or 50000,
            "fuel_type": listing_data.get("fuel_type") or "Petrol",
            "body_type": listing_data.get("body_type") or "Unknown",
            "trim": listing_data.get("trim") or "Unknown",
            "cylinders": _safe_int(listing_data.get("cylinders")) or 4,
            "horsepower": _safe_int(listing_data.get("horsepower")) or 200,
            "engine_cc": _safe_int(listing_data.get("engine_capacity")) or 2000,
            "regional_specs": listing_data.get("regional_specs") or "GCC",
            "steering_side": listing_data.get("steering_side") or "Left",
        }
        result = ml_service.predict_price(features)
        predicted_price = int(result["predicted_price"])
        actual_price = listing_data["price"]
        if actual_price and predicted_price:
            diff_pct = (predicted_price - actual_price) / predicted_price * 100
            if diff_pct > 10:
                return predicted_price, "Good Deal"
            elif diff_pct < -5:
                return predicted_price, "Overpriced"
            else:
                return predicted_price, "Fair"
        return predicted_price, None
    except Exception as e:
        print(f"  Prediction failed: {e}")
        return None, None


INSERT_SQL = text("""
    INSERT INTO listings (
        brand, model, trim, year, price, kms, url,
        horsepower, doors, fuel_type, cylinders,
        interior_color, exterior_color, body_type,
        seating_capacity, engine_capacity, steering_side,
        regional_specs, location, image, images,
        predicted_price, deal_label, created_at, updated_at
    ) VALUES (
        :brand, :model, :trim, :year, :price, :kms, :url,
        :horsepower, :doors, :fuel_type, :cylinders,
        :interior_color, :exterior_color, :body_type,
        :seating_capacity, :engine_capacity, :steering_side,
        :regional_specs, :location, :image, :images,
        :predicted_price, :deal_label, :created_at, :updated_at
    )
""")


def main():
    print("=" * 60)
    print("TEST: Scrape 5 listings with real images")
    print("=" * 60)

    now = datetime.now(timezone.utc)
    results = []

    for i, stub in enumerate(TEST_URLS):
        print(f"\n{'─' * 50}")
        print(f"[{i+1}/5] {stub['brand']} {stub['model']}")
        print(f"  URL: {stub['url']}")

        # Fetch & parse detail page
        html = _fetch_detail_html(stub["url"])
        if not html:
            print("  FAILED: Could not fetch detail page")
            continue

        details = _parse_detail_page(html)
        scraped_images = details.get("_images") or []

        # Print extracted data
        print(f"  Enrichment fields:")
        for k, v in details.items():
            if k != "_images":
                print(f"    {k}: {v}")
        print(f"  Images found: {len(scraped_images)}")
        for j, img in enumerate(scraped_images[:5]):
            print(f"    [{j+1}] {img[:100]}...")
        if not scraped_images:
            print(f"    (none — will use default)")

        # Predict
        listing_data = {**stub, **{k: v for k, v in details.items() if k != "_images"}}
        predicted_price, deal_label = predict(listing_data)
        print(f"  Prediction: {predicted_price:,} AED → {deal_label}")

        import json as json_mod
        results.append({
            "brand": stub["brand"],
            "model": stub["model"],
            "trim": details.get("trim"),
            "year": stub["year"],
            "price": stub["price"],
            "kms": stub["kms"],
            "url": stub["url"],
            "horsepower": details.get("horsepower"),
            "doors": details.get("doors"),
            "fuel_type": details.get("fuel_type"),
            "cylinders": details.get("cylinders"),
            "interior_color": details.get("interior_color"),
            "exterior_color": details.get("exterior_color"),
            "body_type": details.get("body_type"),
            "seating_capacity": details.get("seating_capacity"),
            "engine_capacity": details.get("engine_capacity"),
            "steering_side": details.get("steering_side"),
            "regional_specs": details.get("regional_specs"),
            "location": random.choice(UAE_LOCATIONS),
            "image": scraped_images[0] if scraped_images else DEFAULT_IMAGE,
            "images": json_mod.dumps(scraped_images) if scraped_images else None,
            "predicted_price": predicted_price,
            "deal_label": deal_label,
            "created_at": now,
            "updated_at": now,
        })

    if not results:
        print("\nNo listings fetched. Check proxy credentials.")
        return

    # Insert into Supabase
    print(f"\n{'=' * 60}")
    print(f"Inserting {len(results)} listings into Supabase...")

    with engine.begin() as conn:
        # Delete any test listings with these URLs first (idempotent)
        for r in results:
            conn.execute(text("DELETE FROM listings WHERE url = :url"), {"url": r["url"]})
        conn.execute(INSERT_SQL, results)

    print(f"Done! Inserted {len(results)} listings with real images.")

    # Summary
    print(f"\n{'=' * 60}")
    print("SUMMARY")
    print(f"{'=' * 60}")
    for r in results:
        img_count = len(r["images"].split(",")) if r["images"] else 0
        print(f"  {r['brand']} {r['model']} {r['year']} — "
              f"images: {img_count}, "
              f"price: {r['price']:,}, "
              f"predicted: {r['predicted_price']:,}, "
              f"label: {r['deal_label']}")


if __name__ == "__main__":
    main()
