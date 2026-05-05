from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import distinct

from db.deps import get_db
from db.models import Dealer, DealerListing
from api.services.dealer_cars_service import list_dealer_cars, _dealer_listing_to_summary, _fmt_price, _fmt_mileage
from api.services.constants import derive_model_used, derive_confidence_label
from models.schemas import DealerCarListingsResponse

router = APIRouter()


@router.get("")
def browse_dealer_cars(
    search: Optional[str] = None,
    make: Optional[str] = None,
    model: Optional[str] = None,
    trim: Optional[str] = None,
    min_year: Optional[int] = None,
    max_year: Optional[int] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    dealer_id: Optional[int] = None,
    fuel_type: Optional[str] = None,
    sort: str = "newest",
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return list_dealer_cars(
        db, search=search, make=make, model=model, trim=trim,
        min_year=min_year, max_year=max_year,
        min_price=min_price, max_price=max_price,
        dealer_id=dealer_id, fuel_type=fuel_type, sort=sort, limit=limit, offset=offset,
    )


@router.get("/brands")
def get_dealer_car_brands(db: Session = Depends(get_db)):
    brands = db.query(distinct(DealerListing.brand)).order_by(DealerListing.brand).all()
    return {"brands": [b[0] for b in brands]}


@router.get("/brands/{brand}/models")
def get_dealer_car_models(brand: str, db: Session = Depends(get_db)):
    models = (
        db.query(distinct(DealerListing.model))
        .filter(DealerListing.brand.ilike(brand))
        .order_by(DealerListing.model)
        .all()
    )
    return {"models": [m[0] for m in models]}


@router.get("/brands/{brand}/models/{model}/trims")
def get_dealer_car_trims(brand: str, model: str, db: Session = Depends(get_db)):
    trims = (
        db.query(distinct(DealerListing.trim))
        .filter(DealerListing.brand.ilike(brand), DealerListing.model.ilike(model))
        .filter(DealerListing.trim.isnot(None))
        .order_by(DealerListing.trim)
        .all()
    )
    return {"trims": [t[0] for t in trims]}


@router.get("/{car_id}")
def get_dealer_car_detail(car_id: int, db: Session = Depends(get_db)):
    row = db.query(DealerListing).filter(DealerListing.id == car_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Dealer listing not found")

    dealer = row.dealer
    images = row.images or ([row.image] if row.image else [])

    features = []
    if row.fuel_type:
        features.append(f"Fuel: {row.fuel_type}")
    if row.body_type:
        features.append(f"Body: {row.body_type}")
    if row.cylinders:
        features.append(f"Cylinders: {row.cylinders}")
    if row.horsepower:
        features.append(f"Power: {row.horsepower}")
    if row.engine_capacity:
        features.append(f"Engine: {row.engine_capacity}")
    if row.steering_side:
        features.append(f"Steering: {row.steering_side}")
    if row.regional_specs:
        features.append(f"Specs: {row.regional_specs}")
    if row.interior_color:
        features.append(f"Interior: {row.interior_color}")
    if row.exterior_color:
        features.append(f"Exterior: {row.exterior_color}")
    if row.doors:
        features.append(f"Doors: {row.doors}")
    if row.seating_capacity:
        features.append(f"Seats: {row.seating_capacity}")

    confidence_label = derive_confidence_label(row.sigma_log)

    return {
        "id": row.id,
        "make": row.brand,
        "model": row.model,
        "trim": row.trim,
        "year": row.year,
        "price": _fmt_price(row.price),
        "priceRaw": row.price,
        "predictedPrice": _fmt_price(row.predicted_price) if row.predicted_price else None,
        "predictedPriceLgbm": _fmt_price(row.predicted_price_lgbm) if row.predicted_price_lgbm else None,
        "modelUsed": derive_model_used(row.predicted_price_lgbm, row.price),
        "dealLabel": row.deal_label,
        "confidenceLabel": confidence_label,
        "confidenceLow": _fmt_price(row.confidence_low) if row.confidence_low else None,
        "confidenceHigh": _fmt_price(row.confidence_high) if row.confidence_high else None,
        "mileage": _fmt_mileage(row.kms),
        "location": row.location or "Dubai, UAE",
        "image": row.image or "https://placehold.co/800x600/eee/555?text=No+Image",
        "images": images,
        "description": row.description or f"{row.year} {row.brand} {row.model} available at {dealer.name}.",
        "features": features,
        "depreciation": row.depreciation_data,
        "dealer": {
            "id": dealer.id,
            "name": dealer.name,
            "logoUrl": dealer.logo_url,
            "location": dealer.location,
            "phone": dealer.phone,
        },
    }
