from fastapi import APIRouter
from models.schemas import WatchlistDetailResponse, WatchlistsListResponse, WatchlistMatchesResponse
from api.services.watchlists_service import list_watchlists, get_watchlist_detail, get_watchlist_matches, run_watchlist_scan

router = APIRouter()

@router.get("", response_model=WatchlistsListResponse)
def api_list_watchlists():
    return list_watchlists()

@router.get("/{watchlist_id}", response_model=WatchlistDetailResponse)
def api_get_watchlist_detail(watchlist_id: int):
    return get_watchlist_detail(watchlist_id)

@router.get("/{watchlist_id}/matches", response_model=WatchlistMatchesResponse)
def api_get_matches(watchlist_id: int, sort: str = "best_match"):
    return get_watchlist_matches(watchlist_id, sort)

@router.get("/{watchlist_id}/scan")
def api_run_watchlist_scan(watchlist_id: int):
    """
    Scan all listings and update matches for this watchlist.
    Returns statistics about the scan.
    """
    return run_watchlist_scan(watchlist_id)


