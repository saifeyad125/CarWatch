"""
Watchlist business logic – all queries go through SQLAlchemy.
"""
import re
from datetime import datetime, timezone
from typing import List

from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from db.models import Listing, Watchlist, WatchlistMatch as WatchlistMatchDB
from models.schemas import (
    CarListingSummary,
    WatchlistCard,
    WatchlistCreate,
    WatchlistDetailResponse,
    WatchlistMatch,
    WatchlistMatchesResponse,
    WatchlistSearchCriteria,
    WatchlistStatusUpdate,
    WatchlistsListResponse,
    WatchlistStats,
)


# ─────────── helpers ───────────

def _fmt_price(aed: int) -> str:
    return f"${aed:,}"


def _fmt_mileage(kms: int | None) -> str:
    if kms is None:
        return "N/A"
    return f"{kms:,} km"


def _listing_to_summary(row: Listing) -> CarListingSummary:
    return CarListingSummary(
        id=row.id,
        make=row.brand,
        model=row.model,
        year=row.year,
        price=_fmt_price(row.price),
        predictedPrice=_fmt_price(row.predicted_price) if row.predicted_price else None,
        dealLabel=row.deal_label,
        mileage=_fmt_mileage(row.kms),
        location=row.location or "Dubai, UAE",
        image=row.image or "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&h=600&fit=crop",
    )


