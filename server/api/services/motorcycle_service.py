import logging
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from db.models import MotorcycleListing, MotorcycleDealer, DealerMotorcycleListing
from models.schemas import (
    MotorcycleListingSummary,
    MotorcycleListingsResponse,
    MotorcycleListingDetail,
    DealerMotorcycleListingSummary,
    DealerMotorcycleListingsResponse,
    MotorcycleDealerSummary,
    MotorcycleDealersListResponse,
    Seller,
)

logger = logging.getLogger(__name__)


def _fmt_price(aed: Optional[int]) -> str:
    if aed is None:
        return "Price on Request"
    return f"د.إ {aed:,}"


def _fmt_mileage(kms: Optional[int]) -> str:
    if kms is None:
        return "N/A"
    return f"{kms:,} km"


def _motorcycle_to_summary(row: MotorcycleListing) -> MotorcycleListingSummary:
    return MotorcycleListingSummary(
        id=row.id,
        make=row.brand,
        model=row.model,
        trim=row.trim,
        year=row.year,
        price=_fmt_price(row.price),
        mileage=_fmt_mileage(row.kms),
        location=row.location or "Dubai, UAE",
        image=row.image or "https://placehold.co/800x600/eee/555?text=No+Image",
        source=row.source,
        engineCc=row.engine_cc,
        motorcycleType=row.motorcycle_type,
    )


def _dealer_motorcycle_to_summary(
    row: DealerMotorcycleListing, dealer: MotorcycleDealer
) -> DealerMotorcycleListingSummary:
    return DealerMotorcycleListingSummary(
        id=row.id,
        make=row.brand,
        model=row.model,
        trim=row.trim,
        year=row.year,
        price=_fmt_price(row.price),
        mileage=_fmt_mileage(row.kms),
        location=row.location or "Dubai, UAE",
        image=row.image or "https://placehold.co/800x600/eee/555?text=No+Image",
        source="dealer",
        engineCc=row.engine_cc,
        motorcycleType=row.motorcycle_type,
        dealerName=dealer.name,
        dealerLogo=dealer.logo_url,
        dealerId=dealer.id,
    )


def list_motorcycles(
    db: Session,
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
    limit: int = 20,
    offset: int = 0,
) -> MotorcycleListingsResponse:
    q = db.query(MotorcycleListing)
    q = q.filter(MotorcycleListing.listing_status == "approved")

    if search:
        term = f"%{search}%"
        q = q.filter(
            (MotorcycleListing.brand.ilike(term))
            | (MotorcycleListing.model.ilike(term))
            | (MotorcycleListing.trim.ilike(term))
        )
    if make:
        q = q.filter(MotorcycleListing.brand.ilike(make))
    if model:
        q = q.filter(MotorcycleListing.model.ilike(model))
    if motorcycle_type:
        q = q.filter(MotorcycleListing.motorcycle_type.ilike(motorcycle_type))
    if min_year:
        q = q.filter(MotorcycleListing.year >= min_year)
    if max_year:
        q = q.filter(MotorcycleListing.year <= max_year)
    if min_price:
        q = q.filter(MotorcycleListing.price >= min_price)
    if max_price:
        q = q.filter(MotorcycleListing.price <= max_price)
    if fuel_type:
        q = q.filter(MotorcycleListing.fuel_type.ilike(fuel_type))

    total = q.count()

    order = {
        "newest": MotorcycleListing.created_at.desc(),
        "oldest": MotorcycleListing.created_at.asc(),
        "price-low": MotorcycleListing.price.asc(),
        "price-high": MotorcycleListing.price.desc(),
    }.get(sort, MotorcycleListing.created_at.desc())
    q = q.order_by(order)

    rows = q.offset(offset).limit(limit).all()
    return MotorcycleListingsResponse(
        listings=[_motorcycle_to_summary(r) for r in rows],
        total=total,
    )


