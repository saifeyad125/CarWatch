# How to Check Database Listings

## Quick Commands

### 1. Using the check_db.py script (Recommended)

```bash
# Activate venv and run the script
cd server
source .venv/bin/activate

# Show first 10 listings
python scripts/check_db.py

# Show first 20 listings
python scripts/check_db.py --limit 20

# Show all listings
python scripts/check_db.py --all

# Filter by brand
python scripts/check_db.py --brand BMW
python scripts/check_db.py --brand Toyota --limit 5

# Show help
python scripts/check_db.py --help
```

### 2. Using the API (Server must be running)

```bash
# Get all listings (default limit 20)
curl -s 'http://localhost:8000/api/cars/' | python3 -m json.tool

# Get specific car by ID
curl -s 'http://localhost:8000/api/cars/16' | python3 -m json.tool

# Filter by brand
curl -s 'http://localhost:8000/api/cars/?make=BMW' | python3 -m json.tool

# Filter by price range
curl -s 'http://localhost:8000/api/cars/?min_price=100000&max_price=200000' | python3 -m json.tool

# Get all brands
curl -s 'http://localhost:8000/api/brands' | python3 -m json.tool
```

### 3. Using Python directly

```python
from db.database import SessionLocal
from db.models import Listing

db = SessionLocal()

# Get total count
total = db.query(Listing).count()
print(f"Total listings: {total}")

# Get all BMW listings
bmws = db.query(Listing).filter(Listing.brand == "BMW").all()
for car in bmws:
    print(f"{car.id}: {car.year} {car.brand} {car.model} - AED {car.price:,}")

db.close()
```

### 4. Using psql (Direct database access)

```bash
# Connect to the database
psql -h localhost -p 5433 -U app -d carwatch

# Inside psql:
\dt                                    # List all tables
SELECT COUNT(*) FROM listings;         # Total count
SELECT brand, COUNT(*) FROM listings GROUP BY brand ORDER BY COUNT(*) DESC;  # By brand
SELECT * FROM listings LIMIT 10;      # First 10 listings
\q                                     # Exit
```

## Database Details

- **Host**: localhost
- **Port**: 5433
- **User**: app
- **Password**: app
- **Database**: carwatch

## Current Database Contents

- **Total Listings**: 200 (random sample from dubizzile_final_raw.csv)
- **Watchlists**: 3 (Toyota Camry, BMW SUVs, Nissan Patrol)
- **Matches**: 6 total (0 Toyota, 5 BMW, 1 Nissan)

## Starting the Server

```bash
cd server
source .venv/bin/activate
python main.py
```

The server will:
1. ✓ Create database tables if needed
2. ✓ Scan all watchlists against listings
3. ✓ Start on http://0.0.0.0:8000

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/cars/` - List cars (with filters)
- `GET /api/cars/{id}` - Get car details
- `GET /api/cars/brands` - List all brands
- `GET /api/watchlists` - List watchlists
- `GET /api/watchlists/{id}` - Watchlist details
- `GET /api/watchlists/{id}/matches` - Watchlist matches
- `POST /api/watchlists/{id}/scan` - Scan watchlist
