"""
Price prediction endpoints using the CatBoost model.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from api.services.ml_service import MLService

router = APIRouter()

# Initialize ML service
ml_service = MLService()


class CarFeatures(BaseModel):
    """Input features for price prediction."""
    brand: str = Field(..., description="Car brand (e.g., Toyota, BMW)")
    model: str = Field(..., description="Car model (e.g., Camry, X5)")
    year: int = Field(..., ge=1990, le=2026, description="Year of manufacture")
    mileage: int = Field(..., ge=0, description="Mileage in kilometers")
    fuel_type: Optional[str] = Field("Petrol", description="Fuel type")
    body_type: Optional[str] = Field(None, description="Body type (SUV, Sedan, etc.)")
    trim: Optional[str] = Field(None, description="Trim level")
    cylinders: Optional[int] = Field(None, description="Number of cylinders")
    horsepower: Optional[int] = Field(None, description="Horsepower")
    engine_cc: Optional[int] = Field(None, description="Engine capacity in CC")
    regional_specs: Optional[str] = Field("GCC", description="Regional specs")
    steering_side: Optional[str] = Field("Left", description="Steering side")


class PredictionResponse(BaseModel):
    """Response model for price prediction."""
    predicted_price: float = Field(..., description="Predicted price in AED")
    confidence_low: float = Field(..., description="Lower bound of confidence interval")
    confidence_high: float = Field(..., description="Upper bound of confidence interval")
    confidence_level: float = Field(0.90, description="Confidence level (e.g., 0.90 for 90%)")


class DealAnalysis(BaseModel):
    """Deal analysis response."""
    predicted_price: float
    actual_price: float
    difference: float
    difference_percent: float
    verdict: str  # "Great Deal", "Fair Price", "Overpriced"
    confidence_interval: tuple[float, float]


@router.post("/predict", response_model=PredictionResponse)
async def predict_price(features: CarFeatures):
    """
    Predict the price of a used car based on its features.
    
    Returns the predicted price along with confidence intervals.
    """
    try:
        prediction = ml_service.predict_price(features.model_dump())
        return prediction
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )


@router.post("/analyze-deal")
async def analyze_deal(features: CarFeatures, asking_price: float):
    """
    Analyze if a car listing is a good deal.
    
    Compares the asking price against the predicted market value.
    """
    try:
        prediction = ml_service.predict_price(features.model_dump())
        predicted = prediction["predicted_price"]
        
        difference = predicted - asking_price
        difference_percent = (difference / predicted) * 100
        
        # Determine verdict
        if difference_percent > 10:
            verdict = "Great Deal"
        elif difference_percent > -5:
            verdict = "Fair Price"
        else:
            verdict = "Overpriced"
        
        return {
            "predicted_price": predicted,
            "actual_price": asking_price,
            "difference": difference,
            "difference_percent": round(difference_percent, 2),
            "verdict": verdict,
            "confidence_interval": (
                prediction["confidence_low"],
                prediction["confidence_high"]
            )
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )


@router.get("/model-info")
async def get_model_info():
    """Get information about the ML model."""
    return ml_service.get_model_info()
