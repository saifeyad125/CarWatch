"""
Seed the database with ~200 random listings from dubizzile_final_raw.csv
and 3 demo watchlists.

Usage:
    cd server
    python -m scripts.seed_db
"""
import csv
import random
import sys
from pathlib import Path

# Ensure project root is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv()

from db.database import engine, SessionLocal, Base
from db.models import Listing, Watchlist, WatchlistMatch


CSV_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "raw" / "dubuzzile" / "dubizzile_final_raw.csv"
SAMPLE_SIZE = 200
RANDOM_SEED = 42


# ── Unsplash fallback images by body type ──
BODY_IMAGES = {
    "SUV":       "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&h=600&fit=crop",
    "Sedan":     "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&h=600&fit=crop",
    "Coupe":     "https://images.unsplash.com/photo-1584345604476-8ec5f5e8e699?w=800&h=600&fit=crop",
    "Hatchback": "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800&h=600&fit=crop",
    "Pick Up Truck": "https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=800&h=600&fit=crop",
    "Van":       "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800&h=600&fit=crop",
    "Convertible": "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&h=600&fit=crop",
    "default":   "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&h=600&fit=crop",
}

UAE_LOCATIONS = [
    "Dubai, UAE", "Abu Dhabi, UAE", "Sharjah, UAE", "Ajman, UAE",
    "Ras Al Khaimah, UAE", "Fujairah, UAE", "Al Ain, UAE",
]


def _safe_int(val: str, default=None):
    try:
        return int(val.replace(",", "").strip())
    except (ValueError, AttributeError):
        return default


def load_csv_rows():
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    return rows


def pick_image(body_type: str) -> str:
    for key, url in BODY_IMAGES.items():
        if key.lower() in (body_type or "").lower():
            return url
    return BODY_IMAGES["default"]


def row_to_listing(row: dict) -> Listing:
    brand = (row.get("brand") or "").strip()
    model = (row.get("model") or "").strip()
    trim = (row.get("trim") or row.get("type") or "").strip() or None
    price = _safe_int(row.get("price_aed", "0"))
    year = _safe_int(row.get("year", "0"))
    kms = _safe_int(row.get("kms"))
    url = (row.get("url") or "").strip()
    body_type = (row.get("body_type") or "").strip() or None
    image = pick_image(body_type or "")
    location = random.choice(UAE_LOCATIONS)

    return Listing(
        brand=brand,
        model=model,
        trim=trim,
        year=year or 2020,
        price=price or 0,
        kms=kms,
        url=url,
        horsepower=(row.get("horsepower") or "").strip() or None,
        doors=(row.get("doors") or "").strip() or None,
        fuel_type=(row.get("fuel_type") or "").strip() or None,
        cylinders=(row.get("cylinders") or "").strip() or None,
        interior_color=(row.get("interior_color") or "").strip() or None,
        exterior_color=(row.get("exterior_color") or "").strip() or None,
        body_type=body_type,
        seating_capacity=(row.get("seating_capacity") or "").strip() or None,
        engine_capacity=(row.get("engine_capacity_cc") or "").strip() or None,
        steering_side=(row.get("steering_side") or "").strip() or None,
        regional_specs=(row.get("regional_specs") or "").strip() or None,
        image=image,
        location=location,
    )


DEMO_WATCHLISTS = [
    {
        "title": "Toyota Camry 2020-2023",
        "subtitle": "2020–2023 • AED 40,000–90,000",
        "location_label": "Dubai, UAE",
        "tags": ["Used", "Sedan"],
        "is_active": True,
        "alerts_enabled": True,
        "criteria_json": {
            "make": "Toyota",
            "models": ["Camry"],
            "year_min": 2020,
            "year_max": 2023,
            "price_min": 40000,
            "price_max": 90000,
        },
    },
    {
        "title": "BMW SUVs Under AED 200k",
        "subtitle": "2019–2024 • AED 80,000–200,000",
        "location_label": "Abu Dhabi, UAE",
        "tags": ["SUV", "Luxury"],
        "is_active": True,
        "alerts_enabled": False,
        "criteria_json": {
            "make": "BMW",
            "year_min": 2019,
            "year_max": 2024,
            "price_min": 80000,
            "price_max": 200000,
        },
    },
    {
        "title": "Nissan Patrol 2020+",
        "subtitle": "2020–2025 • AED 100,000–300,000",
        "location_label": "Dubai / Abu Dhabi",
        "tags": ["SUV", "Family"],
        "is_active": True,
        "alerts_enabled": True,
        "criteria_json": {
            "make": "Nissan",
            "models": ["Patrol"],
            "year_min": 2020,
            "year_max": 2025,
            "price_min": 100000,
            "price_max": 300000,
        },
    },
]


def main():
    print(f"[1/5] Loading CSV from {CSV_PATH} ...")
    all_rows = load_csv_rows()
    print(f"       {len(all_rows)} rows found")

    # Deterministic sample
    random.seed(RANDOM_SEED)
    sample = random.sample(all_rows, min(SAMPLE_SIZE, len(all_rows)))
    print(f"[2/5] Sampled {len(sample)} listings")

    # Re-create tables (dev convenience – use Alembic in prod)
    print("[3/5] Dropping & creating tables ...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # ── Insert listings ──
        listings = [row_to_listing(r) for r in sample]
        # Remove any with empty URL (can't enforce unique)
        listings = [l for l in listings if l.url]
        db.add_all(listings)
        db.flush()  # assigns ids
        print(f"[4/5] Inserted {len(listings)} listings")

        # ── Insert watchlists ──
        for wl_data in DEMO_WATCHLISTS:
            db.add(Watchlist(**wl_data))
        db.flush()
        print(f"[5/5] Inserted {len(DEMO_WATCHLISTS)} watchlists")

        db.commit()
        print("\n✅ Seed complete!")
        print(f"   Listings : {db.query(Listing).count()}")
        print(f"   Watchlists: {db.query(Watchlist).count()}")

    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
