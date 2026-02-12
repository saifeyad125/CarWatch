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
)
from api.services.watchlists_service import (
    list_watchlists,
    get_watchlist_detail,
    get_watchlist_matches,
    run_watchlist_scan,
)

router = APIRouter()


@router.get("", response_model=WatchlistsListResponse)
def api_list_watchlists(db: Session = Depends(get_db)):
    return list_watchlists(db)


@router.get("/{watchlist_id}", response_model=WatchlistDetailResponse)
def api_get_watchlist_detail(watchlist_id: int, db: Session = Depends(get_db)):
    return get_watchlist_detail(db, watchlist_id)


@router.get("/{watchlist_id}/matches", response_model=WatchlistMatchesResponse)
def api_get_matches(watchlist_id: int, sort: str = "best_match", db: Session = Depends(get_db)):
    return get_watchlist_matches(db, watchlist_id, sort)


@router.post("/{watchlist_id}/scan")
def api_run_watchlist_scan(watchlist_id: int, db: Session = Depends(get_db)):
    """Scan all listings and persist matches for this watchlist."""
    return run_watchlist_scan(db, watchlist_id)


