import os
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import DB wiring (must come after dotenv so DATABASE_URL is set)
from db.database import engine, Base, SessionLocal
from db import models as db_models          # registers ORM models with Base

# Import routers
from api.routes import cars, predictions, health, watchlists, profile, notifications, chat, dealers, dealer_cars, parts, browse, motorcycles, motorcycle_dealers, motorcycle_dealer_cars, sell
from api.services.watchlists_service import initialize_watchlists
from api.services.scheduler import start_scheduler, stop_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger = logging.getLogger(__name__)
    db_models.Base.metadata.create_all(bind=engine)
    logger.info("Database tables ready")

    db = SessionLocal()
    try:
        initialize_watchlists(db)
    finally:
        db.close()

    start_scheduler()

    yield
    stop_scheduler()


app = FastAPI(
    title="CarWatch API",
    description="Backend API for CarWatch - UAE Used Car Price Predictor",
    version="1.0.0",
    lifespan=lifespan,
)

origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://(car-watch.*\.vercel\.app|(www\.)?carwatch\.co)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(cars.router, prefix="/api/cars", tags=["Cars"])
app.include_router(predictions.router, prefix="/api/predictions", tags=["Predictions"])
app.include_router(watchlists.router, prefix="/api/watchlists", tags=["Watchlists"])
app.include_router(profile.router, prefix="/api/profile", tags=["Profile"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(dealers.router, prefix="/api/dealers", tags=["Dealers"])
app.include_router(dealer_cars.router, prefix="/api/dealer-cars", tags=["Dealer Cars"])
app.include_router(parts.router, prefix="/api/parts", tags=["Parts"])
app.include_router(browse.router, prefix="/api/browse", tags=["Browse"])
app.include_router(motorcycles.router, prefix="/api/motorcycles", tags=["Motorcycles"])
app.include_router(motorcycle_dealers.router, prefix="/api/motorcycle-dealers", tags=["Motorcycle Dealers"])
app.include_router(motorcycle_dealer_cars.router, prefix="/api/motorcycle-dealer-cars", tags=["Motorcycle Dealer Cars"])
app.include_router(sell.router, prefix="/api/sell", tags=["Sell"])



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", os.getenv("API_PORT", "8000"))),
        reload=os.getenv("DEBUG", "false").lower() == "true",
    )
