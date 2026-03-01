"""
CarWatch Backend API
FastAPI-based backend for the CarWatch application.
"""
import os
import logging
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
from api.routes import cars, predictions, health, watchlists, profile, notifications
from api.services.watchlists_service import initialize_watchlists
from api.services.scheduler import start_scheduler, stop_scheduler

app = FastAPI(
    title="CarWatch API",
    description="Backend API for CarWatch - UAE Used Car Price Predictor",
    version="1.0.0",
)

# CORS middleware for Next.js frontend
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(cars.router, prefix="/api/cars", tags=["Cars"])
app.include_router(predictions.router, prefix="/api/predictions", tags=["Predictions"])
app.include_router(watchlists.router, prefix="/api/watchlists", tags=["Watchlists"])
app.include_router(profile.router, prefix="/api/profile", tags=["Profile"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])


@app.on_event("startup")
async def startup_event():
    # Create tables if they don't exist (Alembic takes over for production)
    db_models.Base.metadata.create_all(bind=engine)
    print("✓ Database tables ready")

    # Initialize watchlist matches
    db = SessionLocal()
    try:
        initialize_watchlists(db)
    finally:
        db.close()

    # Start the hourly scraper scheduler
    start_scheduler()


@app.on_event("shutdown")
async def shutdown_event():
    stop_scheduler()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("API_PORT", "8000")),
        reload=os.getenv("DEBUG", "true").lower() == "true",
    )
