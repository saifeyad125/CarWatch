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
