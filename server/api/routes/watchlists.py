from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.deps import get_db, get_current_user
from db.models import User
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
def api_create_watchlist(
    body: WatchlistCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = create_watchlist(db, body, current_user.id)
    return get_watchlist_detail(db, card.id, current_user.id)


@router.get("", response_model=WatchlistsListResponse)
def api_list_watchlists(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_watchlists(db, current_user.id)


@router.get("/{watchlist_id}", response_model=WatchlistDetailResponse)
def api_get_watchlist_detail(
    watchlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_watchlist_detail(db, watchlist_id, current_user.id)


@router.patch("/{watchlist_id}/status", response_model=WatchlistDetailResponse)
def api_set_watchlist_status(
    watchlist_id: int,
    body: WatchlistStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = set_watchlist_status(db, watchlist_id, body, current_user.id)
    return get_watchlist_detail(db, card.id, current_user.id)


@router.get("/{watchlist_id}/matches", response_model=WatchlistMatchesResponse)
def api_get_matches(
    watchlist_id: int,
    sort: str = "best_match",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_watchlist_matches(db, watchlist_id, sort, current_user.id)


@router.delete("/{watchlist_id}", status_code=204)
def api_delete_watchlist(
    watchlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    delete_watchlist(db, watchlist_id, current_user.id)
    return None


@router.post("/{watchlist_id}/scan")
def api_run_watchlist_scan(
    watchlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return run_watchlist_scan(db, watchlist_id, current_user.id)
