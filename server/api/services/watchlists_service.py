from typing import Dict, List
from fastapi import HTTPException
from models.schemas import (
    WatchlistDetailResponse, WatchlistsListResponse, WatchlistMatchesResponse, 
    WatchlistStats, WatchlistCard, WatchlistMatch, CarListingSummary, WatchlistSearchCriteria
)
from api.routes.cars import LISTINGS  # reusing your in-memory mock listings


# -----------------------
# Mock watchlist storage
# -----------------------

WATCHLISTS: Dict[int, WatchlistCard] = {
    1: WatchlistCard(
        id=1,
        title="Toyota Camry 2020-2023",
        subtitle="2020–2023 • $20,000–$28,000",
        locationLabel="Los Angeles Area",
        updatedLabel="Updated 2 hours ago",
        tags=["Used", "Certified Pre-Owned"],
        isActive=True,
        alertsEnabled=True,
        newCount=2,
        totalMatches=3,
        searchCriteria=WatchlistSearchCriteria(
            make="Toyota",
            models=["Camry"],
            year_min=2020,
            year_max=2023,
            price_min=20000,
            price_max=28000,
            location="Los Angeles, CA",
            search_radius=50
        )
    ),
    2: WatchlistCard(
        id=2,
        title="Honda Accord Sport",
        subtitle="2021–2024 • $22,000–$30,000",
        locationLabel="San Diego",
        updatedLabel="Updated 1 hour ago",
        tags=["Used"],
        isActive=True,
        alertsEnabled=False,
        newCount=1,
        totalMatches=1,
        searchCriteria=WatchlistSearchCriteria(
            make="Honda",
            models=["Accord"],
            year_min=2021,
            year_max=2024,
            price_min=22000,
            price_max=30000,
            location="San Diego, CA",
            search_radius=30
        )
    ),
    3: WatchlistCard(
        id=3,
        title="UAE Premium SUVs",
        subtitle="2020–2024 • $45,000–$70,000",
        locationLabel="Dubai / Abu Dhabi",
        updatedLabel="Updated 30 minutes ago",
        tags=["Certified Dealer"],
        isActive=False,
        alertsEnabled=True,
        newCount=0,
        totalMatches=2,
        searchCriteria=WatchlistSearchCriteria(
            make="BMW",
            year_min=2020,
            year_max=2024,
            price_min=45000,
            price_max=70000,
            location="Dubai, UAE",
            search_radius=100
        )
    ),
}

WATCHLIST_MATCH_IDS: Dict[int, List[int]] = {
    1: [1, 9, 10],
    2: [2],
    3: [3, 6],
}

WATCHLIST_NEW_IDS: Dict[int, List[int]] = {
    1: [9, 10],
    2: [2],
    3: [],
}


# -----------------------
# Helpers
# -----------------------

def _to_summary(detail) -> CarListingSummary:
    return CarListingSummary(**detail.model_dump(include={
        "id","make","model","year","price","predictedPrice","dealLabel",
        "mileage","location","image"
    }))

def _parse_price(price: str) -> int:
    # "$24,500" -> 24500
    return int(price.replace("$", "").replace(",", "").strip())

def _parse_mileage(mileage: str) -> int:
    # "45,000 km" -> 45000
    return int(mileage.split()[0].replace(",", ""))

def _listing_matches_criteria(listing: CarListingSummary, criteria: WatchlistSearchCriteria) -> bool:
    """Check if a car listing matches the watchlist search criteria"""
    
    # Check make
    if criteria.make and listing.make != criteria.make:
        return False
    
    # Check models (if specified)
    if criteria.models and listing.model not in criteria.models:
        return False
    
    # Check year range
    if criteria.year_min and listing.year < criteria.year_min:
        return False
    if criteria.year_max and listing.year > criteria.year_max:
        return False
    
    # Check price range
    if criteria.price_min or criteria.price_max:
        listing_price = _parse_price(listing.price)
        if criteria.price_min and listing_price < criteria.price_min:
            return False
        if criteria.price_max and listing_price > criteria.price_max:
            return False
    
    # Check mileage range
    if criteria.mileage_min or criteria.mileage_max:
        listing_mileage = _parse_mileage(listing.mileage)
        if criteria.mileage_min and listing_mileage < criteria.mileage_min:
            return False
        if criteria.mileage_max and listing_mileage > criteria.mileage_max:
            return False
    

    
    return True


