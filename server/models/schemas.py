from pydantic import BaseModel
from typing import List, Optional, Literal

class CarListingSummary(BaseModel):
    id: int
    make: str
    model: str
    year: int
    price: str
    predictedPrice: Optional[str] = None
    dealLabel: Optional[Literal["Good Deal", "Fair", "Overpriced"]] = None
    mileage: str
    location: str
    image: str

class Seller(BaseModel):
    name: str
    avatar: str
    phone: str
    type: str

class PricePoint(BaseModel):
    month: str
    averagePrice: int

class SimilarListing(BaseModel):
    price: str
    mileage: str
    daysOnMarket: int

class MarketAnalysis(BaseModel):
    depreciation: dict
    marketTrend: str
    priceHistory: List[PricePoint]
    similarListings: List[SimilarListing]

class CarListingDetail(CarListingSummary):
    description: str
    seller: Seller
    url: str
    features: List[str]
    marketAnalysis: MarketAnalysis

class WatchlistSearchCriteria(BaseModel):
    """Search parameters for filtering car listings"""
    make: Optional[str] = None                  # e.g. "Toyota"
    models: Optional[List[str]] = None          # e.g. ["Camry", "Accord"]
    year_min: Optional[int] = None              # e.g. 2020
    year_max: Optional[int] = None              # e.g. 2023
    price_min: Optional[int] = None             # in dollars, e.g. 20000
    price_max: Optional[int] = None             # in dollars, e.g. 30000
    mileage_min: Optional[int] = None           # in miles, e.g. 0
    mileage_max: Optional[int] = None  
    '''         # in miles, e.g. 50000
    search_radius: Optional[int] = None         # in miles, e.g. 50
    '''

class WatchlistCard(BaseModel):
    id: int
    title: str
    subtitle: str                 # e.g. "2020–2023 • $20,000–$28,000"
    locationLabel: str            # e.g. "Los Angeles Area"
    updatedLabel: str             # e.g. "Updated 2 hours ago"
    tags: List[str]               # e.g. ["Used", "Certified Pre-Owned"]
    isActive: bool
    alertsEnabled: bool
    newCount: int
    totalMatches: int
    searchCriteria: WatchlistSearchCriteria     # The parameters used to filter listings


class WatchlistsListResponse(BaseModel):
    summary: dict                 # {"active": 3, "matches": 6, "withAlerts": 3}
    watchlists: List[WatchlistCard] # all the cards of the watchlists


class WatchlistStats(BaseModel):
    totalMatches: int
    newToday: int
    avgMatch: int                 # percentage integer, e.g. 92


class WatchlistDetailResponse(BaseModel):
    watchlist: WatchlistCard
    stats: WatchlistStats


class WatchlistMatch(BaseModel):
    isNew: bool
    isGoodDeal: Optional[bool] = None
    listing: CarListingSummary


class WatchlistMatchesResponse(BaseModel):
    watchlistId: int
    matches: List[WatchlistMatch]