def _time_ago(dt: datetime) -> str:
    diff = datetime.now(timezone.utc) - dt.replace(tzinfo=timezone.utc)
    minutes = int(diff.total_seconds() // 60)
    if minutes < 60:
        return f"Updated {minutes} minutes ago"
    hours = minutes // 60
    if hours < 24:
        return f"Updated {hours} hours ago"
    return f"Updated {diff.days} days ago"


def _build_criteria_query(db: Session, criteria: WatchlistSearchCriteria):
    """
    Build a SQLAlchemy query on the Listing table filtered by search criteria.
    ALL filtering happens at the DB level — no Python-side loops.
    """
    q = db.query(Listing)

    if criteria.make:
        q = q.filter(Listing.brand.ilike(criteria.make))
    if criteria.models:
        q = q.filter(Listing.model.in_(criteria.models))
    if criteria.year_min:
        q = q.filter(Listing.year >= criteria.year_min)
    if criteria.year_max:
        q = q.filter(Listing.year <= criteria.year_max)
    if criteria.price_min:
        q = q.filter(Listing.price >= criteria.price_min)
    if criteria.price_max:
        q = q.filter(Listing.price <= criteria.price_max)
    if criteria.mileage_min:
        q = q.filter(Listing.kms >= criteria.mileage_min)
    if criteria.mileage_max:
        q = q.filter(Listing.kms <= criteria.mileage_max)
    if criteria.locations:
        q = q.filter(Listing.location.in_(criteria.locations))

    return q


def _watchlist_to_card(w: Watchlist, db: Session) -> WatchlistCard:
    total = db.query(func.count(WatchlistMatchDB.id)).filter(
        WatchlistMatchDB.watchlist_id == w.id
    ).scalar() or 0

    # Count unseen matches (is_new=True means user hasn't viewed them yet)
    new_count = db.query(func.count(WatchlistMatchDB.id)).filter(
        WatchlistMatchDB.watchlist_id == w.id,
        WatchlistMatchDB.is_new == True,
    ).scalar() or 0

    criteria = WatchlistSearchCriteria(**(w.criteria_json or {}))

    # Build subtitle from criteria
    year_part = ""
    if criteria.year_min and criteria.year_max:
        year_part = f"{criteria.year_min}–{criteria.year_max}"
    price_part = ""
    if criteria.price_min and criteria.price_max:
        price_part = f"${criteria.price_min:,}–${criteria.price_max:,}"
    subtitle = " • ".join(filter(None, [year_part, price_part]))

    return WatchlistCard(
        id=w.id,
        title=w.title,
        subtitle=subtitle or w.subtitle or "",
        locationLabel=w.location_label or "UAE",
        updatedLabel=_time_ago(w.updated_at),
        tags=w.tags or [],
        isActive=w.is_active,
        alertsEnabled=w.alerts_enabled,
        newCount=new_count,
        totalMatches=total,
        searchCriteria=criteria,
    )


# ─────────── service API ───────────

def _get_watchlist_or_404(db: Session, watchlist_id: int, user_id: int = None) -> Watchlist:
    q = db.query(Watchlist).filter(Watchlist.id == watchlist_id)
    if user_id is not None:
        q = q.filter(Watchlist.user_id == user_id)
    w = q.first()
    if not w:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return w


def list_watchlists(db: Session, user_id: int) -> WatchlistsListResponse:
    rows = db.query(Watchlist).filter(Watchlist.user_id == user_id).order_by(Watchlist.id).all()
    cards = [_watchlist_to_card(w, db) for w in rows]

    summary = {
        "active": sum(1 for c in cards if c.isActive),
        "matches": sum(c.totalMatches for c in cards),
        "withAlerts": sum(1 for c in cards if c.alertsEnabled),
    }
    return WatchlistsListResponse(summary=summary, watchlists=cards)


def get_watchlist_detail(db: Session, watchlist_id: int, user_id: int = None) -> WatchlistDetailResponse:
    w = _get_watchlist_or_404(db, watchlist_id, user_id)
    card = _watchlist_to_card(w, db)

    total = card.totalMatches
    new_today = card.newCount
    avg_match = 88 if total > 0 else 0

    stats = WatchlistStats(totalMatches=total, newToday=new_today, avgMatch=avg_match)
    return WatchlistDetailResponse(watchlist=card, stats=stats)


MAX_ACTIVE_WATCHLISTS = 2

def set_watchlist_status(db: Session, watchlist_id: int, payload: WatchlistStatusUpdate, user_id: int) -> WatchlistCard:
    """Toggle active/inactive. Enforces a limit of MAX_ACTIVE_WATCHLISTS active at once."""
    w = _get_watchlist_or_404(db, watchlist_id, user_id)

    if payload.isActive and not w.is_active:
        # Count how many are currently active (excluding this one)
        active_count = (
            db.query(func.count(Watchlist.id))
            .filter(Watchlist.is_active == True, Watchlist.id != watchlist_id, Watchlist.user_id == user_id)
            .scalar() or 0
        )
        if active_count >= MAX_ACTIVE_WATCHLISTS:
            raise HTTPException(
                status_code=409,
                detail=f"Free trial limited to {MAX_ACTIVE_WATCHLISTS} active watchlists. "
                       "Pause another watchlist first or upgrade.",
            )

    w.is_active = payload.isActive
    w.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(w)
    return _watchlist_to_card(w, db)


def get_watchlist_matches(
    db: Session, watchlist_id: int, sort: str = "best_match", user_id: int = None
) -> WatchlistMatchesResponse:
    _get_watchlist_or_404(db, watchlist_id, user_id)

    match_rows = (
        db.query(WatchlistMatchDB)
        .filter(WatchlistMatchDB.watchlist_id == watchlist_id)
        .all()
    )

    matches: List[WatchlistMatch] = []
    for m in match_rows:
        listing = m.listing
        if not listing:
            continue
        summary = _listing_to_summary(listing)
        matches.append(WatchlistMatch(
            isNew=m.is_new,
            isGoodDeal=(listing.deal_label == "Good Deal") if listing.deal_label else None,
            listing=summary,
        ))

    if sort == "price":
        matches.sort(key=lambda m: int(m.listing.price.replace("$", "").replace(",", "")))
    elif sort == "newest":
        matches.sort(key=lambda m: m.isNew, reverse=True)

    # Mark all unseen matches as seen now that the user has viewed them
    unseen = (
        db.query(WatchlistMatchDB)
        .filter(
            WatchlistMatchDB.watchlist_id == watchlist_id,
            WatchlistMatchDB.is_new == True,
        )
        .all()
    )
    for m in unseen:
        m.is_new = False
    if unseen:
        db.commit()

    return WatchlistMatchesResponse(watchlistId=watchlist_id, matches=matches)


def run_watchlist_scan(db: Session, watchlist_id: int) -> dict:
    """
    Scan listings via DB query, persist new matches into watchlist_matches table.
    Uses the unique constraint to prevent duplicates.
    """
    w = _get_watchlist_or_404(db, watchlist_id)
    criteria = WatchlistSearchCriteria(**(w.criteria_json or {}))

    # Count total listings in DB for reporting
    total_in_db = db.query(func.count(Listing.id)).scalar()

    # Use DB-level filtering — no Python loop needed
    matching_listings = _build_criteria_query(db, criteria).all()

    # Get existing match listing_ids for this watchlist
    existing_ids = set(
        r[0] for r in db.query(WatchlistMatchDB.listing_id)
        .filter(WatchlistMatchDB.watchlist_id == watchlist_id)
        .all()
    )

    new_match_listing_ids: list[int] = []
    now = datetime.now(timezone.utc)
    for listing in matching_listings:
        if listing.id not in existing_ids:
            db.add(WatchlistMatchDB(
                watchlist_id=watchlist_id,
                listing_id=listing.id,
                is_new=True,
                matched_at=now,
            ))
            new_match_listing_ids.append(listing.id)

    # Update watchlist timestamp
    w.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "watchlistId": watchlist_id,
        "totalScanned": total_in_db,
        "totalMatches": len(matching_listings),
        "existingMatches": len(existing_ids),
        "newMatches": len(new_match_listing_ids),
        "newMatchListingIds": new_match_listing_ids,
    }