# -----------------------
# Service API
# -----------------------

def list_watchlists() -> WatchlistsListResponse:
    watchlists = list(WATCHLISTS.values())

    summary = {
        "active": sum(1 for w in watchlists if w.isActive),
        "matches": sum(w.totalMatches for w in watchlists),
        "withAlerts": sum(1 for w in watchlists if w.alertsEnabled),
    }

    return WatchlistsListResponse(summary=summary, watchlists=watchlists)


def get_watchlist(watchlist_id: int) -> WatchlistCard:
    w = WATCHLISTS.get(watchlist_id)
    if not w:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return w


def get_watchlist_detail(watchlist_id: int) -> WatchlistDetailResponse:
    w = get_watchlist(watchlist_id)

    # mock stats (later derived from matches table)
    stats = WatchlistStats(
        totalMatches=w.totalMatches,
        newToday=w.newCount,
        avgMatch=92 if watchlist_id == 1 else 88,
    )

    return WatchlistDetailResponse(watchlist=w, stats=stats)


def get_watchlist_matches(watchlist_id: int, sort: str = "best_match") -> WatchlistMatchesResponse:
    if watchlist_id not in WATCHLISTS:
        raise HTTPException(status_code=404, detail="Watchlist not found")

    ids = WATCHLIST_MATCH_IDS.get(watchlist_id, [])
    new_ids = set(WATCHLIST_NEW_IDS.get(watchlist_id, []))

    matches: List[WatchlistMatch] = []
    for i, listing_id in enumerate(ids):
        detail = LISTINGS.get(listing_id)
        if not detail:
            continue

        summary = _to_summary(detail)

        matches.append(
            WatchlistMatch(
                isNew=listing_id in new_ids,
                isGoodDeal=(summary.dealLabel == "Good Deal"),
                listing=summary,
            )
        )

    if sort == "price":
        matches.sort(key=lambda m: _parse_price(m.listing.price))
    elif sort == "newest":
        # Put new listings first
        matches.sort(key=lambda m: m.isNew, reverse=True)
    # for "best_match", keep the original order (most relevant first)

    return WatchlistMatchesResponse(watchlistId=watchlist_id, matches=matches)


def run_watchlist_scan(watchlist_id: int) -> dict:
    """
    Scan all listings and add matches to the watchlist.
    Returns statistics about the scan.
    """
    if watchlist_id not in WATCHLISTS:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    
    watchlist = WATCHLISTS[watchlist_id]
    criteria = watchlist.searchCriteria
    
    # Get current matches for this watchlist
    current_match_ids = set(WATCHLIST_MATCH_IDS.get(watchlist_id, []))
    
    # Track new matches found
    new_matches = []
    total_scanned = 0
    
    # Loop through all listings
    for listing_id, listing_detail in LISTINGS.items():
        total_scanned += 1
        
        # Convert to summary for matching
        summary = _to_summary(listing_detail)
        
        # Check if listing matches criteria
        if _listing_matches_criteria(summary, criteria):
            # If it's not already in the watchlist, add it
            if listing_id not in current_match_ids:
                new_matches.append(listing_id)
                current_match_ids.add(listing_id)
    
    # Update the watchlist match IDs
    if watchlist_id not in WATCHLIST_MATCH_IDS:
        WATCHLIST_MATCH_IDS[watchlist_id] = []
    
    WATCHLIST_MATCH_IDS[watchlist_id] = list(current_match_ids)
    
    # Mark new matches as new
    if watchlist_id not in WATCHLIST_NEW_IDS:
        WATCHLIST_NEW_IDS[watchlist_id] = []
    
    # Add new matches to the new IDs list
    WATCHLIST_NEW_IDS[watchlist_id].extend(new_matches)
    
    # Update watchlist card stats
    watchlist.totalMatches = len(current_match_ids)
    watchlist.newCount = len(WATCHLIST_NEW_IDS[watchlist_id])
    
    # Return scan statistics
    return {
        "watchlistId": watchlist_id,
        "totalScanned": total_scanned,
        "totalMatches": len(current_match_ids),
        "newMatches": len(new_matches),
        "newMatchIds": new_matches
    }


