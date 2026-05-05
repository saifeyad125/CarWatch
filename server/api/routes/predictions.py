import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

logger = logging.getLogger(__name__)
from api.services.ml_service import MLService
from api.services.lgbm_service import LightGBMService
from api.services.constants import HYBRID_PRICE_THRESHOLD

router = APIRouter()

# init ml services
ml_service = MLService()
try:
    lgbm_service = LightGBMService()
except Exception as e:
    logger.error(f"LightGBM service failed to load: {e}")
    lgbm_service = None


class CarFeatures(BaseModel):
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
    predicted_price: float = Field(..., description="Predicted price in AED")
    confidence_low: float = Field(..., description="Lower bound of confidence interval")
    confidence_high: float = Field(..., description="Upper bound of confidence interval")
    confidence_level: float = Field(0.90, description="Confidence level (e.g., 0.90 for 90%)")
    gate_weight: float = Field(0.0, description="Sigmoid gate weight (0=budget, 1=luxury)")


class DealAnalysis(BaseModel):
    predicted_price: float
    actual_price: float
    difference: float
    difference_percent: float
    verdict: str
    model_used: str
    confidence_interval: tuple[float, float]


class ForecastRequest(BaseModel):
    brand: str = Field(..., description="Car brand")
    model: str = Field(..., description="Car model")
    year: int = Field(..., ge=1990, le=2026, description="Year of manufacture")
    mileage: int = Field(..., ge=0, le=500_000, description="Current mileage in km")
    annual_kms: int = Field(..., ge=1_000, le=100_000, description="Expected annual driving in km")
    fuel_type: Optional[str] = Field("Petrol", description="Fuel type")
    body_type: Optional[str] = Field(None, description="Body type")
    trim: Optional[str] = Field(None, description="Trim level")
    cylinders: Optional[int] = Field(None, description="Number of cylinders")
    horsepower: Optional[int] = Field(None, description="Horsepower")
    engine_cc: Optional[int] = Field(None, description="Engine capacity in CC")
    regional_specs: Optional[str] = Field("GCC", description="Regional specs")
    steering_side: Optional[str] = Field("Left", description="Steering side")


class ForecastPoint(BaseModel):
    years_ahead: int
    projected_age: int
    projected_kms: int
    predicted_price: int
    retention_pct: float


class ForecastResponse(BaseModel):
    current_price: int
    annual_kms: int
    projections: list[ForecastPoint]


@router.post("/predict", response_model=PredictionResponse)
async def predict_price(features: CarFeatures):
    # always CatBoost here (confidence intervals); for hybrid routing use /analyze-deal
    try:
        prediction = ml_service.predict_price(features.model_dump())
        return prediction
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )


@router.post("/analyze-deal", response_model=DealAnalysis)
async def analyze_deal(features: CarFeatures, asking_price: float):
    # routes LightGBM <800k, CatBoost >=800k
    try:
        feature_dict = features.model_dump()

        # catboost always runs (we need the confidence intervals)
        catboost_result = ml_service.predict_price(feature_dict)

        if (asking_price > 0 and asking_price < HYBRID_PRICE_THRESHOLD
                and lgbm_service and lgbm_service.model_loaded):
            lgbm_result = lgbm_service.predict_price(feature_dict)
            predicted = lgbm_result["predicted_price"]
            model_used = "LightGBM"
        else:
            predicted = catboost_result["predicted_price"]
            model_used = "CatBoost"

        difference = predicted - asking_price
        difference_percent = (difference / predicted) * 100 if predicted else 0

        if difference_percent > 10:
            verdict = "Good Deal"
        elif difference_percent > -5:
            verdict = "Fair"
        else:
            verdict = "Overpriced"

        return {
            "predicted_price": predicted,
            "actual_price": asking_price,
            "difference": difference,
            "difference_percent": round(difference_percent, 2),
            "verdict": verdict,
            "model_used": model_used,
            "confidence_interval": (
                catboost_result["confidence_low"],
                catboost_result["confidence_high"],
            )
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )


@router.get("/model-info")
async def get_model_info():
    return ml_service.get_model_info()


@router.post("/forecast", response_model=ForecastResponse)
async def forecast(req: ForecastRequest):
    try:
        feature_dict = req.model_dump()
        annual_kms = feature_dict.pop("annual_kms")
        result = ml_service.compute_forecast(feature_dict, annual_kms)
        if not result:
            raise HTTPException(status_code=503, detail="Model not loaded")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecast failed: {str(e)}")
