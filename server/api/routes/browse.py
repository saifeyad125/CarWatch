from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from db.deps import get_db
from db.models import Listing, DealerListing, Dealer, Part, PartCategory, PartCompatibility
from api.services.constants import derive_model_used, derive_confidence_label

router = APIRouter()


def _fmt_price(aed: Optional[int]) -> str:
    if aed is None:
        return "Price on Request"
    return f"د.إ {aed:,}"


def _fmt_mileage(kms: Optional[int]) -> str:
    if kms is None:
        return "N/A"
    return f"{kms:,} km"


@router.get("/counts")
def browse_counts(db: Session = Depends(get_db)):
    used = db.query(func.count(Listing.id)).scalar() or 0
    dealer = db.query(func.count(DealerListing.id)).scalar() or 0
    parts = db.query(func.count(Part.id)).scalar() or 0
    return {"used_cars": used, "dealer_cars": dealer, "parts": parts}


@router.get("/search")
def cross_category_search(q: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    term = f"%{q}%"
    per_group = 3

    used_q = db.query(Listing).filter(
        (Listing.brand.ilike(term)) | (Listing.model.ilike(term))
    )
    used_total = used_q.count()
    used_rows = used_q.order_by(Listing.created_at.desc()).limit(per_group).all()
    used_results = [
        {
            "id": r.id, "brand": r.brand, "model": r.model, "year": r.year,
            "price": _fmt_price(r.price), "image": r.image or "",
            "location": r.location or "Dubai, UAE",
            "dealLabel": r.deal_label, "mileage": _fmt_mileage(r.kms),
        }
        for r in used_rows
    ]

    dealer_q = db.query(DealerListing).join(Dealer).filter(
        (DealerListing.brand.ilike(term)) | (DealerListing.model.ilike(term))
    )
    dealer_total = dealer_q.count()
    dealer_rows = dealer_q.order_by(DealerListing.created_at.desc()).limit(per_group).all()
    dealer_results = [
        {
            "id": r.id, "brand": r.brand, "model": r.model, "year": r.year,
            "price": _fmt_price(r.price), "image": r.image or "",
            "dealerName": r.dealer.name, "dealerLogo": r.dealer.logo_url,
            "location": r.location or "Dubai, UAE",
        }
        for r in dealer_rows
    ]

    parts_q = db.query(Part).filter(Part.name.ilike(term))
    parts_total = parts_q.count()
    parts_rows = parts_q.order_by(Part.created_at.desc()).limit(per_group).all()
    parts_results = []
    for p in parts_rows:
        cat = db.query(PartCategory).filter(PartCategory.id == p.category_id).first()
        breadcrumb = ""
        if cat:
            crumbs = []
            current = cat
            while current:
                crumbs.append(current.name)
                current = db.query(PartCategory).filter(PartCategory.id == current.parent_id).first() if current.parent_id else None
            crumbs.reverse()
            breadcrumb = " > ".join(crumbs)
        parts_results.append({
            "id": p.id, "name": p.name, "price": _fmt_price(p.price),
            "image": p.image, "sellerName": p.seller_name,
            "categoryBreadcrumb": breadcrumb,
        })

    return {
        "used_cars": {"results": used_results, "total": used_total},
        "dealer_cars": {"results": dealer_results, "total": dealer_total},
        "parts": {"results": parts_results, "total": parts_total},
    }
