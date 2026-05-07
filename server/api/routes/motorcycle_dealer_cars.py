from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import distinct

from db.deps import get_db
from db.models import DealerMotorcycleListing
from api.services.motorcycle_service import (
    list_dealer_motorcycles,
    get_dealer_motorcycle_detail,
)
from models.schemas import DealerMotorcycleListingsResponse

router = APIRouter()


@router.get("", response_model=DealerMotorcycleListingsResponse)
def browse_dealer_motorcycles(
    search: Optional[str] = None,
    make: Optional[str] = None,
    model: Optional[str] = None,
    motorcycle_type: Optional[str] = None,
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
    return list_dealer_motorcycles(
        db, search=search, make=make, model=model,
        motorcycle_type=motorcycle_type,
        min_year=min_year, max_year=max_year,
        min_price=min_price, max_price=max_price,
        dealer_id=dealer_id, fuel_type=fuel_type,
        sort=sort, limit=limit, offset=offset,
    )


@router.get("/brands")
def get_dealer_motorcycle_brands(db: Session = Depends(get_db)):
    brands = (
        db.query(distinct(DealerMotorcycleListing.brand))
        .order_by(DealerMotorcycleListing.brand)
        .all()
    )
    return {"brands": [b[0] for b in brands]}


@router.get("/brands/{brand}/models")
def get_dealer_motorcycle_models(brand: str, db: Session = Depends(get_db)):
    models = (
        db.query(distinct(DealerMotorcycleListing.model))
        .filter(DealerMotorcycleListing.brand.ilike(brand))
        .order_by(DealerMotorcycleListing.model)
        .all()
    )
    return {"models": [m[0] for m in models]}


@router.get("/{listing_id}")
def get_dealer_motorcycle(listing_id: int, db: Session = Depends(get_db)):
    return get_dealer_motorcycle_detail(db, listing_id)
