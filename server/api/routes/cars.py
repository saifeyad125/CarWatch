"""
Car listings endpoints – reads from Postgres via SQLAlchemy.
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import or_

from db.deps import get_db
from db.models import Listing, ModelAnalytics
from models.schemas import (
    CarListingSummary,
    CarListingDetail,
    Seller,
    MarketAnalysis,
    PricePoint,
    AnalysisResponse,
    DepreciationPoint,
    PriceMileagePoint,
    PriceYearPoint,
    Competitor,
)


router = APIRouter()


# ───── helpers ─────

def _fmt_price(aed: int) -> str:
    """Format integer AED price → 'د.إ 52,000' style string for the frontend."""
    return f"د.إ {aed:,}"

def _fmt_mileage(kms: Optional[int]) -> str:
    if kms is None:
        return "N/A"
    return f"{kms:,} km"


def _to_float(val) -> Optional[float]:
    """
    Convert a value to float for numeric comparison.
    - int/float → cast directly
    - Range strings like '100 - 199 HP' or '2,000 - 2,999 cc' → midpoint
    - Single-number strings like '4 door' → first number found
    """
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    import re
    nums = [float(n.replace(",", "")) for n in re.findall(r"[\d,]+(?:\.\d+)?", str(val))]
    if not nums:
        return None
    if len(nums) >= 2:
        return (nums[0] + nums[1]) / 2   # midpoint of range
    return nums[0]


def _norm_diff(a, b, scale: float) -> float:
    """Normalised absolute difference between two values. Returns 0 if either is None or non-numeric."""
    fa, fb = _to_float(a), _to_float(b)
    if fa is None or fb is None:
        return 0.0
    return abs(fa - fb) / scale


def _similarity_score(target: Listing, cand: Listing) -> float:
    """
    Compute a similarity score between two listings.
    Higher is more similar. Used to rank similar-listing candidates.
    """
    score = 0.0

    # Model match — dominant signal: a same-model result always beats a different-model one
    if target.model and cand.model and target.model.lower() == cand.model.lower():
        score += 10.0

    # Trim match (only meaningful when model already matches)
    if target.trim and cand.trim and target.trim.lower() == cand.trim.lower():
        score += 1.5

    # Categorical matches
    if target.body_type and cand.body_type and target.body_type == cand.body_type:
        score += 1.0
    if target.fuel_type and cand.fuel_type and target.fuel_type == cand.fuel_type:
        score += 1.0
    if target.regional_specs and cand.regional_specs == target.regional_specs:
        score += 0.5

    # Numeric closeness (penalties for divergence)
    score -= 2.0 * _norm_diff(target.year,       cand.year,       5)
    score -= 2.5 * _norm_diff(target.price,      cand.price,      50_000)
    score -= 1.8 * _norm_diff(target.kms,        cand.kms,        50_000)
    score -= 1.0 * _norm_diff(target.horsepower, cand.horsepower, 100)
    score -= 0.8 * _norm_diff(target.cylinders,  cand.cylinders,  2)

    return score


def _get_similar_listings(row: Listing, db: Session) -> List[CarListingSummary]:
    """
    Return the 3 most similar listings to `row` using a scoring function.
    Pulls all same-brand listings (up to 300), scores each, returns top 3.
    The SQL filter narrows to same brand; Python scoring handles the rest.
    """
    candidates = (
        db.query(Listing)
        .filter(
            Listing.id != row.id,
            Listing.brand == row.brand,
        )
        .limit(300)
        .all()
    )

    if not candidates:
        return []

    top3 = sorted(candidates, key=lambda c: _similarity_score(row, c), reverse=True)[:3]
    return [_listing_to_summary(r) for r in top3]

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
        source=getattr(row, 'source', 'dubizzle'),
    )


def _listing_to_detail(row: Listing, db: Session) -> CarListingDetail:
    """Convert DB Listing to full CarListingDetail with similar listings from DB."""
    
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
    
    # Market analysis from ML depreciation data
    dep = row.depreciation_data
    if dep and dep.get("projections"):
        current_pred = dep["current_price_predicted"]
        projs = dep["projections"]
        proj_map = {p["years_ahead"]: p["predicted_price"] for p in projs}

        def _pct_drop(future_price):
            if current_pred <= 0:
                return 0
            return max(0, round((1 - future_price / current_pred) * 100))

        one_yr_drop = _pct_drop(proj_map.get(1, current_pred))

        if one_yr_drop > 15:
            trend = "declining"
        elif one_yr_drop < 5:
            trend = "stable"
        else:
            trend = "moderate"

        market_analysis = MarketAnalysis(
            depreciation={
                "oneYear": one_yr_drop,
                "threeYear": _pct_drop(proj_map.get(3, current_pred)),
                "fiveYear": _pct_drop(proj_map.get(5, current_pred)),
            },
            marketTrend=trend,
            priceHistory=[
                PricePoint(month="Now", averagePrice=current_pred),
                PricePoint(month="+1 yr", averagePrice=proj_map.get(1, current_pred)),
                PricePoint(month="+3 yr", averagePrice=proj_map.get(3, current_pred)),
                PricePoint(month="+5 yr", averagePrice=proj_map.get(5, current_pred)),
            ],
        )
    else:
        # Fallback for listings without depreciation data
        base_price = row.price
        market_analysis = MarketAnalysis(
            depreciation={"oneYear": 12, "threeYear": 35, "fiveYear": 55},
            marketTrend="stable",
            priceHistory=[
                PricePoint(month="Now", averagePrice=base_price),
                PricePoint(month="+1 yr", averagePrice=int(base_price * 0.88)),
                PricePoint(month="+3 yr", averagePrice=int(base_price * 0.65)),
                PricePoint(month="+5 yr", averagePrice=int(base_price * 0.45)),
            ],
        )
    
    # Find the 3 most similar listings using scored similarity
    similar_listings = _get_similar_listings(row, db)
    
    return CarListingDetail(
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
        source=getattr(row, 'source', 'dubizzle'),
        images=row.images or [],
        description=description,
        seller=seller,
        url=row.url,
        features=features,
        marketAnalysis=market_analysis,
        similarListings=similar_listings,
    )


# ───── routes ─────

@router.get("", response_model=List[CarListingSummary])
def get_listings(
    search: Optional[str] = Query(None),
    make: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    min_year: Optional[int] = Query(None),
    max_year: Optional[int] = Query(None),
    min_price: Optional[int] = Query(None),
    max_price: Optional[int] = Query(None),
    source: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    q = db.query(Listing)
    if search:
        term = f"%{search}%"
        q = q.filter(or_(
            Listing.brand.ilike(term),
            Listing.model.ilike(term),
            Listing.location.ilike(term),
        ))
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
    if source:
        q = q.filter(Listing.source == source)

    rows = q.order_by(Listing.id.desc()).offset(offset).limit(limit).all()
    return [_listing_to_summary(r) for r in rows]


@router.get("/brands")
def get_brands(db: Session = Depends(get_db)):
    rows = db.query(Listing.brand).distinct().order_by(Listing.brand).all()
    return {"brands": [r[0] for r in rows]}


@router.get("/brands/{brand}/models")
def get_models_for_brand(brand: str, db: Session = Depends(get_db)):
    """Return distinct model names for a given brand (case-insensitive)."""
    rows = (
        db.query(Listing.model)
        .filter(Listing.brand.ilike(brand.strip()))
        .distinct()
        .order_by(Listing.model)
        .all()
    )
    return {"models": [r[0] for r in rows]}


@router.get("/{car_id}", response_model=CarListingDetail)
def get_car_by_id(car_id: int, db: Session = Depends(get_db)):
    row = db.query(Listing).filter(Listing.id == car_id).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Car with ID {car_id} not found")
    return _listing_to_detail(row, db)


@router.get("/{car_id}/analysis", response_model=AnalysisResponse)
def get_car_analysis(car_id: int, db: Session = Depends(get_db)):
    """Return full analysis data for a listing: depreciation curve + model chart data."""
    row = db.query(Listing).filter(Listing.id == car_id).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Car with ID {car_id} not found")

    # Depreciation curve from stored data
    dep = row.depreciation_data or {}
    current_pred = dep.get("current_price_predicted", row.predicted_price or row.price)
    annual_kms = dep.get("annual_kms", 0)
    projs = dep.get("projections", [])

    depreciation_curve = []
    for p in projs:
        retention = round((p["predicted_price"] / current_pred) * 100, 1) if current_pred > 0 else 0
        depreciation_curve.append(DepreciationPoint(
            yearsAhead=p["years_ahead"],
            projectedAge=p["projected_age"],
            projectedKms=p["projected_kms"],
            predictedPrice=p["predicted_price"],
            retentionPct=retention,
        ))

    # Chart data from model_analytics table
    analytics = db.query(ModelAnalytics).filter(
        ModelAnalytics.brand == row.brand,
        ModelAnalytics.model == row.model,
    ).first()

    if analytics and analytics.chart_data:
        chart = analytics.chart_data if isinstance(analytics.chart_data, dict) else {}
        price_vs_mileage = [PriceMileagePoint(**p) for p in chart.get("priceVsMileage", [])]
        price_vs_year = [PriceYearPoint(**p) for p in chart.get("priceVsYear", [])]
        competitors = [Competitor(**c) for c in chart.get("competitors", [])]
    else:
        price_vs_mileage = []
        price_vs_year = []
        competitors = []

    return AnalysisResponse(
        listingId=row.id,
        make=row.brand,
        model=row.model,
        year=row.year,
        currentPrice=row.price,
        predictedPrice=row.predicted_price or row.price,
        annualKms=annual_kms,
        depreciationCurve=depreciation_curve,
        priceVsMileage=price_vs_mileage,
        priceVsYear=price_vs_year,
        competitors=competitors,
    )
