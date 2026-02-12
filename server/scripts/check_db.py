#!/usr/bin/env python3
"""
Quick script to check the database contents.
Usage: python scripts/check_db.py [--limit N] [--brand BRAND]
"""
import sys
import argparse
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from db.database import SessionLocal
from db.models import Listing, Watchlist, WatchlistMatch
from sqlalchemy import func


def main():
    parser = argparse.ArgumentParser(description='Check CarWatch database contents')
    parser.add_argument('--limit', type=int, default=10, help='Number of listings to show (default: 10)')
    parser.add_argument('--brand', type=str, help='Filter by brand name')
    parser.add_argument('--all', action='store_true', help='Show all listings (no limit)')
    args = parser.parse_args()
    
    db = SessionLocal()
    
    try:
        # Total counts
        total_listings = db.query(func.count(Listing.id)).scalar()
        total_watchlists = db.query(func.count(Watchlist.id)).scalar()
        total_matches = db.query(func.count(WatchlistMatch.id)).scalar()
        
        print("=" * 70)
        print(f"📊 DATABASE SUMMARY")
        print("=" * 70)
        print(f"Total Listings:  {total_listings}")
        print(f"Total Watchlists: {total_watchlists}")
        print(f"Total Matches:   {total_matches}")
        print()
        
        # Brand distribution
        print("🚗 LISTINGS BY BRAND:")
        print("-" * 70)
        brands = db.query(
            Listing.brand, 
            func.count(Listing.id).label('count')
        ).group_by(Listing.brand).order_by(func.count(Listing.id).desc()).all()
        
        for brand, count in brands:
            bar = "█" * min(count, 50)
            print(f"  {brand:20s} {count:3d}  {bar}")
        
        # Listings
        print()
        print("=" * 70)
        if args.brand:
            print(f"📋 LISTINGS - {args.brand.upper()}")
        else:
            limit_text = "ALL" if args.all else f"FIRST {args.limit}"
            print(f"📋 LISTINGS - {limit_text}")
        print("=" * 70)
        
        query = db.query(Listing).order_by(Listing.id)
        if args.brand:
            query = query.filter(Listing.brand.ilike(f"%{args.brand}%"))
        if not args.all:
            query = query.limit(args.limit)
        
        listings = query.all()
        
        for listing in listings:
            print(f"\n{'─' * 70}")
            print(f"ID {listing.id:3d} | {listing.year} {listing.brand} {listing.model}")
            if listing.trim:
                print(f"      | Trim: {listing.trim}")
            print(f"      | Price: AED {listing.price:,}")
            if listing.predicted_price:
                print(f"      | Predicted: AED {listing.predicted_price:,} ({listing.deal_label})")
            print(f"      | Mileage: {listing.kms:,} km")
            print(f"      | Location: {listing.location}")
            if listing.fuel_type and listing.cylinders:
                print(f"      | Engine: {listing.cylinders}-cyl {listing.fuel_type}")
            if listing.horsepower:
                print(f"      | Power: {listing.horsepower}")
            print(f"      | URL: {listing.url[:70]}...")
        
        print("\n" + "=" * 70)
        print(f"Showing {len(listings)} of {query.count()} listings")
        print("=" * 70)
        
    finally:
        db.close()


if __name__ == "__main__":
    main()
