"""
Health check endpoint
"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """Check if the API is running."""
    return {
        "status": "healthy",
        "service": "CarWatch API"
    }


@router.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Welcome to CarWatch API",
        "docs": "/docs",
        "health": "/health"
    }
