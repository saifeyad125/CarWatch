"""
Notification endpoints — list, mark-read, unread count.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone

from db.deps import get_db
from db.models import Notification, Watchlist
from models.schemas import NotificationsListResponse, NotificationResponse, UnreadCountResponse

router = APIRouter()


def _time_ago(dt: datetime) -> str:
    diff = datetime.now(timezone.utc) - dt.replace(tzinfo=timezone.utc)
    minutes = int(diff.total_seconds() // 60)
    if minutes < 1:
        return "Just now"
    if minutes < 60:
        return f"{minutes}m ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h ago"
    return f"{diff.days}d ago"


def _notification_to_response(n: Notification) -> NotificationResponse:
    watchlist_name = None
    if n.watchlist:
        watchlist_name = n.watchlist.title
    return NotificationResponse(
        id=n.id,
        watchlistId=n.watchlist_id,
        listingId=n.listing_id,
        type=n.type,
        title=n.title,
        message=n.message,
        isRead=n.is_read,
        createdAt=_time_ago(n.created_at),
        watchlistName=watchlist_name,
    )


@router.get("", response_model=NotificationsListResponse)
def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Notification)
    if unread_only:
        q = q.filter(Notification.is_read == False)
    rows = q.order_by(Notification.created_at.desc()).limit(limit).all()
    unread = db.query(func.count(Notification.id)).filter(Notification.is_read == False).scalar() or 0
    return NotificationsListResponse(
        notifications=[_notification_to_response(n) for n in rows],
        unreadCount=unread,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(db: Session = Depends(get_db)):
    count = db.query(func.count(Notification.id)).filter(Notification.is_read == False).scalar() or 0
    return UnreadCountResponse(unreadCount=count)


@router.patch("/{notification_id}/read")
def mark_read(notification_id: int, db: Session = Depends(get_db)):
    n = db.query(Notification).filter(Notification.id == notification_id).first()
    if n:
        n.is_read = True
        db.commit()
    return {"ok": True}


@router.patch("/read-all")
def mark_all_read(db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"ok": True}
