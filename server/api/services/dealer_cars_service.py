import logging
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from db.models import Dealer, DealerListing
from models.schemas import (
    DealerSummary,
    DealerCarListingSummary,
    DealerCarListingsResponse,
    DealersListResponse,
)
from api.services.constants import derive_model_used, derive_confidence_label

logger = logging.getLogger(__name__)


def _fmt_price(aed: Optional[int]) -> str:
    if aed is None:
        return "Price on Request"
    return f"د.إ {aed:,}"


def _fmt_mileage(kms: Optional[int]) -> str:
    if kms is None:
        return "N/A"
    return f"{kms:,} km"


def _dealer_listing_to_summary(row: DealerListing, dealer: Dealer) -> DealerCarListingSummary:
    return DealerCarListingSummary(
        id=row.id,
        make=row.brand,
        model=row.model,
        trim=row.trim,
        year=row.year,
        price=_fmt_price(row.price),
        predictedPrice=_fmt_price(row.predicted_price) if row.predicted_price else None,
        predictedPriceLgbm=_fmt_price(row.predicted_price_lgbm) if row.predicted_price_lgbm else None,
        modelUsed=derive_model_used(row.predicted_price_lgbm, row.price),
        dealLabel=row.deal_label,
        confidenceLabel=derive_confidence_label(row.sigma_log),
        mileage=_fmt_mileage(row.kms),
        location=row.location or "Dubai, UAE",
        image=row.image or "https://placehold.co/800x600/eee/555?text=No+Image",
        dealerName=dealer.name,
        dealerLogo=dealer.logo_url,
        dealerId=dealer.id,
    )


def list_dealers(db: Session) -> DealersListResponse:
    dealers = db.query(Dealer).order_by(Dealer.name).all()
    result = []
    for d in dealers:
        count = db.query(func.count(DealerListing.id)).filter(DealerListing.dealer_id == d.id).scalar() or 0
        result.append(DealerSummary(
            id=d.id,
            name=d.name,
            logoUrl=d.logo_url,
            location=d.location,
            phone=d.phone,
            listingCount=count,
        ))
    return DealersListResponse(dealers=result)


def get_dealer(db: Session, dealer_id: int) -> DealerSummary:
    d = db.query(Dealer).filter(Dealer.id == dealer_id).first()
    if not d:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Dealer not found")
    count = db.query(func.count(DealerListing.id)).filter(DealerListing.dealer_id == d.id).scalar() or 0
    return DealerSummary(
        id=d.id, name=d.name, logoUrl=d.logo_url,
        location=d.location, phone=d.phone, listingCount=count,
    )


def list_dealer_cars(
    db: Session,
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
    limit: int = 20,
    offset: int = 0,
) -> DealerCarListingsResponse:
    q = db.query(DealerListing).join(Dealer)

    if search:
        term = f"%{search}%"
        q = q.filter(
            (DealerListing.brand.ilike(term)) |
            (DealerListing.model.ilike(term)) |
            (DealerListing.trim.ilike(term))
        )
    if make:
        q = q.filter(DealerListing.brand.ilike(make))
    if model:
        q = q.filter(DealerListing.model.ilike(model))
    if trim:
        q = q.filter(DealerListing.trim.ilike(trim))
    if min_year:
        q = q.filter(DealerListing.year >= min_year)
    if max_year:
        q = q.filter(DealerListing.year <= max_year)
    if min_price:
        q = q.filter(DealerListing.price >= min_price)
    if max_price:
        q = q.filter(DealerListing.price <= max_price)
    if dealer_id:
        q = q.filter(DealerListing.dealer_id == dealer_id)
    if fuel_type:
        q = q.filter(DealerListing.fuel_type.ilike(fuel_type))

    total = q.count()

    order = {
        "newest": DealerListing.created_at.desc(),
        "oldest": DealerListing.created_at.asc(),
        "price-low": DealerListing.price.asc(),
        "price-high": DealerListing.price.desc(),
    }.get(sort, DealerListing.created_at.desc())
    q = q.order_by(order)

    rows = q.offset(offset).limit(limit).all()

    dealer_cache = {}
    listings = []
    for row in rows:
        if row.dealer_id not in dealer_cache:
            dealer_cache[row.dealer_id] = row.dealer
        listings.append(_dealer_listing_to_summary(row, dealer_cache[row.dealer_id]))

    return DealerCarListingsResponse(listings=listings, total=total)
