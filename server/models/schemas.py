"""
Pydantic schemas for API request / response bodies.
Kept separate from SQLAlchemy models in db/models.py.
"""
from pydantic import BaseModel
from typing import List, Optional, Literal


# ───────────────────────── Listings ─────────────────────────

class CarListingSummary(BaseModel):
    id: int
    make: str
    model: str
    year: int
    price: str                                              # "$52,000"
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


class MarketAnalysis(BaseModel):
    depreciation: dict
    marketTrend: str
    priceHistory: List[PricePoint]

class CarListingDetail(CarListingSummary):
    description: str
    seller: Seller
    url: str
    features: List[str]
    marketAnalysis: MarketAnalysis
    similarListings: Optional[List[CarListingSummary]] = None


# ───────────────────────── Watchlists ─────────────────────────

class WatchlistSearchCriteria(BaseModel):
    """Search parameters for filtering car listings"""
    make: Optional[str] = None
    models: Optional[List[str]] = None
    year_min: Optional[int] = None
    year_max: Optional[int] = None
    price_min: Optional[int] = None         # AED
    price_max: Optional[int] = None
    mileage_min: Optional[int] = None
    mileage_max: Optional[int] = None
    locations: Optional[List[str]] = None   # e.g. ["Dubai, UAE", "Abu Dhabi, UAE"]

class WatchlistCard(BaseModel):
    id: int
    title: str
    subtitle: str
    locationLabel: str
    updatedLabel: str
    tags: List[str]
    isActive: bool
    alertsEnabled: bool
    newCount: int
    totalMatches: int
    searchCriteria: WatchlistSearchCriteria

class WatchlistsListResponse(BaseModel):
    summary: dict
    watchlists: List[WatchlistCard]

class WatchlistStats(BaseModel):
    totalMatches: int
    newToday: int
    avgMatch: int

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


# ───────────────────────── Create / Update ─────────────────────────

class WatchlistCreate(BaseModel):
    title: str
    subtitle: Optional[str] = None
    locationLabel: Optional[str] = None
    tags: List[str] = []
    isActive: bool = False          # inactive by default until user activates
    alertsEnabled: bool = False
    searchCriteria: WatchlistSearchCriteria

class WatchlistStatusUpdate(BaseModel):
    isActive: bool
