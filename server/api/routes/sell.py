from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.deps import get_db, get_current_user
from db.models import User, UserStatus
from models.schemas import (
    CarListingCreate,
    MotorcycleListingCreate,
    ListingSubmissionResponse,
    MyListingsResponse,
    PendingListingsResponse,
    ListingStatusUpdate,
)
from api.services.sell_service import (
    create_car_listing,
    create_motorcycle_listing,
    get_user_listings,
    get_pending_listings,
    update_listing_status,
    delete_user_listing,
)

router = APIRouter()


def _require_admin(user: User):
    if user.status != UserStatus.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


@router.post("/car", response_model=ListingSubmissionResponse, status_code=201)
def api_create_car_listing(
    body: CarListingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_car_listing(db, body, current_user.id)


@router.post("/motorcycle", response_model=ListingSubmissionResponse, status_code=201)
def api_create_motorcycle_listing(
    body: MotorcycleListingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_motorcycle_listing(db, body, current_user.id)


@router.get("/my-listings", response_model=MyListingsResponse)
def api_my_listings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_user_listings(db, current_user.id)


@router.delete("/{listing_type}/{listing_id}", status_code=204)
def api_delete_listing(
    listing_type: str,
    listing_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    delete_user_listing(db, listing_type, listing_id, current_user.id)
    return None


@router.get("/pending", response_model=PendingListingsResponse)
def api_pending_listings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    return get_pending_listings(db)


@router.patch("/{listing_type}/{listing_id}/status")
def api_update_listing_status(
    listing_type: str,
    listing_id: int,
    body: ListingStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    update_listing_status(db, listing_type, listing_id, body.status)
    return {"ok": True}