# ─────────── normalisation helpers ───────────

def _normalise(value: str) -> str:
    """Collapse whitespace, strip, and title-case a brand/model string."""
    return re.sub(r"\s+", " ", value.strip()).title()


def create_watchlist(db: Session, payload: WatchlistCreate, user_id: int) -> WatchlistCard:
    """Validate, normalise, persist a new watchlist, run initial scan, return card."""
    criteria = payload.searchCriteria

    # Normalise make (strip + title-case) – DB uses ilike so matching is safe
    if criteria.make:
        criteria.make = _normalise(criteria.make)

    # Normalise model list
    if criteria.models:
        criteria.models = [_normalise(m) for m in criteria.models]

    # Build a title from criteria if the caller didn't provide a meaningful one
    title = payload.title.strip()
    if not title:
        parts = []
        if criteria.make:
            parts.append(criteria.make)
        if criteria.models:
            parts.append(", ".join(criteria.models[:2]))
        title = " ".join(parts) or "My Watchlist"

    location_label = ", ".join(
        loc.replace(", UAE", "") for loc in (criteria.locations or [])
    ) or "UAE"

    # Build tags from criteria for quick display
    tags: list[str] = []
    if criteria.year_min and criteria.year_max:
        tags.append(f"{criteria.year_min}–{criteria.year_max}")
    elif criteria.year_min:
        tags.append(f"From {criteria.year_min}")
    elif criteria.year_max:
        tags.append(f"Up to {criteria.year_max}")
    if criteria.price_max:
        tags.append(f"≤ AED {criteria.price_max:,}")

    w = Watchlist(
        title=title,
        subtitle=payload.subtitle or "",
        location_label=location_label,
        tags=tags,
        is_active=payload.isActive,
        alerts_enabled=payload.alertsEnabled,
        criteria_json=criteria.model_dump(exclude_none=True),
        user_id=user_id,
    )
    db.add(w)
    db.flush()          # get w.id without committing

    # Run initial scan so matches appear immediately
    run_watchlist_scan(db, w.id)

    db.commit()
    db.refresh(w)
    return _watchlist_to_card(w, db)


def delete_watchlist(db: Session, watchlist_id: int, user_id: int) -> None:
    """Delete a watchlist and all its matches (cascade)."""
    w = _get_watchlist_or_404(db, watchlist_id, user_id)
    db.delete(w)
    db.commit()


def initialize_watchlists(db: Session):
    """Run scan for every watchlist on startup."""
    total_listings = db.query(func.count(Listing.id)).scalar()
    watchlists = db.query(Watchlist).all()
    for w in watchlists:
        result = run_watchlist_scan(db, w.id)
        print(f"  Watchlist '{w.title}': scanned {result['totalScanned']} listings, "
              f"{result['totalMatches']} matched, {result['newMatches']} new")
    print(f"✓ Initialized {len(watchlists)} watchlists against {total_listings} listings")


