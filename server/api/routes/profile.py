import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from db.deps import get_db, get_current_user, delete_supabase_user
from db.models import User, Watchlist, Notification
from models.schemas import ProfileResponse, ProfileUpdate, ProfileStats

logger = logging.getLogger(__name__)

router = APIRouter()


def _build_stats(db: Session, user_id: int) -> ProfileStats:
    from db.models import WatchlistMatch
    watchlists_count = db.query(func.count(Watchlist.id)).filter(
        Watchlist.user_id == user_id
    ).scalar() or 0

    # Total matches across all of this user's watchlists
    user_watchlist_ids = db.query(Watchlist.id).filter(Watchlist.user_id == user_id).subquery()
    total_matches = db.query(func.count(WatchlistMatch.id)).filter(
        WatchlistMatch.watchlist_id.in_(user_watchlist_ids)
    ).scalar() or 0

    return ProfileStats(
        watchlistsCount=watchlists_count,
        alertsSent=db.query(func.count(Notification.id)).filter(
            Notification.user_id == user_id
        ).scalar() or 0,
        totalMatches=total_matches,
    )


@router.get("", response_model=ProfileResponse)
def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stats = _build_stats(db, current_user.id)
    return ProfileResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        phone=current_user.phone,
        location=current_user.location,
        status=current_user.status.value,
        avatarSeed=current_user.avatar_seed,
        stats=stats,
    )


@router.patch("", response_model=ProfileResponse)
def update_profile(
    body: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.name is not None:
        current_user.name = body.name
    if body.email is not None:
        current_user.email = body.email
    if body.phone is not None:
        current_user.phone = body.phone
    if body.location is not None:
        current_user.location = body.location
    if body.avatarSeed is not None:
        current_user.avatar_seed = body.avatarSeed

    db.commit()
    db.refresh(current_user)

    stats = _build_stats(db, current_user.id)
    return ProfileResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        phone=current_user.phone,
        location=current_user.location,
        status=current_user.status.value,
        avatarSeed=current_user.avatar_seed,
        stats=stats,
    )


@router.delete("", status_code=204)
def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete the user's account entirely.
    1. Attempt Supabase Auth deletion (best-effort, logged on failure)
    2. Delete from local DB (cascades: watchlists, matches, notifications, chat)
    """
    supabase_ok = delete_supabase_user(current_user.supabase_id)
    if not supabase_ok:
        logger.warning(
            f"Supabase deletion failed for user {current_user.id} "
            f"(supabase_id={current_user.supabase_id}). "
            "Local data will still be deleted."
        )

    db.delete(current_user)
    db.commit()
    return None
