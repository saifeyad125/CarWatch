"""
CarWatch Backend API
FastAPI-based backend for the CarWatch application.
"""
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import routers
from api.routes import cars, predictions, health

app = FastAPI(
    title="CarWatch API",
    description="Backend API for CarWatch - UAE Used Car Price Predictor",
    version="1.0.0"
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("API_HOST", "0.0.0.0"),
        port=int(os.getenv("API_PORT", "8000")),
        reload=os.getenv("DEBUG", "true").lower() == "true"
    )
