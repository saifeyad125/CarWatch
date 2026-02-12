"""
Watchlist business logic – all queries go through SQLAlchemy.
"""
from datetime import datetime, timezone
from typing import List

from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from db.models import Listing, Watchlist, WatchlistMatch as WatchlistMatchDB
from models.schemas import (
    CarListingSummary,
    WatchlistCard,
    WatchlistDetailResponse,
    WatchlistMatch,
    WatchlistMatchesResponse,
    WatchlistSearchCriteria,
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

    return q


def _watchlist_to_card(w: Watchlist, db: Session) -> WatchlistCard:
    total = db.query(func.count(WatchlistMatchDB.id)).filter(
        WatchlistMatchDB.watchlist_id == w.id
    ).scalar() or 0

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

def _get_watchlist_or_404(db: Session, watchlist_id: int) -> Watchlist:
    w = db.query(Watchlist).filter(Watchlist.id == watchlist_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return w


def list_watchlists(db: Session) -> WatchlistsListResponse:
    rows = db.query(Watchlist).order_by(Watchlist.id).all()
    cards = [_watchlist_to_card(w, db) for w in rows]

    summary = {
        "active": sum(1 for c in cards if c.isActive),
        "matches": sum(c.totalMatches for c in cards),
        "withAlerts": sum(1 for c in cards if c.alertsEnabled),
    }
    return WatchlistsListResponse(summary=summary, watchlists=cards)


def get_watchlist_detail(db: Session, watchlist_id: int) -> WatchlistDetailResponse:
    w = _get_watchlist_or_404(db, watchlist_id)
    card = _watchlist_to_card(w, db)

    total = card.totalMatches
    new_today = card.newCount
    avg_match = 88 if total > 0 else 0

    stats = WatchlistStats(totalMatches=total, newToday=new_today, avgMatch=avg_match)
    return WatchlistDetailResponse(watchlist=card, stats=stats)


def get_watchlist_matches(
    db: Session, watchlist_id: int, sort: str = "best_match"
) -> WatchlistMatchesResponse:
    _get_watchlist_or_404(db, watchlist_id)

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

    new_matches = 0
    for listing in matching_listings:
        if listing.id not in existing_ids:
            db.add(WatchlistMatchDB(
                watchlist_id=watchlist_id,
                listing_id=listing.id,
                is_new=True,
            ))
            new_matches += 1

    # Update watchlist timestamp
    w.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {
        "watchlistId": watchlist_id,
        "totalScanned": total_in_db,
        "totalMatches": len(matching_listings),
        "existingMatches": len(existing_ids),
        "newMatches": new_matches,
    }


def initialize_watchlists(db: Session):
    """Run scan for every watchlist on startup."""
    total_listings = db.query(func.count(Listing.id)).scalar()
    watchlists = db.query(Watchlist).all()
    for w in watchlists:
        result = run_watchlist_scan(db, w.id)
        print(f"  Watchlist '{w.title}': scanned {result['totalScanned']} listings, "
              f"{result['totalMatches']} matched, {result['newMatches']} new")
    print(f"✓ Initialized {len(watchlists)} watchlists against {total_listings} listings")


