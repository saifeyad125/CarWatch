from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.orm import Session
from db.deps import get_db
from api.services.parts_service import (
    get_categories,
    get_category_detail,
    list_parts,
    get_part_detail,
    get_compatible_parts,
)

router = APIRouter()


@router.get("/categories")
def browse_categories(parent_id: Optional[int] = None, db: Session = Depends(get_db)):
    return {"categories": get_categories(db, parent_id)}


@router.get("/categories/{category_id}")
def category_detail(category_id: int, db: Session = Depends(get_db)):
    return get_category_detail(db, category_id)


@router.get("/compatible/{brand}/{model}")
def compatible_parts(brand: str, model: str, limit: int = Query(default=10, le=50), db: Session = Depends(get_db)):
    return get_compatible_parts(db, brand, model, limit)


@router.get("/{part_id}")
def part_detail(part_id: int, db: Session = Depends(get_db)):
    return get_part_detail(db, part_id)


@router.get("")
def browse_parts(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    min_price: Optional[int] = None,
    max_price: Optional[int] = None,
    brand: Optional[str] = None,
    model: Optional[str] = None,
    seller_name: Optional[str] = None,
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return list_parts(
        db, search=search, category_id=category_id,
        min_price=min_price, max_price=max_price,
        brand=brand, model=model, seller_name=seller_name,
        limit=limit, offset=offset,
    )
