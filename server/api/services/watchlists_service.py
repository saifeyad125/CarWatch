import logging
import re
from datetime import datetime, timezone
from typing import List

logger = logging.getLogger(__name__)

from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from db.models import (
    Listing, DealerListing, Part, PartCompatibility,
    Watchlist, WatchlistMatch as WatchlistMatchDB,
    DealerWatchlistMatch, PartWatchlistMatch,
)
from models.schemas import (
    CarListingSummary,
    PartWatchlistSearchCriteria,
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
from api.services.constants import HYBRID_PRICE_THRESHOLD, derive_model_used, derive_confidence_label


# helpers 

def _fmt_price(aed: int) -> str:
    if aed is None:
        return "Price on Request"
    return f"د.إ {aed:,}"


def _fmt_mileage(kms: int | None) -> str:
    if kms is None:
        return "N/A"
    return f"{kms:,} km"


def _derive_model_used(row: Listing) -> str:
    return derive_model_used(row.predicted_price_lgbm, row.price)


def _derive_confidence_label(sigma_log) -> str | None:
    return derive_confidence_label(sigma_log)


def _listing_to_summary(row: Listing) -> CarListingSummary:
    return CarListingSummary(
        id=row.id,
        make=row.brand,
        model=row.model,
        trim=row.trim,
        year=row.year,
        price=_fmt_price(row.price),
        predictedPrice=_fmt_price(row.predicted_price) if row.predicted_price else None,
        predictedPriceLgbm=_fmt_price(row.predicted_price_lgbm) if row.predicted_price_lgbm else None,
        modelUsed=_derive_model_used(row),
        dealLabel=row.deal_label,
        confidenceLabel=_derive_confidence_label(row.sigma_log),
        mileage=_fmt_mileage(row.kms),
        location=row.location or "Dubai, UAE",
        image=row.image or "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&h=600&fit=crop",
        source=getattr(row, 'source', 'dubizzle'),
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
    q = db.query(Listing)
    q = q.filter(Listing.listing_status == "approved")

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


def _build_dealer_criteria_query(db: Session, criteria: WatchlistSearchCriteria):
    q = db.query(DealerListing)

    if criteria.make:
        q = q.filter(DealerListing.brand.ilike(criteria.make))
    if criteria.models:
        q = q.filter(DealerListing.model.in_(criteria.models))
    if criteria.year_min:
        q = q.filter(DealerListing.year >= criteria.year_min)
    if criteria.year_max:
        q = q.filter(DealerListing.year <= criteria.year_max)
    if criteria.price_min:
        q = q.filter(DealerListing.price >= criteria.price_min)
    if criteria.price_max:
        q = q.filter(DealerListing.price <= criteria.price_max)
    if criteria.mileage_min:
        q = q.filter(DealerListing.kms >= criteria.mileage_min)
    if criteria.mileage_max:
        q = q.filter(DealerListing.kms <= criteria.mileage_max)
    if criteria.locations:
        q = q.filter(DealerListing.location.in_(criteria.locations))

    return q


def _build_part_criteria_query(db: Session, criteria: PartWatchlistSearchCriteria):
    q = db.query(Part)

    if criteria.keyword:
        q = q.filter(Part.name.ilike(f"%{criteria.keyword}%"))
    if criteria.category_id:
        q = q.filter(Part.category_id == criteria.category_id)
    if criteria.price_min:
        q = q.filter(Part.price >= criteria.price_min)
    if criteria.price_max:
        q = q.filter(Part.price <= criteria.price_max)
    if criteria.compatible_brand or criteria.compatible_model:
        part_ids_q = db.query(PartCompatibility.part_id)
        if criteria.compatible_brand:
            part_ids_q = part_ids_q.filter(PartCompatibility.brand.ilike(criteria.compatible_brand))
        if criteria.compatible_model:
            part_ids_q = part_ids_q.filter(PartCompatibility.model.ilike(criteria.compatible_model))
        q = q.filter(Part.id.in_(part_ids_q))

    return q


def _watchlist_to_card(w: Watchlist, db: Session = None, *, total: int = None, new_count: int = None) -> WatchlistCard:
    # pre-computed counts from batch query, or fallback for single-card callers
    if total is None and db is not None:
        total = db.query(func.count(WatchlistMatchDB.id)).filter(
            WatchlistMatchDB.watchlist_id == w.id
        ).scalar() or 0
    elif total is None:
        total = 0

    if new_count is None and db is not None:
        new_count = db.query(func.count(WatchlistMatchDB.id)).filter(
            WatchlistMatchDB.watchlist_id == w.id,
            WatchlistMatchDB.is_new == True,
        ).scalar() or 0
    elif new_count is None:
        new_count = 0

    criteria = WatchlistSearchCriteria(**(w.criteria_json or {}))

    year_part = ""
    if criteria.year_min and criteria.year_max:
        year_part = f"{criteria.year_min}–{criteria.year_max}"
    price_part = ""
    if criteria.price_min and criteria.price_max:
        price_part = f"د.إ {criteria.price_min:,}–د.إ {criteria.price_max:,}"
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


# service API 

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
    if not rows:
        return WatchlistsListResponse(summary={"active": 0, "matches": 0, "withAlerts": 0}, watchlists=[])

    wl_ids = [w.id for w in rows]

    total_counts = dict(
        db.query(WatchlistMatchDB.watchlist_id, func.count(WatchlistMatchDB.id))
        .filter(WatchlistMatchDB.watchlist_id.in_(wl_ids))
        .group_by(WatchlistMatchDB.watchlist_id)
        .all()
    )
    new_counts = dict(
        db.query(WatchlistMatchDB.watchlist_id, func.count(WatchlistMatchDB.id))
        .filter(WatchlistMatchDB.watchlist_id.in_(wl_ids), WatchlistMatchDB.is_new == True)
        .group_by(WatchlistMatchDB.watchlist_id)
        .all()
    )

    cards = [_watchlist_to_card(w, total=total_counts.get(w.id, 0), new_count=new_counts.get(w.id, 0)) for w in rows]

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
    avg_match = None

    stats = WatchlistStats(totalMatches=total, newToday=new_today, avgMatch=avg_match)
    return WatchlistDetailResponse(watchlist=card, stats=stats)


MAX_ACTIVE_WATCHLISTS = 2
MAX_TOTAL_WATCHLISTS = 10
SCAN_COOLDOWN_SECONDS = 60

def set_watchlist_status(db: Session, watchlist_id: int, payload: WatchlistStatusUpdate, user_id: int) -> WatchlistCard:
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
        def _price_sort_key(m):
            digits = re.sub(r"[^\d]", "", m.listing.price)
            return int(digits) if digits else float('inf')
        matches.sort(key=_price_sort_key)
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


def run_watchlist_scan(db: Session, watchlist_id: int, user_id: int | None = None) -> dict:
    w = _get_watchlist_or_404(db, watchlist_id, user_id)

    # Manual scans (user_id provided) require active watchlist
    if user_id is not None and not w.is_active:
        raise HTTPException(
            status_code=403,
            detail="Cannot scan an inactive watchlist. Activate it first.",
        )

    # Rate limit manual scans
    if user_id is not None and w.updated_at:
        elapsed = (datetime.now(timezone.utc) - w.updated_at.replace(tzinfo=timezone.utc)).total_seconds()
        if elapsed < SCAN_COOLDOWN_SECONDS:
            raise HTTPException(
                status_code=429,
                detail=f"Please wait {int(SCAN_COOLDOWN_SECONDS - elapsed)} seconds before scanning again.",
            )

    now = datetime.now(timezone.utc)
    new_match_listing_ids: list[int] = []
    new_dealer_ids: list[int] = []
    new_part_ids: list[int] = []
    total_in_db = 0
    total_matched = 0
    existing_count = 0

    if w.type == "car":
        criteria = WatchlistSearchCriteria(**(w.criteria_json or {}))

        # Used car matching
        total_in_db = db.query(func.count(Listing.id)).scalar()
        matching_listings = _build_criteria_query(db, criteria).all()
        total_matched += len(matching_listings)

        existing_ids = set(
            r[0] for r in db.query(WatchlistMatchDB.listing_id)
            .filter(WatchlistMatchDB.watchlist_id == watchlist_id)
            .all()
        )
        existing_count += len(existing_ids)

        for listing in matching_listings:
            if listing.id not in existing_ids:
                db.add(WatchlistMatchDB(
                    watchlist_id=watchlist_id,
                    listing_id=listing.id,
                    is_new=True,
                    matched_at=now,
                ))
                new_match_listing_ids.append(listing.id)

        # Dealer listing matching
        dealer_matches = _build_dealer_criteria_query(db, criteria).all()
        total_matched += len(dealer_matches)

        existing_dealer_ids = set(
            r[0] for r in db.query(DealerWatchlistMatch.dealer_listing_id)
            .filter(DealerWatchlistMatch.watchlist_id == watchlist_id)
            .all()
        )
        existing_count += len(existing_dealer_ids)

        for dl in dealer_matches:
            if dl.id not in existing_dealer_ids:
                db.add(DealerWatchlistMatch(
                    watchlist_id=watchlist_id,
                    dealer_listing_id=dl.id,
                    is_new=True,
                    matched_at=now,
                ))
                new_dealer_ids.append(dl.id)

    elif w.type == "part":
        part_criteria = PartWatchlistSearchCriteria(**(w.criteria_json or {}))
        part_matches = _build_part_criteria_query(db, part_criteria).all()
        total_matched += len(part_matches)

        existing_part_ids = set(
            r[0] for r in db.query(PartWatchlistMatch.part_id)
            .filter(PartWatchlistMatch.watchlist_id == watchlist_id)
            .all()
        )
        existing_count += len(existing_part_ids)

        for p in part_matches:
            if p.id not in existing_part_ids:
                db.add(PartWatchlistMatch(
                    watchlist_id=watchlist_id,
                    part_id=p.id,
                    is_new=True,
                    matched_at=now,
                ))
                new_part_ids.append(p.id)

    total_new = len(new_match_listing_ids) + len(new_dealer_ids) + len(new_part_ids)

    w.updated_at = datetime.now(timezone.utc)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        w = db.query(Watchlist).filter(Watchlist.id == watchlist_id).first()
        w.updated_at = datetime.now(timezone.utc)
        db.commit()

    return {
        "watchlistId": watchlist_id,
        "totalScanned": total_in_db,
        "totalMatches": total_matched,
        "existingMatches": existing_count,
        "newMatches": total_new,
        "newMatchListingIds": new_match_listing_ids,
        "newDealerMatchIds": new_dealer_ids,
        "newPartMatchIds": new_part_ids,
    }


# normalisation helpers 

def _normalise(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip()).title()


def create_watchlist(db: Session, payload: WatchlistCreate, user_id: int) -> WatchlistCard:
    # Enforce total watchlist cap 
    total_count = (
        db.query(func.count(Watchlist.id))
        .filter(Watchlist.user_id == user_id)
        .scalar() or 0
    )
    if total_count >= MAX_TOTAL_WATCHLISTS:
        raise HTTPException(
            status_code=409,
            detail=f"Maximum of {MAX_TOTAL_WATCHLISTS} watchlists reached. Delete one first.",
        )

    # Enforce active watchlist cap at creation 
    if payload.isActive:
        active_count = (
            db.query(func.count(Watchlist.id))
            .filter(Watchlist.is_active == True, Watchlist.user_id == user_id)
            .scalar() or 0
        )
        if active_count >= MAX_ACTIVE_WATCHLISTS:
            raise HTTPException(
                status_code=409,
                detail=f"Free trial limited to {MAX_ACTIVE_WATCHLISTS} active watchlists. "
                       "Pause another watchlist first or upgrade.",
            )

    criteria = payload.searchCriteria

    # Normalise make (strip + title case) – DB uses ilike so matching is safe
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
        type=payload.type,
        criteria_json=criteria.model_dump(exclude_none=True),
        user_id=user_id,
    )
    db.add(w)
    db.flush()          # get w.id without committing

    # Run initial scan only for active watchlists
    if w.is_active:
        run_watchlist_scan(db, w.id)

    db.commit()
    db.refresh(w)
    return _watchlist_to_card(w, db)


def delete_watchlist(db: Session, watchlist_id: int, user_id: int) -> None:
    w = _get_watchlist_or_404(db, watchlist_id, user_id)
    db.delete(w)
    db.commit()


def initialize_watchlists(db: Session):
    total_listings = db.query(func.count(Listing.id)).scalar()
    watchlists = db.query(Watchlist).all()
    for w in watchlists:
        result = run_watchlist_scan(db, w.id)
        logger.info("Watchlist '%s': scanned %d listings, %d matched, %d new",
                    w.title, result['totalScanned'], result['totalMatches'], result['newMatches'])
    logger.info("Initialized %d watchlists against %d listings", len(watchlists), total_listings)


