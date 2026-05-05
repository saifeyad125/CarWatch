from collections import defaultdict
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional, List
from sqlalchemy.orm import Session, load_only
from sqlalchemy import or_

from db.deps import get_db
from db.models import Listing, ModelAnalytics
from api.services.constants import HYBRID_PRICE_THRESHOLD, derive_model_used, derive_confidence_label
from models.schemas import (
    CarListingSummary,
    CarListingsResponse,
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


# helpers 

def _fmt_price(aed: int) -> str:
    if aed is None:
        return "Price on Request"
    return f"د.إ {aed:,}"

def _fmt_mileage(kms: Optional[int]) -> str:
    if kms is None:
        return "N/A"
    return f"{kms:,} km"


def _to_float(val) -> Optional[float]:
    # handles range strings like '100 - 199 HP' -> midpoint
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
    fa, fb = _to_float(a), _to_float(b)
    if fa is None or fb is None:
        return 0.0
    return abs(fa - fb) / scale


def _similarity_score(target: Listing, cand: Listing) -> float:
    # higher = more similar
    score = 0.0

    # Model match (most important), same model result always beat a different model 
    if target.model and cand.model and target.model.lower() == cand.model.lower():
        score += 10.0

    # Trim match (only meaningful when model already matches)
    if target.trim and cand.trim and target.trim.lower() == cand.trim.lower():
        score += 1.5

    # Category match
    if target.body_type and cand.body_type and target.body_type == cand.body_type:
        score += 1.0
    if target.fuel_type and cand.fuel_type and target.fuel_type == cand.fuel_type:
        score += 1.0
    if target.regional_specs and cand.regional_specs == target.regional_specs:
        score += 0.5

    # Num closeness (penalties for divergence)
    score -= 2.0 * _norm_diff(target.year,       cand.year,       5)
    score -= 2.5 * _norm_diff(target.price,      cand.price,      50_000)
    score -= 1.8 * _norm_diff(target.kms,        cand.kms,        50_000)
    score -= 1.0 * _norm_diff(target.horsepower, cand.horsepower, 100)
    score -= 0.8 * _norm_diff(target.cylinders,  cand.cylinders,  2)

    return score


def _get_similar_listings(row: Listing, db: Session) -> List[CarListingSummary]:
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

def _derive_model_used(row: Listing) -> str:
    return derive_model_used(row.predicted_price_lgbm, row.price)


def _derive_confidence_label(sigma_log) -> str | None:
    return derive_confidence_label(sigma_log)


def _listing_to_summary(row: Listing) -> CarListingSummary:
    return CarListingSummary(
        id=row.id,
        make=row.brand,
        model=row.model,
        trim=row.trim,
        year=row.year,
        price=_fmt_price(row.price),
        predictedPrice=_fmt_price(row.predicted_price) if row.predicted_price else None,
        predictedPriceLgbm=_fmt_price(row.predicted_price_lgbm) if row.predicted_price_lgbm else None,
        modelUsed=_derive_model_used(row),
        dealLabel=row.deal_label,
        confidenceLabel=_derive_confidence_label(row.sigma_log),
        mileage=_fmt_mileage(row.kms),
        location=row.location or "Dubai, UAE",
        image=row.image or "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&h=600&fit=crop",
        source=getattr(row, 'source', 'dubizzle'),
    )


def _listing_to_detail(row: Listing, db: Session) -> CarListingDetail:
    
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
        market_analysis = None
    
    similar_listings = _get_similar_listings(row, db)
    
    return CarListingDetail(
        id=row.id,
        make=row.brand,
        model=row.model,
        trim=row.trim,
        year=row.year,
        price=_fmt_price(row.price),
        predictedPrice=_fmt_price(row.predicted_price) if row.predicted_price else None,
        predictedPriceLgbm=_fmt_price(row.predicted_price_lgbm) if row.predicted_price_lgbm else None,
        modelUsed=_derive_model_used(row),
        dealLabel=row.deal_label,
        confidenceLabel=_derive_confidence_label(row.sigma_log),
        confidenceLow=_fmt_price(row.confidence_low) if (row.confidence_low and _derive_model_used(row) == "CatBoost") else None,
        confidenceHigh=_fmt_price(row.confidence_high) if (row.confidence_high and _derive_model_used(row) == "CatBoost") else None,
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


# routes 

@router.get("", response_model=CarListingsResponse)
def get_listings(
    search: Optional[str] = Query(None, max_length=200),
    make: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    trim: Optional[str] = Query(None),
    min_year: Optional[int] = Query(None),
    max_year: Optional[int] = Query(None),
    min_price: Optional[int] = Query(None),
    max_price: Optional[int] = Query(None),
    sort: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    fuel_type: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    q = db.query(Listing)
    if search:
        search = search.replace('\x00', '')
        tokens = search.strip().split()
        for token in tokens:
            term = f"%{token}%"
            q = q.filter(or_(
                Listing.brand.ilike(term),
                Listing.model.ilike(term),
                Listing.trim.ilike(term),
                Listing.location.ilike(term),
            ))
    if make:
        q = q.filter(Listing.brand.ilike(make))
    if model:
        q = q.filter(Listing.model.ilike(model))
    if trim:
        q = q.filter(Listing.trim.ilike(trim))
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
    if fuel_type:
        q = q.filter(Listing.fuel_type.ilike(fuel_type))

    total = q.count()
    if sort == "newest":
        rows = q.order_by(Listing.created_at.desc()).offset(offset).limit(limit).all()
    elif sort == "price-low":
        rows = q.order_by(Listing.price.asc()).offset(offset).limit(limit).all()
    elif sort == "price-high":
        rows = q.order_by(Listing.price.desc()).offset(offset).limit(limit).all()
    elif sort == "oldest":
        rows = q.order_by(Listing.year.asc(), Listing.id.desc()).offset(offset).limit(limit).all()
    else:
        rows = q.order_by(Listing.year.desc(), Listing.id.desc()).offset(offset).limit(limit).all()
    return CarListingsResponse(
        listings=[_listing_to_summary(r) for r in rows],
        total=total,
    )


@router.get("/brands")
def get_brands(db: Session = Depends(get_db)):
    rows = db.query(Listing.brand).distinct().order_by(Listing.brand).all()
    return {"brands": [r[0] for r in rows]}


@router.get("/brands/{brand}/models")
def get_models_for_brand(brand: str, db: Session = Depends(get_db)):
    rows = (
        db.query(Listing.model)
        .filter(Listing.brand.ilike(brand.strip()))
        .distinct()
        .order_by(Listing.model)
        .all()
    )
    return {"models": [r[0] for r in rows]}


@router.get("/brands/{brand}/models/{model}/trims")
def get_trims_for_model(brand: str, model: str, db: Session = Depends(get_db)):
    rows = (
        db.query(Listing.trim)
        .filter(
            Listing.brand.ilike(brand.strip()),
            Listing.model.ilike(model.strip()),
            Listing.trim.isnot(None),
            Listing.trim != "",
        )
        .distinct()
        .order_by(Listing.trim)
        .all()
    )
    return {"trims": [r[0] for r in rows]}


@router.get("/{car_id}", response_model=CarListingDetail)
def get_car_by_id(car_id: int, db: Session = Depends(get_db)):
    row = db.query(Listing).filter(Listing.id == car_id).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Car with ID {car_id} not found")
    return _listing_to_detail(row, db)


@router.get("/{car_id}/analysis", response_model=AnalysisResponse)
def get_car_analysis(car_id: int, db: Session = Depends(get_db)):
    row = db.query(Listing).filter(Listing.id == car_id).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Car with ID {car_id} not found")

    # depreciation curve from stored data
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

    # chart data from model_analytics table (keep priceVsMileage and priceVsYear)
    analytics = db.query(ModelAnalytics).filter(
        ModelAnalytics.brand == row.brand,
        ModelAnalytics.model == row.model,
    ).first()

    if not analytics or not analytics.chart_data:
        analytics = db.query(ModelAnalytics).filter(
            ModelAnalytics.brand == row.brand,
            ModelAnalytics.model == "__brand__",
        ).first()

    if analytics and analytics.chart_data:
        chart = analytics.chart_data if isinstance(analytics.chart_data, dict) else {}
        price_vs_mileage = [PriceMileagePoint(**p) for p in chart.get("priceVsMileage", [])]
        price_vs_year = [PriceYearPoint(**p) for p in chart.get("priceVsYear", [])]
    else:
        price_vs_mileage = []
        price_vs_year = []

    all_candidates = (
        db.query(Listing)
        .options(load_only(
            Listing.id, Listing.brand, Listing.model, Listing.trim,
            Listing.year, Listing.price, Listing.kms, Listing.body_type,
            Listing.fuel_type, Listing.regional_specs, Listing.horsepower,
            Listing.cylinders, Listing.predicted_price, Listing.predicted_price_lgbm,
            Listing.deal_label, Listing.sigma_log, Listing.image,
            Listing.location, Listing.source,
        ))
        .filter(Listing.id != row.id)
        .order_by(Listing.id.desc())
        .limit(500)
        .all()
    )

    if all_candidates:
        scored = sorted(all_candidates, key=lambda c: _similarity_score(row, c), reverse=True)[:30]
        groups: dict = defaultdict(list)
        for c in scored:
            key = (c.brand, c.model)
            groups[key].append(c)

        competitors = []
        for (brand, model), members in sorted(groups.items(), key=lambda x: -len(x[1])):
            if brand == row.brand and model == row.model:
                continue
            competitors.append(Competitor(
                brand=brand,
                model=model,
                avgPrice=int(sum(m.price for m in members) / len(members)),
                avgKms=int(sum((m.kms or 0) for m in members) / len(members)),
                avgYear=int(sum(m.year for m in members) / len(members)),
                count=len(members),
                listings=[_listing_to_summary(m) for m in members],
            ))
            if len(competitors) >= 5:
                break
    else:
        competitors = []

    return AnalysisResponse(
        listingId=row.id,
        make=row.brand,
        model=row.model,
        trim=row.trim,
        year=row.year,
        currentPrice=row.price,
        predictedPrice=row.predicted_price or row.price,
        annualKms=annual_kms,
        depreciationCurve=depreciation_curve,
        priceVsMileage=price_vs_mileage,
        priceVsYear=price_vs_year,
        competitors=competitors,
    )
