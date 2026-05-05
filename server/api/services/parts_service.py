import logging
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from db.models import Part, PartCategory, PartCompatibility

logger = logging.getLogger(__name__)


def _fmt_price(aed: Optional[int]) -> str:
    if aed is None:
        return "Price on Request"
    return f"د.إ {aed:,}"


def _build_breadcrumb(db: Session, category: PartCategory) -> list[dict]:
    crumbs = []
    current = category
    while current:
        crumbs.append({"id": current.id, "name": current.name, "slug": current.slug, "icon": current.icon})
        if current.parent_id:
            current = db.query(PartCategory).filter(PartCategory.id == current.parent_id).first()
        else:
            current = None
    crumbs.reverse()
    return crumbs


def _breadcrumb_string(db: Session, category: PartCategory) -> str:
    crumbs = _build_breadcrumb(db, category)
    return " > ".join(c["name"] for c in crumbs)


def _compact_compatibility(compatibilities: list[PartCompatibility]) -> str:
    if not compatibilities:
        return ""
    first = compatibilities[0]
    label = f"{first.brand} {first.model}"
    if first.year_from and first.year_to:
        label += f" {first.year_from}-{str(first.year_to)[-2:]}"
    remaining = len(compatibilities) - 1
    if remaining > 0:
        label += f" +{remaining} more"
    return label


def _count_parts_recursive(db: Session, category_id: int) -> int:
    direct = db.query(func.count(Part.id)).filter(Part.category_id == category_id).scalar() or 0
    children = db.query(PartCategory.id).filter(PartCategory.parent_id == category_id).all()
    for (child_id,) in children:
        direct += _count_parts_recursive(db, child_id)
    return direct


def get_categories(db: Session, parent_id: Optional[int] = None) -> list[dict]:
    if parent_id is None:
        cats = db.query(PartCategory).filter(PartCategory.parent_id == None).order_by(PartCategory.sort_order).all()
    else:
        cats = db.query(PartCategory).filter(PartCategory.parent_id == parent_id).order_by(PartCategory.sort_order).all()

    result = []
    for c in cats:
        result.append({
            "id": c.id,
            "name": c.name,
            "slug": c.slug,
            "icon": c.icon,
            "parentId": c.parent_id,
            "partCount": _count_parts_recursive(db, c.id),
        })
    return result


def get_category_detail(db: Session, category_id: int) -> dict:
    cat = db.query(PartCategory).filter(PartCategory.id == category_id).first()
    if not cat:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Category not found")

    children = get_categories(db, parent_id=category_id)
    breadcrumb = _build_breadcrumb(db, cat)

    parts = db.query(Part).filter(Part.category_id == category_id).order_by(Part.created_at.desc()).all()
    part_summaries = []
    for p in parts:
        compats = db.query(PartCompatibility).filter(PartCompatibility.part_id == p.id).all()
        part_summaries.append({
            "id": p.id,
            "name": p.name,
            "price": _fmt_price(p.price),
            "image": p.image,
            "sellerName": p.seller_name,
            "categoryBreadcrumb": _breadcrumb_string(db, cat),
            "compatibleCars": _compact_compatibility(compats),
        })

    return {
        "category": {
            "id": cat.id,
            "name": cat.name,
            "slug": cat.slug,
            "icon": cat.icon,
            "parentId": cat.parent_id,
            "partCount": _count_parts_recursive(db, cat.id),
        },
        "breadcrumb": breadcrumb,
        "children": children,
        "parts": part_summaries,
    }


def list_parts(
    db: Session,
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    brand: Optional[str] = None,
    model: Optional[str] = None,
    seller_name: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
) -> dict:
    q = db.query(Part)

    if search:
        q = q.filter(Part.name.ilike(f"%{search}%"))
    if category_id:
        all_cat_ids = _get_descendant_ids(db, category_id)
        q = q.filter(Part.category_id.in_(all_cat_ids))
    if min_price:
        q = q.filter(Part.price >= min_price)
    if max_price:
        q = q.filter(Part.price <= max_price)
    if seller_name:
        q = q.filter(Part.seller_name.ilike(f"%{seller_name}%"))
    if brand or model:
        part_ids_q = db.query(PartCompatibility.part_id)
        if brand:
            part_ids_q = part_ids_q.filter(PartCompatibility.brand.ilike(brand))
        if model:
            part_ids_q = part_ids_q.filter(PartCompatibility.model.ilike(model))
        q = q.filter(Part.id.in_(part_ids_q))

    total = q.count()
    rows = q.order_by(Part.created_at.desc()).offset(offset).limit(limit).all()

    parts = []
    for p in rows:
        cat = db.query(PartCategory).filter(PartCategory.id == p.category_id).first()
        compats = db.query(PartCompatibility).filter(PartCompatibility.part_id == p.id).all()
        parts.append({
            "id": p.id,
            "name": p.name,
            "price": _fmt_price(p.price),
            "image": p.image,
            "sellerName": p.seller_name,
            "categoryBreadcrumb": _breadcrumb_string(db, cat) if cat else "",
            "compatibleCars": _compact_compatibility(compats),
        })

    return {"parts": parts, "total": total}


def _get_descendant_ids(db: Session, category_id: int) -> list[int]:
    ids = [category_id]
    children = db.query(PartCategory.id).filter(PartCategory.parent_id == category_id).all()
    for (child_id,) in children:
        ids.extend(_get_descendant_ids(db, child_id))
    return ids


def get_part_detail(db: Session, part_id: int) -> dict:
    p = db.query(Part).filter(Part.id == part_id).first()
    if not p:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Part not found")

    cat = db.query(PartCategory).filter(PartCategory.id == p.category_id).first()
    breadcrumb = _build_breadcrumb(db, cat) if cat else []
    compats = db.query(PartCompatibility).filter(PartCompatibility.part_id == p.id).all()
    images = p.images or ([p.image] if p.image else [])

    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "price": _fmt_price(p.price),
        "priceRaw": p.price,
        "partNumber": p.part_number,
        "image": p.image,
        "images": images,
        "categoryBreadcrumb": breadcrumb,
        "compatibilities": [
            {
                "brand": c.brand,
                "model": c.model,
                "yearFrom": c.year_from,
                "yearTo": c.year_to,
            }
            for c in compats
        ],
        "sellerName": p.seller_name,
        "sellerPhone": p.seller_phone,
        "sellerLocation": p.seller_location,
    }


def get_compatible_parts(db: Session, brand: str, model: str, limit: int = 10) -> dict:
    part_ids = (
        db.query(PartCompatibility.part_id)
        .filter(PartCompatibility.brand.ilike(brand), PartCompatibility.model.ilike(model))
        .distinct()
        .all()
    )
    ids = [pid for (pid,) in part_ids]
    if not ids:
        return {"parts": [], "total": 0}

    parts = db.query(Part).filter(Part.id.in_(ids)).limit(limit).all()
    result = []
    for p in parts:
        cat = db.query(PartCategory).filter(PartCategory.id == p.category_id).first()
        compats = db.query(PartCompatibility).filter(PartCompatibility.part_id == p.id).all()
        result.append({
            "id": p.id,
            "name": p.name,
            "price": _fmt_price(p.price),
            "image": p.image,
            "sellerName": p.seller_name,
            "categoryBreadcrumb": _breadcrumb_string(db, cat) if cat else "",
            "compatibleCars": _compact_compatibility(compats),
        })

    return {"parts": result, "total": len(ids)}
