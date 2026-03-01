"""
Expiry service — removes stale or dead listings from the database.

Two expiry rules:
  1. Age-based: DELETE listings older than MAX_AGE_DAYS
  2. 404-check: Re-check a batch of existing URLs, DELETE if 404
"""
import logging
import random
from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import func

from db.models import Listing, WatchlistMatch
from api.services.scraper_service import check_listing_alive

logger = logging.getLogger("expiry")

MAX_AGE_DAYS = 30
RECHECK_BATCH_SIZE = 50


def expire_listings(
    db: Session,
    max_age_days: int = MAX_AGE_DAYS,
    recheck_batch: int = RECHECK_BATCH_SIZE,
) -> dict:
    """
    1. Delete listings older than max_age_days.
    2. Spot-check a random batch of remaining listings; delete any that 404.

    Returns stats dict.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)

    # ── Age-based expiry ──
    age_expired = (
        db.query(Listing)
        .filter(Listing.created_at < cutoff)
        .all()
    )
    age_expired_ids = [l.id for l in age_expired]
    if age_expired_ids:
        # Delete watchlist matches first (cascade should handle, but be explicit)
        db.query(WatchlistMatch).filter(
            WatchlistMatch.listing_id.in_(age_expired_ids)
        ).delete(synchronize_session=False)
        db.query(Listing).filter(
            Listing.id.in_(age_expired_ids)
        ).delete(synchronize_session=False)
        db.flush()
    logger.info(f"Age-expired: {len(age_expired_ids)} listings older than {max_age_days} days")

    # ── 404-check expiry ──
    remaining = db.query(Listing).all()
    sample = random.sample(remaining, min(recheck_batch, len(remaining)))

    dead_ids: list[int] = []
    for listing in sample:
        if not check_listing_alive(listing.url):
            dead_ids.append(listing.id)
            logger.info(f"404 detected: {listing.url}")

    if dead_ids:
        db.query(WatchlistMatch).filter(
            WatchlistMatch.listing_id.in_(dead_ids)
        ).delete(synchronize_session=False)
        db.query(Listing).filter(
            Listing.id.in_(dead_ids)
        ).delete(synchronize_session=False)
        db.flush()
    logger.info(f"404-expired: {len(dead_ids)} of {len(sample)} checked")

    db.commit()
    return {
        "age_expired": len(age_expired_ids),
        "checked": len(sample),
        "dead": len(dead_ids),
    }
