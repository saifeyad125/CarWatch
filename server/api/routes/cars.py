"""
Car listings endpoints – reads from Postgres via SQLAlchemy.
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional, List
from sqlalchemy.orm import Session

from db.deps import get_db
from db.models import Listing
from models.schemas import (
    CarListingSummary, 
    CarListingDetail, 
    Seller, 
    MarketAnalysis, 
    PricePoint, 
    SimilarListing
)


router = APIRouter()


# ───── helpers ─────

def _fmt_price(aed: int) -> str:
    """Format integer AED price → '$52,000' style string for the frontend."""
    return f"${aed:,}"

def _fmt_mileage(kms: Optional[int]) -> str:
    if kms is None:
        return "N/A"
    return f"{kms:,} km"

def _listing_to_summary(row: Listing) -> CarListingSummary:
    return CarListingSummary(
        id=row.id,
        make=row.brand,
        model=row.model,
        year=row.year,
        price=_fmt_price(row.price),
        predictedPrice=_fmt_price(row.predicted_price) if row.predicted_price else None,
        dealLabel=row.deal_label,
        mileage=_fmt_mileage(row.kms),
        location=row.location or "Dubai, UAE",
        image=row.image or "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&h=600&fit=crop",
    )


def _listing_to_detail(row: Listing) -> CarListingDetail:
    """Convert DB Listing to full CarListingDetail with mock data for missing fields."""
    
    # Generate features from DB fields
    features = []
    if row.fuel_type:
        features.append(f"{row.fuel_type.title()} Engine")
    if row.cylinders:
        features.append(f"{row.cylinders}-Cylinder")
    if row.horsepower:
        features.append(f"{row.horsepower}hp")
    if row.doors:
        features.append(f"{row.doors} Doors")
    if row.seating_capacity:
        features.append(f"{row.seating_capacity} Seats")
    if row.body_type:
        features.append(f"{row.body_type}")
    if row.interior_color:
        features.append(f"{row.interior_color} Interior")
    if row.exterior_color:
        features.append(f"{row.exterior_color} Exterior")
    if row.steering_side:
        features.append(f"{row.steering_side} Steering")
    if row.regional_specs:
        features.append(f"{row.regional_specs} Specs")
    
    # Mock seller data (TODO: add seller table)
    seller = Seller(
        name="AutoTrader UAE",
        avatar="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
        phone="+971 50 123 4567",
        type="Verified Dealer"
    )
    
    # Generate description from DB fields
    description = f"Well-maintained {row.year} {row.brand} {row.model}"
    if row.trim:
        description += f" {row.trim}"
    description += f" with {_fmt_mileage(row.kms)}."
    if row.fuel_type and row.cylinders:
        description += f" Powered by a {row.cylinders}-cylinder {row.fuel_type} engine"
        if row.horsepower:
            description += f" producing {row.horsepower}hp"
        description += "."
    if row.regional_specs:
        description += f" {row.regional_specs} specifications."
    description += " Excellent condition, ready for immediate delivery."
    
    # Mock market analysis (TODO: integrate with CatBoost predictions)
    base_price = row.price
    market_analysis = MarketAnalysis(
        depreciation={
            "oneYear": 12,
            "threeYear": 35,
            "fiveYear": 55
        },
        marketTrend="stable",
        priceHistory=[
            PricePoint(month="Jan", averagePrice=int(base_price * 0.95)),
            PricePoint(month="Feb", averagePrice=int(base_price * 0.97)),
            PricePoint(month="Mar", averagePrice=int(base_price * 0.98)),
            PricePoint(month="Apr", averagePrice=int(base_price * 1.00)),
            PricePoint(month="May", averagePrice=int(base_price * 1.02)),
            PricePoint(month="Jun", averagePrice=int(base_price * 1.01)),
        ],
        similarListings=[
            SimilarListing(
                price=_fmt_price(int(base_price * 1.05)),
                mileage=_fmt_mileage(row.kms + 10000 if row.kms else 50000),
                daysOnMarket=12
            ),
            SimilarListing(
                price=_fmt_price(int(base_price * 0.98)),
                mileage=_fmt_mileage(row.kms + 20000 if row.kms else 60000),
                daysOnMarket=8
            ),
            SimilarListing(
                price=_fmt_price(int(base_price * 1.02)),
                mileage=_fmt_mileage(row.kms - 5000 if row.kms and row.kms > 5000 else 30000),
                daysOnMarket=5
            ),
        ]
    )
    
    return CarListingDetail(
        # From summary
        id=row.id,
        make=row.brand,
        model=row.model,
        year=row.year,
        price=_fmt_price(row.price),
        predictedPrice=_fmt_price(row.predicted_price) if row.predicted_price else None,
        dealLabel=row.deal_label,
        mileage=_fmt_mileage(row.kms),
        location=row.location or "Dubai, UAE",
        image=row.image or "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&h=600&fit=crop",
        # Detail fields
        description=description,
        seller=seller,
        url=row.url,
        features=features,
        marketAnalysis=market_analysis,
    )


# ───── routes ─────

@router.get("/", response_model=List[CarListingSummary])
def get_listings(
    make: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    min_year: Optional[int] = Query(None),
    max_year: Optional[int] = Query(None),
    min_price: Optional[int] = Query(None),
    max_price: Optional[int] = Query(None),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    q = db.query(Listing)
    if make:
        q = q.filter(Listing.brand.ilike(make))
    if model:
        q = q.filter(Listing.model.ilike(model))
    if min_year:
        q = q.filter(Listing.year >= min_year)
    if max_year:
        q = q.filter(Listing.year <= max_year)
    if min_price:
        q = q.filter(Listing.price >= min_price)
    if max_price:
        q = q.filter(Listing.price <= max_price)

    rows = q.order_by(Listing.id).offset(offset).limit(limit).all()
    return [_listing_to_summary(r) for r in rows]


@router.get("/brands")
def get_brands(db: Session = Depends(get_db)):
    rows = db.query(Listing.brand).distinct().order_by(Listing.brand).all()
    return {"brands": [r[0] for r in rows]}


@router.get("/{car_id}", response_model=CarListingDetail)
def get_car_by_id(car_id: int, db: Session = Depends(get_db)):
    row = db.query(Listing).filter(Listing.id == car_id).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Car with ID {car_id} not found")
    return _listing_to_detail(row)
