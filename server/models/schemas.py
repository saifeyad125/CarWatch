from pydantic import BaseModel
from typing import List, Optional, Literal


# Listings 

class CarListingSummary(BaseModel):
    id: int
    make: str
    model: str
    trim: Optional[str] = None
    year: int
    price: str              #in DHS
    predictedPrice: Optional[str] = None
    predictedPriceLgbm: Optional[str] = None
    modelUsed: Optional[str] = None  # "LightGBM" or "CatBoost"
    dealLabel: Optional[Literal["Good Deal", "Fair", "Overpriced"]] = None
    confidenceLabel: Optional[str] = None
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
    marketAnalysis: Optional[MarketAnalysis] = None
    similarListings: Optional[List[CarListingSummary]] = None
    confidenceLow: Optional[str] = None
    confidenceHigh: Optional[str] = None


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
    listings: List[CarListingSummary] = []


class AnalysisResponse(BaseModel):
    listingId: int
    make: str
    model: str
    trim: Optional[str] = None
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
    avgMatch: Optional[int] = None

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
    isActive: bool = False
    alertsEnabled: bool = False
    type: str = "car"
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


# Dealers

class DealerSummary(BaseModel):
    id: int
    name: str
    logoUrl: Optional[str] = None
    location: Optional[str] = None
    phone: Optional[str] = None
    listingCount: int = 0

class DealerDetail(DealerSummary):
    email: Optional[str] = None

class DealersListResponse(BaseModel):
    dealers: List[DealerSummary]

class DealerCarListingSummary(BaseModel):
    id: int
    make: str
    model: str
    trim: Optional[str] = None
    year: int
    price: str
    predictedPrice: Optional[str] = None
    predictedPriceLgbm: Optional[str] = None
    modelUsed: Optional[str] = None
    dealLabel: Optional[Literal["Good Deal", "Fair", "Overpriced"]] = None
    confidenceLabel: Optional[str] = None
    mileage: str
    location: str
    image: str
    dealerName: str
    dealerLogo: Optional[str] = None
    dealerId: int

class DealerCarListingsResponse(BaseModel):
    listings: List[DealerCarListingSummary]
    total: int


# Parts

class PartCategorySummary(BaseModel):
    id: int
    name: str
    slug: str
    icon: Optional[str] = None
    parentId: Optional[int] = None
    partCount: int = 0

class PartCategoryWithChildren(PartCategorySummary):
    children: List[PartCategorySummary] = []
    breadcrumb: List[PartCategorySummary] = []

class PartCompatibilityResponse(BaseModel):
    brand: str
    model: str
    yearFrom: Optional[int] = None
    yearTo: Optional[int] = None

class PartListingSummary(BaseModel):
    id: int
    name: str
    price: str
    image: Optional[str] = None
    sellerName: str
    categoryBreadcrumb: str
    compatibleCars: str

class PartListingsResponse(BaseModel):
    parts: List[PartListingSummary]
    total: int

class PartDetail(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    price: str
    partNumber: Optional[str] = None
    image: Optional[str] = None
    images: List[str] = []
    categoryBreadcrumb: List[PartCategorySummary]
    compatibilities: List[PartCompatibilityResponse]
    sellerName: str
    sellerPhone: Optional[str] = None
    sellerLocation: Optional[str] = None


# Browse Hub

class BrowseCountsResponse(BaseModel):
    used_cars: int
    dealer_cars: int
    parts: int

class SearchResultGroup(BaseModel):
    results: list
    total: int

class SearchResponse(BaseModel):
    used_cars: SearchResultGroup
    dealer_cars: SearchResultGroup
    parts: SearchResultGroup


class PartWatchlistSearchCriteria(BaseModel):
    category_id: Optional[int] = None
    keyword: Optional[str] = None
    compatible_brand: Optional[str] = None
    compatible_model: Optional[str] = None
    price_min: Optional[int] = None
    price_max: Optional[int] = None
