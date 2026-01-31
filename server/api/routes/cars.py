"""
Car listings endpoints (Summary + Detail)
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Literal
from pydantic import BaseModel
from models.schemas import CarListingSummary, CarListingDetail, Seller, MarketAnalysis, PricePoint, SimilarListing


router = APIRouter()

# ---------------------------
# Temporary in-memory data
# (replace with DB later)
# ---------------------------
LISTINGS: dict[int, CarListingDetail] = {
    1: CarListingDetail(
        id=1,
        make="Toyota",
        model="Camry",
        year=2022,
        price="$24,500",
        predictedPrice="$26,800",
        dealLabel="Good Deal",
        mileage="15,000 mi",
        location="Los Angeles, CA",
        image="https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&h=600&fit=crop",
        description="Well-maintained 2022 Toyota Camry with low mileage. Single owner, garage kept. Regular maintenance records available.",
        url="https://example.com/listing/1",
        seller=Seller(
            name="Mike Chen",
            avatar="https://api.dicebear.com/7.x/avataaars/svg?seed=Mike",
            phone="+1 (555) 123-4567",
            type="Private Seller"
        ),
        features=[
            "Backup Camera", "Bluetooth Connectivity", "Cruise Control", "USB Ports",
            "Air Conditioning", "Power Windows", "Keyless Entry", "Safety Sense 2.0"
        ],
        marketAnalysis=MarketAnalysis(
            depreciation={"oneYear": 12, "threeYear": 32, "fiveYear": 55},
            marketTrend="stable",
            priceHistory=[
                PricePoint(month="Jan", averagePrice=27500),
                PricePoint(month="Feb", averagePrice=27200),
                PricePoint(month="Mar", averagePrice=26900),
                PricePoint(month="Apr", averagePrice=26700),
                PricePoint(month="May", averagePrice=26500),
                PricePoint(month="Jun", averagePrice=26800),
            ],
            similarListings=[
                SimilarListing(price="$25,200", mileage="18,000 mi", daysOnMarket=12),
                SimilarListing(price="$23,800", mileage="22,000 mi", daysOnMarket=8),
                SimilarListing(price="$26,100", mileage="12,000 mi", daysOnMarket=24),
            ],
        ),
    )
}


# ---------------------------
# Helpers
# ---------------------------
def to_summary(detail: CarListingDetail) -> CarListingSummary:
    return CarListingSummary(
        id=detail.id,
        make=detail.make,
        model=detail.model,
        year=detail.year,
        price=detail.price,
        predictedPrice=detail.predictedPrice,
        dealLabel=detail.dealLabel,
        mileage=detail.mileage,
        location=detail.location,
        image=detail.image,
    )


# ---------------------------
# Routes
# ---------------------------
@router.get("/", response_model=List[CarListingSummary])
async def get_pop_cars(
    make: Optional[str] = Query(None, description="Filter by make"),
    model: Optional[str] = Query(None, description="Filter by model"),
    min_year: Optional[int] = Query(None, description="Minimum year"),
    max_year: Optional[int] = Query(None, description="Maximum year"),
    limit: int = Query(4, ge=1, le=100, description="Number of results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
):
    """
    Browse listings (summary only).
    """
    all_listings = list(LISTINGS.values())

    # basic filtering (expand later)
    if make:
        all_listings = [l for l in all_listings if l.make.lower() == make.lower()]
    if model:
        all_listings = [l for l in all_listings if l.model.lower() == model.lower()]
    if min_year:
        all_listings = [l for l in all_listings if l.year >= min_year]
    if max_year:
        all_listings = [l for l in all_listings if l.year <= max_year]

    # pagination
    sliced = all_listings[offset: offset + limit]

    return [to_summary(l) for l in sliced]


@router.get("/brands")
async def get_brands():
    # Later: load dynamically from DB
    brands = sorted({l.make for l in LISTINGS.values()})
    return {"brands": brands}


@router.get("/{car_id}", response_model=CarListingDetail)
async def get_car_by_id(car_id: int):
    """
    Get full listing details.
    """
    car = LISTINGS.get(car_id)
    if not car:
        raise HTTPException(status_code=404, detail=f"Car with ID {car_id} not found")
    return car
