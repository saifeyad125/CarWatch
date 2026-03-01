"""
Profile endpoint – single-user (no auth), backed by Postgres.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from db.deps import get_db
from db.models import User, UserStatus, Watchlist, Listing, Notification
from models.schemas import ProfileResponse, ProfileUpdate, ProfileStats

router = APIRouter()


def _get_or_create_default_user(db: Session) -> User:
    """Return the default user, creating one if none exists."""
    user = db.query(User).first()
    if not user:
        user = User(
            name="Saif",
            email="saif@example.com",
            phone="+971 50 123 4567",
            location="Dubai, UAE",
            status=UserStatus.free,
            avatar_seed="Saif",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


def _build_stats(db: Session) -> ProfileStats:
    watchlists_count = db.query(func.count(Watchlist.id)).scalar() or 0
    deals_found = db.query(func.count(Listing.id)).filter(
        Listing.deal_label == "Good Deal"
    ).scalar() or 0

    return ProfileStats(
        watchlistsCount=watchlists_count,
        alertsSent=db.query(func.count(Notification.id)).scalar() or 0,
        dealsFound=deals_found,
    )


@router.get("", response_model=ProfileResponse)
def get_profile(db: Session = Depends(get_db)):
    user = _get_or_create_default_user(db)
    stats = _build_stats(db)

    return ProfileResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        phone=user.phone,
        location=user.location,
        status=user.status.value,
        avatarSeed=user.avatar_seed,
        stats=stats,
    )


@router.patch("", response_model=ProfileResponse)
def update_profile(body: ProfileUpdate, db: Session = Depends(get_db)):
    user = _get_or_create_default_user(db)

    if body.name is not None:
        user.name = body.name
    if body.email is not None:
        user.email = body.email
    if body.phone is not None:
        user.phone = body.phone
    if body.location is not None:
        user.location = body.location
    if body.avatarSeed is not None:
        user.avatar_seed = body.avatarSeed

    db.commit()
    db.refresh(user)

    stats = _build_stats(db)
    return ProfileResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        phone=user.phone,
        location=user.location,
        status=user.status.value,
        avatarSeed=user.avatar_seed,
        stats=stats,
    )
