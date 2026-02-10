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
    ),
    2: CarListingDetail(
        id=2,
        make="Honda",
        model="Accord",
        year=2023,
        price="$28,900",
        predictedPrice="$29,500",
        dealLabel="Fair",
        mileage="8,200 mi",
        location="Dubai, UAE",
        image="https://images.unsplash.com/photo-1590362891991-f776e747a588?w=800&h=600&fit=crop",
        description="2023 Honda Accord Sport with premium features. Excellent fuel efficiency, one owner, all service records.",
        url="https://example.com/listing/2",
        seller=Seller(
            name="Al Futtaim Motors",
            avatar="https://api.dicebear.com/7.x/avataaars/svg?seed=Dealer1",
            phone="+971 4 123 4567",
            type="Certified Dealer"
        ),
        features=[
            "Sunroof", "Leather Seats", "Lane Assist", "Adaptive Cruise Control",
            "Apple CarPlay", "Android Auto", "Wireless Charging", "LED Headlights"
        ],
        marketAnalysis=MarketAnalysis(
            depreciation={"oneYear": 8, "threeYear": 25, "fiveYear": 45},
            marketTrend="stable",
            priceHistory=[
                PricePoint(month="Jan", averagePrice=30000),
                PricePoint(month="Feb", averagePrice=29800),
                PricePoint(month="Mar", averagePrice=29600),
                PricePoint(month="Apr", averagePrice=29400),
                PricePoint(month="May", averagePrice=29200),
                PricePoint(month="Jun", averagePrice=29500),
            ],
            similarListings=[
                SimilarListing(price="$29,200", mileage="10,000 mi", daysOnMarket=5),
                SimilarListing(price="$28,500", mileage="12,000 mi", daysOnMarket=15),
                SimilarListing(price="$30,100", mileage="6,000 mi", daysOnMarket=8),
            ],
        ),
    ),
    3: CarListingDetail(
        id=3,
        make="BMW",
        model="X5",
        year=2021,
        price="$52,000",
        predictedPrice="$48,500",
        dealLabel="Overpriced",
        mileage="32,000 mi",
        location="Abu Dhabi, UAE",
        image="https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=800&h=600&fit=crop",
        description="Luxurious BMW X5 with M Sport package. Loaded with premium features, well-maintained.",
        url="https://example.com/listing/3",
        seller=Seller(
            name="Premium Auto Trading",
            avatar="https://api.dicebear.com/7.x/avataaars/svg?seed=Dealer2",
            phone="+971 2 456 7890",
            type="Luxury Dealer"
        ),
        features=[
            "M Sport Package", "Panoramic Roof", "Harman Kardon Audio", "Heads Up Display",
            "360 Camera", "Ventilated Seats", "Gesture Control", "Wireless Charging"
        ],
        marketAnalysis=MarketAnalysis(
            depreciation={"oneYear": 15, "threeYear": 38, "fiveYear": 60},
            marketTrend="declining",
            priceHistory=[
                PricePoint(month="Jan", averagePrice=50000),
                PricePoint(month="Feb", averagePrice=49500),
                PricePoint(month="Mar", averagePrice=49000),
                PricePoint(month="Apr", averagePrice=48800),
                PricePoint(month="May", averagePrice=48500),
                PricePoint(month="Jun", averagePrice=48500),
            ],
            similarListings=[
                SimilarListing(price="$48,000", mileage="35,000 mi", daysOnMarket=20),
                SimilarListing(price="$49,500", mileage="28,000 mi", daysOnMarket=12),
                SimilarListing(price="$47,000", mileage="40,000 mi", daysOnMarket=30),
            ],
        ),
    ),
    4: CarListingDetail(
        id=4,
        make="Tesla",
        model="Model 3",
        year=2023,
        price="$38,500",
        predictedPrice="$42,000",
        dealLabel="Good Deal",
        mileage="5,400 mi",
        location="Dubai, UAE",
        image="https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800&h=600&fit=crop",
        description="Almost new Tesla Model 3 Long Range. Full self-driving capability, immaculate condition.",
        url="https://example.com/listing/4",
        seller=Seller(
            name="Sarah Johnson",
            avatar="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
            phone="+971 50 123 4567",
            type="Private Seller"
        ),
        features=[
            "Autopilot", "Premium Audio", "Glass Roof", "Heated Seats",
            "Supercharging", "Over-the-Air Updates", "Mobile App Control", "Sentry Mode"
        ],
        marketAnalysis=MarketAnalysis(
            depreciation={"oneYear": 10, "threeYear": 28, "fiveYear": 48},
            marketTrend="rising",
            priceHistory=[
                PricePoint(month="Jan", averagePrice=40000),
                PricePoint(month="Feb", averagePrice=40500),
                PricePoint(month="Mar", averagePrice=41000),
                PricePoint(month="Apr", averagePrice=41500),
                PricePoint(month="May", averagePrice=42000),
                PricePoint(month="Jun", averagePrice=42000),
            ],
            similarListings=[
                SimilarListing(price="$40,000", mileage="8,000 mi", daysOnMarket=3),
                SimilarListing(price="$39,500", mileage="6,500 mi", daysOnMarket=7),
                SimilarListing(price="$43,000", mileage="3,000 mi", daysOnMarket=2),
            ],
        ),
    ),
    5: CarListingDetail(
        id=5,
        make="Mercedes-Benz",
        model="C-Class",
        year=2022,
        price="$35,800",
        predictedPrice="$36,200",
        dealLabel="Fair",
        mileage="18,500 mi",
        location="Sharjah, UAE",
        image="https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&h=600&fit=crop",
        description="Elegant Mercedes C-Class with AMG styling. Premium interior, excellent condition.",
        url="https://example.com/listing/5",
        seller=Seller(
            name="Elite Motors",
            avatar="https://api.dicebear.com/7.x/avataaars/svg?seed=Elite",
            phone="+971 6 789 0123",
            type="Certified Dealer"
        ),
        features=[
            "AMG Line", "Burmester Audio", "Ambient Lighting", "Memory Seats",
            "Digital Cockpit", "Parking Assist", "Keyless Go", "Multi-beam LED"
        ],
        marketAnalysis=MarketAnalysis(
            depreciation={"oneYear": 14, "threeYear": 35, "fiveYear": 58},
            marketTrend="stable",
            priceHistory=[
                PricePoint(month="Jan", averagePrice=37000),
                PricePoint(month="Feb", averagePrice=36800),
                PricePoint(month="Mar", averagePrice=36500),
                PricePoint(month="Apr", averagePrice=36300),
                PricePoint(month="May", averagePrice=36200),
                PricePoint(month="Jun", averagePrice=36200),
            ],
            similarListings=[
                SimilarListing(price="$36,500", mileage="20,000 mi", daysOnMarket=10),
                SimilarListing(price="$35,000", mileage="25,000 mi", daysOnMarket=18),
                SimilarListing(price="$37,800", mileage="15,000 mi", daysOnMarket=6),
            ],
        ),
    ),
    6: CarListingDetail(
        id=6,
        make="Nissan",
        model="Patrol",
        year=2023,
        price="$58,900",
        predictedPrice="$62,000",
        dealLabel="Good Deal",
        mileage="12,300 mi",
        location="Dubai, UAE",
        image="https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&h=600&fit=crop",
        description="Brand new condition Nissan Patrol Platinum. Perfect family SUV, fully loaded with features.",
        url="https://example.com/listing/6",
        seller=Seller(
            name="Arabian Automobiles",
            avatar="https://api.dicebear.com/7.x/avataaars/svg?seed=Arabian",
            phone="+971 4 321 9876",
            type="Authorized Dealer"
        ),
        features=[
            "7 Seats", "4WD", "Leather Interior", "Cooled Seats",
            "DVD Entertainment", "Bose Audio", "Sunroof", "Adaptive Suspension"
        ],
        marketAnalysis=MarketAnalysis(
            depreciation={"oneYear": 12, "threeYear": 30, "fiveYear": 52},
            marketTrend="stable",
            priceHistory=[
                PricePoint(month="Jan", averagePrice=62000),
                PricePoint(month="Feb", averagePrice=62000),
                PricePoint(month="Mar", averagePrice=62000),
                PricePoint(month="Apr", averagePrice=62000),
                PricePoint(month="May", averagePrice=62000),
                PricePoint(month="Jun", averagePrice=62000),
            ],
            similarListings=[
                SimilarListing(price="$60,000", mileage="15,000 mi", daysOnMarket=14),
                SimilarListing(price="$61,500", mileage="10,000 mi", daysOnMarket=9),
                SimilarListing(price="$59,000", mileage="18,000 mi", daysOnMarket=21),
            ],
        ),
    ),
    7: CarListingDetail(
        id=7,
        make="Ford",
        model="Mustang",
        year=2021,
        price="$32,500",
        predictedPrice="$31,800",
        dealLabel="Fair",
        mileage="22,000 mi",
        location="Ajman, UAE",
        image="https://images.unsplash.com/photo-1584345604476-8ec5f5e8e699?w=800&h=600&fit=crop",
        description="Sporty Ford Mustang EcoBoost. Thrilling performance, well-maintained, clean history.",
        url="https://example.com/listing/7",
        seller=Seller(
            name="Ahmed Al Mansoori",
            avatar="https://api.dicebear.com/7.x/avataaars/svg?seed=Ahmed",
            phone="+971 50 987 6543",
            type="Private Seller"
        ),
        features=[
            "Sport Mode", "Performance Exhaust", "Premium Sound", "Track Apps",
            "Rear Camera", "Push Start", "Cruise Control", "Dual Climate"
        ],
        marketAnalysis=MarketAnalysis(
            depreciation={"oneYear": 15, "threeYear": 35, "fiveYear": 58},
            marketTrend="stable",
            priceHistory=[
                PricePoint(month="Jan", averagePrice=32500),
                PricePoint(month="Feb", averagePrice=32200),
                PricePoint(month="Mar", averagePrice=32000),
                PricePoint(month="Apr", averagePrice=31900),
                PricePoint(month="May", averagePrice=31800),
                PricePoint(month="Jun", averagePrice=31800),
            ],
            similarListings=[
                SimilarListing(price="$33,000", mileage="18,000 mi", daysOnMarket=11),
                SimilarListing(price="$31,000", mileage="28,000 mi", daysOnMarket=25),
                SimilarListing(price="$34,500", mileage="15,000 mi", daysOnMarket=7),
            ],
        ),
    ),
    8: CarListingDetail(
        id=8,
        make="Lexus",
        model="ES 350",
        year=2022,
        price="$42,000",
        predictedPrice="$44,500",
        dealLabel="Good Deal",
        mileage="14,800 mi",
        location="Dubai, UAE",
        image="https://images.unsplash.com/photo-1622998311093-8ec76b4c7728?w=800&h=600&fit=crop",
        description="Luxurious Lexus ES 350 with impeccable service history. Comfort and reliability combined.",
        url="https://example.com/listing/8",
        seller=Seller(
            name="Luxury Car Center",
            avatar="https://api.dicebear.com/7.x/avataaars/svg?seed=Luxury",
            phone="+971 4 567 8901",
            type="Premium Dealer"
        ),
        features=[
            "Mark Levinson Audio", "Panoramic View Monitor", "Heated & Cooled Seats", "HUD",
            "Adaptive Cruise", "Lane Keeping", "Wireless Charging", "Premium Leather"
        ],
        marketAnalysis=MarketAnalysis(
            depreciation={"oneYear": 11, "threeYear": 28, "fiveYear": 50},
            marketTrend="stable",
            priceHistory=[
                PricePoint(month="Jan", averagePrice=45000),
                PricePoint(month="Feb", averagePrice=44800),
                PricePoint(month="Mar", averagePrice=44600),
                PricePoint(month="Apr", averagePrice=44500),
                PricePoint(month="May", averagePrice=44500),
                PricePoint(month="Jun", averagePrice=44500),
            ],
            similarListings=[
                SimilarListing(price="$43,500", mileage="16,000 mi", daysOnMarket=8),
                SimilarListing(price="$41,000", mileage="20,000 mi", daysOnMarket=16),
                SimilarListing(price="$45,000", mileage="10,000 mi", daysOnMarket=4),
            ],
        ),
    ),
    9: CarListingDetail(
        id=9,
        make="Toyota",
        model="Camry",
        year=2021,
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
    ),
    10: CarListingDetail(
        id=10,
        make="Toyota",
        model="Camry",
        year=2020,
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
    ),
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
