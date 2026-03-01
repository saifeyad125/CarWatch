"""
Watchlist endpoints – backed by Postgres.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.deps import get_db
from models.schemas import (
    WatchlistCreate,
    WatchlistDetailResponse,
    WatchlistsListResponse,
    WatchlistMatchesResponse,
    WatchlistStatusUpdate,
)
from api.services.watchlists_service import (
    create_watchlist,
    delete_watchlist,
    list_watchlists,
    get_watchlist_detail,
    get_watchlist_matches,
    run_watchlist_scan,
    set_watchlist_status,
)

router = APIRouter()


@router.post("", response_model=WatchlistDetailResponse, status_code=201)
def api_create_watchlist(body: WatchlistCreate, db: Session = Depends(get_db)):
    """Create a new watchlist and run an initial scan."""
    card = create_watchlist(db, body)
    # Re-use the detail builder so the response includes stats
    return get_watchlist_detail(db, card.id)


@router.get("", response_model=WatchlistsListResponse)
def api_list_watchlists(db: Session = Depends(get_db)):
    return list_watchlists(db)


@router.get("/{watchlist_id}", response_model=WatchlistDetailResponse)
def api_get_watchlist_detail(watchlist_id: int, db: Session = Depends(get_db)):
    return get_watchlist_detail(db, watchlist_id)


@router.patch("/{watchlist_id}/status", response_model=WatchlistDetailResponse)
def api_set_watchlist_status(watchlist_id: int, body: WatchlistStatusUpdate, db: Session = Depends(get_db)):
    """Activate or pause a watchlist. Enforces the 2-active limit."""
    card = set_watchlist_status(db, watchlist_id, body)
    return get_watchlist_detail(db, card.id)


@router.get("/{watchlist_id}/matches", response_model=WatchlistMatchesResponse)
def api_get_matches(watchlist_id: int, sort: str = "best_match", db: Session = Depends(get_db)):
    return get_watchlist_matches(db, watchlist_id, sort)


@router.delete("/{watchlist_id}", status_code=204)
def api_delete_watchlist(watchlist_id: int, db: Session = Depends(get_db)):
    """Delete a watchlist and all its matches."""
    delete_watchlist(db, watchlist_id)
    return None


@router.post("/{watchlist_id}/scan")
def api_run_watchlist_scan(watchlist_id: int, db: Session = Depends(get_db)):
    """Scan all listings and persist matches for this watchlist."""
    return run_watchlist_scan(db, watchlist_id)


@router.post("/debug/run-hourly")
def debug_run_hourly(db: Session = Depends(get_db)):
    """Debug-only: manually trigger the hourly scrape-and-match job."""
    from api.services.scheduler import hourly_scrape_and_match
    hourly_scrape_and_match()
    return {"ok": True, "message": "Hourly job executed"}


