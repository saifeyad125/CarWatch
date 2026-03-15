from pydantic import BaseModel
from typing import List, Optional, Literal


# Listings 

class CarListingSummary(BaseModel):
    id: int
    make: str
    model: str
    year: int
    price: str              #in DHS
    predictedPrice: Optional[str] = None
    dealLabel: Optional[Literal["Good Deal", "Fair", "Overpriced"]] = None
    mileage: str
    location: str
    image: str
    source: str = "dubizzle" # e.g. "dubizzle", "dubicar"

class CarListingsResponse(BaseModel):
    listings: List[CarListingSummary]
    total: int

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
    images: List[str] = []
    marketAnalysis: MarketAnalysis
    similarListings: Optional[List[CarListingSummary]] = None


# Detailed Analysis 

class DepreciationPoint(BaseModel):
    yearsAhead: int
    projectedAge: int
    projectedKms: int
    predictedPrice: int
    retentionPct: float


class PriceMileagePoint(BaseModel):
    kms: int
    price: int


class PriceYearPoint(BaseModel):
    year: int
    avgPrice: int
    count: int


class Competitor(BaseModel):
    brand: str
    model: str
    avgPrice: int
    avgKms: int
    avgYear: int
    count: int


class AnalysisResponse(BaseModel):
    listingId: int
    make: str
    model: str
    year: int
    currentPrice: int
    predictedPrice: int
    annualKms: int
    depreciationCurve: List[DepreciationPoint]
    priceVsMileage: List[PriceMileagePoint]
    priceVsYear: List[PriceYearPoint]
    competitors: List[Competitor]


# Watchlists 

class WatchlistSearchCriteria(BaseModel):
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


# Create / Update 

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


# Profile 

class ProfileStats(BaseModel):
    watchlistsCount: int
    alertsSent: int
    totalMatches: int

class ProfileResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str] = None
    location: Optional[str] = None
    status: str  # "free" | "premium" | "admin"
    avatarSeed: str
    stats: ProfileStats

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    avatarSeed: Optional[str] = None


# Notifications 

class NotificationResponse(BaseModel):
    id: int
    watchlistId: int
    listingId: Optional[int] = None
    type: str
    title: str
    message: str
    isRead: bool
    createdAt: str
    watchlistName: Optional[str] = None

class NotificationsListResponse(BaseModel):
    notifications: List[NotificationResponse]
    unreadCount: int

class UnreadCountResponse(BaseModel):
    unreadCount: int

# Chat 

class ChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    createdAt: str  # ISO timestamp

class ChatConversationSummary(BaseModel):
    id: int
    title: str
    lastMessage: Optional[str] = None
    updatedAt: str  # ISO timestamp

class ChatConversationDetail(BaseModel):
    id: int
    title: str
    messages: List[ChatMessageResponse]

class ChatSendMessage(BaseModel):
    content: str
