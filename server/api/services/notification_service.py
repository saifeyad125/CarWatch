"""
Notification service — creates notifications when watchlist matches are found.
"""
from sqlalchemy.orm import Session
from db.models import Notification, Watchlist, Listing


def create_match_notifications(
    db: Session,
    watchlist: Watchlist,
    new_listing_ids: list[int],
) -> int:
    """
    Create a notification for a watchlist that got new matches.
    Groups all new matches into a single notification.
    Returns the number of notifications created.
    """
    if not new_listing_ids or not watchlist.alerts_enabled:
        return 0

    count = len(new_listing_ids)
    title = "New Match Found!" if count == 1 else f"{count} New Matches!"
    message = (
        f"{count} new {'car matches' if count == 1 else 'cars match'} "
        f"your \"{watchlist.title}\" watchlist"
    )

    # Use the first listing_id as a reference (for quick-link)
    n = Notification(
        watchlist_id=watchlist.id,
        listing_id=new_listing_ids[0] if count == 1 else None,
        user_id=watchlist.user_id,
        type="new_match",
        title=title,
        message=message,
    )
    db.add(n)
    return 1


def create_expiry_notification(
    db: Session,
    watchlist: Watchlist,
    expired_count: int,
) -> int:
    """Create a notification when matched listings have expired."""
    if not expired_count or not watchlist.alerts_enabled:
        return 0

    n = Notification(
        watchlist_id=watchlist.id,
        user_id=watchlist.user_id,
        type="listing_expired",
        title="Listings Expired",
        message=f"{expired_count} listing{'s' if expired_count > 1 else ''} "
                f"from your \"{watchlist.title}\" watchlist expired or were sold",
    )
    db.add(n)
    return 1
