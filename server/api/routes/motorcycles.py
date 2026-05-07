from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import distinct

from db.deps import get_db
from db.models import MotorcycleListing
from api.services.motorcycle_service import list_motorcycles, get_motorcycle_detail
from models.schemas import MotorcycleListingsResponse, MotorcycleListingDetail

router = APIRouter()


@router.get("", response_model=MotorcycleListingsResponse)
def browse_motorcycles(
    search: Optional[str] = None,
    make: Optional[str] = None,
    model: Optional[str] = None,
    motorcycle_type: Optional[str] = None,
    min_year: Optional[int] = None,
    max_year: Optional[int] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    fuel_type: Optional[str] = None,
    sort: str = "newest",
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return list_motorcycles(
        db, search=search, make=make, model=model,
        motorcycle_type=motorcycle_type,
        min_year=min_year, max_year=max_year,
        min_price=min_price, max_price=max_price,
        fuel_type=fuel_type, sort=sort, limit=limit, offset=offset,
    )


@router.get("/brands")
def get_motorcycle_brands(db: Session = Depends(get_db)):
    brands = db.query(distinct(MotorcycleListing.brand)).filter(MotorcycleListing.listing_status == "approved").order_by(MotorcycleListing.brand).all()
    return {"brands": [b[0] for b in brands]}


@router.get("/brands/{brand}/models")
def get_motorcycle_models(brand: str, db: Session = Depends(get_db)):
    models = (
        db.query(distinct(MotorcycleListing.model))
        .filter(MotorcycleListing.brand.ilike(brand), MotorcycleListing.listing_status == "approved")
        .order_by(MotorcycleListing.model)
        .all()
    )
    return {"models": [m[0] for m in models]}


@router.get("/{motorcycle_id}", response_model=MotorcycleListingDetail)
def get_motorcycle(motorcycle_id: int, db: Session = Depends(get_db)):
    return get_motorcycle_detail(db, motorcycle_id)