def get_motorcycle_detail(db: Session, motorcycle_id: int) -> MotorcycleListingDetail:
    from fastapi import HTTPException

    row = db.query(MotorcycleListing).filter(MotorcycleListing.id == motorcycle_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Motorcycle listing not found")
    if row.listing_status != "approved":
        raise HTTPException(status_code=404, detail="Motorcycle listing not found")

    features = []
    if row.engine_cc:
        features.append(f"{row.engine_cc}cc Engine")
    if row.motorcycle_type:
        features.append(row.motorcycle_type)
    if row.horsepower:
        features.append(f"{row.horsepower}hp")
    if row.fuel_type:
        features.append(row.fuel_type.title())
    if row.exterior_color:
        features.append(f"{row.exterior_color} Exterior")
    if row.regional_specs:
        features.append(f"{row.regional_specs} Specs")

    if row.description:
        description = row.description
    else:
        description = f"{row.year} {row.brand} {row.model}"
        if row.trim:
            description += f" {row.trim}"
        if row.engine_cc:
            description += f" with a {row.engine_cc}cc engine"
        if row.kms:
            description += f", {row.kms:,} km on the odometer"
        description += ". Well-maintained and ready to ride."

    if row.is_user_submitted and (row.seller_name or row.seller_phone):
        seller = Seller(
            name=row.seller_name or "Private Seller",
            avatar=f"https://api.dicebear.com/7.x/avataaars/svg?seed={row.seller_name or 'seller'}",
            phone=row.seller_phone or "Contact via listing",
            type="Private Seller",
        )
    else:
        seller = Seller(
            name="Private Seller",
            avatar="https://placehold.co/100x100/eee/555?text=Seller",
            phone="+971 50 000 0000",
            type="Private",
        )

    return MotorcycleListingDetail(
        id=row.id,
        make=row.brand,
        model=row.model,
        trim=row.trim,
        year=row.year,
        price=_fmt_price(row.price),
        mileage=_fmt_mileage(row.kms),
        location=row.location or "Dubai, UAE",
        image=row.image or "https://placehold.co/800x600/eee/555?text=No+Image",
        source=row.source,
        engineCc=row.engine_cc,
        motorcycleType=row.motorcycle_type,
        description=description,
        features=features,
        images=row.images or ([row.image] if row.image else []),
        seller=seller,
    )


def list_dealer_motorcycles(
    db: Session,
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
    limit: int = 20,
    offset: int = 0,
) -> DealerMotorcycleListingsResponse:
    q = db.query(DealerMotorcycleListing).join(MotorcycleDealer)

    if search:
        term = f"%{search}%"
        q = q.filter(
            (DealerMotorcycleListing.brand.ilike(term))
            | (DealerMotorcycleListing.model.ilike(term))
            | (DealerMotorcycleListing.trim.ilike(term))
        )
    if make:
        q = q.filter(DealerMotorcycleListing.brand.ilike(make))
    if model:
        q = q.filter(DealerMotorcycleListing.model.ilike(model))
    if motorcycle_type:
        q = q.filter(DealerMotorcycleListing.motorcycle_type.ilike(motorcycle_type))
    if min_year:
        q = q.filter(DealerMotorcycleListing.year >= min_year)
    if max_year:
        q = q.filter(DealerMotorcycleListing.year <= max_year)
    if min_price:
        q = q.filter(DealerMotorcycleListing.price >= min_price)
    if max_price:
        q = q.filter(DealerMotorcycleListing.price <= max_price)
    if dealer_id:
        q = q.filter(DealerMotorcycleListing.dealer_id == dealer_id)
    if fuel_type:
        q = q.filter(DealerMotorcycleListing.fuel_type.ilike(fuel_type))

    total = q.count()

    order = {
        "newest": DealerMotorcycleListing.created_at.desc(),
        "oldest": DealerMotorcycleListing.created_at.asc(),
        "price-low": DealerMotorcycleListing.price.asc(),
        "price-high": DealerMotorcycleListing.price.desc(),
    }.get(sort, DealerMotorcycleListing.created_at.desc())
    q = q.order_by(order)

    rows = q.offset(offset).limit(limit).all()
    dealer_cache = {}
    listings = []
    for row in rows:
        if row.dealer_id not in dealer_cache:
            dealer_cache[row.dealer_id] = row.dealer
        listings.append(_dealer_motorcycle_to_summary(row, dealer_cache[row.dealer_id]))

    return DealerMotorcycleListingsResponse(listings=listings, total=total)


def get_dealer_motorcycle_detail(db: Session, listing_id: int) -> dict:
    from fastapi import HTTPException

    row = db.query(DealerMotorcycleListing).filter(DealerMotorcycleListing.id == listing_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Dealer motorcycle listing not found")

    dealer = row.dealer
    images = row.images or ([row.image] if row.image else [])

    features = []
    if row.engine_cc:
        features.append(f"{row.engine_cc}cc Engine")
    if row.motorcycle_type:
        features.append(row.motorcycle_type)
    if row.horsepower:
        features.append(f"{row.horsepower}hp")
    if row.fuel_type:
        features.append(row.fuel_type.title())
    if row.exterior_color:
        features.append(f"{row.exterior_color} Exterior")
    if row.regional_specs:
        features.append(f"{row.regional_specs} Specs")

    return {
        "id": row.id,
        "make": row.brand,
        "model": row.model,
        "trim": row.trim,
        "year": row.year,
        "price": _fmt_price(row.price),
        "priceRaw": row.price,
        "mileage": _fmt_mileage(row.kms),
        "location": row.location or "Dubai, UAE",
        "image": row.image or "https://placehold.co/800x600/eee/555?text=No+Image",
        "images": images,
        "engineCc": row.engine_cc,
        "motorcycleType": row.motorcycle_type,
        "description": row.description or f"{row.year} {row.brand} {row.model} available at {dealer.name}.",
        "features": features,
        "dealer": {
            "id": dealer.id,
            "name": dealer.name,
            "logoUrl": dealer.logo_url,
            "location": dealer.location,
            "phone": dealer.phone,
        },
    }


def list_motorcycle_dealers(db: Session) -> MotorcycleDealersListResponse:
    dealers = db.query(MotorcycleDealer).order_by(MotorcycleDealer.name).all()
    result = []
    for d in dealers:
        count = (
            db.query(func.count(DealerMotorcycleListing.id))
            .filter(DealerMotorcycleListing.dealer_id == d.id)
            .scalar()
            or 0
        )
        result.append(
            MotorcycleDealerSummary(
                id=d.id,
                name=d.name,
                logoUrl=d.logo_url,
                location=d.location,
                phone=d.phone,
                listingCount=count,
            )
        )
    return MotorcycleDealersListResponse(dealers=result)


def get_motorcycle_dealer(db: Session, dealer_id: int) -> MotorcycleDealerSummary:
    from fastapi import HTTPException

    d = db.query(MotorcycleDealer).filter(MotorcycleDealer.id == dealer_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Motorcycle dealer not found")
    count = (
        db.query(func.count(DealerMotorcycleListing.id))
        .filter(DealerMotorcycleListing.dealer_id == d.id)
        .scalar()
        or 0
    )
    return MotorcycleDealerSummary(
        id=d.id,
        name=d.name,
        logoUrl=d.logo_url,
        location=d.location,
        phone=d.phone,
        listingCount=count,
    )
