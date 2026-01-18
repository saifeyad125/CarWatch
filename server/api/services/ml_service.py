"""
ML Service for loading and using the CatBoost model.
"""
import os
import json
import numpy as np
from pathlib import Path
from typing import Any, Dict, Optional


class MLService:
    """Service class for ML model operations."""
    
    def __init__(self):
        self.model = None
        self.calibration_info = None
        self.model_loaded = False
        self._load_model()
    
    def _load_model(self):
        """Load the CatBoost model and calibration info."""
        try:
            from catboost import CatBoostRegressor
            
            # Get paths from environment or use defaults
            base_path = Path(__file__).parent.parent.parent.parent
            model_path = os.getenv(
                "ML_MODEL_PATH",
                str(base_path / "server/models/final_model_uncertainty.cbm")
            )
            calibration_path = os.getenv(
                "ML_CALIBRATION_PATH",
                str(base_path / "server/models/calibration_info.json")
            )
            
            # Load model
            if Path(model_path).exists():
                self.model = CatBoostRegressor()
                self.model.load_model(model_path)
                self.model_loaded = True
                print(f"✅ Model loaded from: {model_path}")
            else:
                print(f"⚠️ Model file not found: {model_path}")
            
            # Load calibration info
            if Path(calibration_path).exists():
                with open(calibration_path, 'r') as f:
                    self.calibration_info = json.load(f)
                print(f"✅ Calibration info loaded from: {calibration_path}")
            else:
                print(f"⚠️ Calibration file not found: {calibration_path}")
                self.calibration_info = {"calibration_factor": 1.0}
                
        except ImportError:
            print("⚠️ CatBoost not installed. Install with: pip install catboost")
        except Exception as e:
            print(f"❌ Error loading model: {e}")
    
    def predict_price(self, features: Dict[str, Any]) -> Dict[str, float]:
        """
        Predict price with uncertainty.
        
        Args:
            features: Dictionary of car features
            
        Returns:
            Dictionary with predicted_price, confidence_low, confidence_high
        """
        if not self.model_loaded:
            raise RuntimeError("Model not loaded. Check model file path.")
        
        # Prepare features for model
        feature_vector = self._prepare_features(features)
        
        # Get prediction with uncertainty
        try:
            pred = self.model.predict(
                feature_vector,
                prediction_type="RMSEWithUncertainty"
            )
            pred = np.asarray(pred)
            
            if pred.ndim == 2 and pred.shape[1] >= 2:
                mu_log = pred[0, 0]
                sigma_log = np.sqrt(max(pred[0, 1], 0))
            else:
                mu_log = pred[0] if pred.ndim > 0 else pred
                sigma_log = 0.1  # Default uncertainty
                
        except Exception:
            # Fallback to simple prediction
            mu_log = self.model.predict(feature_vector)[0]
            sigma_log = 0.1
        
        # Apply calibration
        calibration_factor = self.calibration_info.get("calibration_factor", 1.0)
        sigma_calibrated = sigma_log * calibration_factor
        
        # Convert from log space to actual prices
        z_score = 1.645  # 90% confidence interval
        
        predicted_price = np.exp(mu_log)
        confidence_low = np.exp(mu_log - z_score * sigma_calibrated)
        confidence_high = np.exp(mu_log + z_score * sigma_calibrated)
        
        return {
            "predicted_price": round(float(predicted_price), 0),
            "confidence_low": round(float(confidence_low), 0),
            "confidence_high": round(float(confidence_high), 0),
            "confidence_level": 0.90
        }
    
    def _prepare_features(self, features: Dict[str, Any]) -> list:
        """
        Prepare feature vector for the model.
        
        This should match the feature order used during training.
        """
        # Calculate derived features
        current_year = 2026
        vehicle_age = current_year - features.get("year", 2020)
        kms = features.get("mileage", 50000)
        kms_per_year = kms / max(vehicle_age, 1)
        
        # Map features to model input order
        # TODO: This should match the exact feature order from training
        feature_values = [
            features.get("brand", "Unknown"),
            features.get("model", "Unknown"),
            features.get("trim", "Unknown"),
            features.get("fuel_type", "Petrol"),
            features.get("body_type", "Unknown"),
            features.get("steering_side", "Left"),
            features.get("regional_specs", "GCC"),
            str(features.get("doors", "4")),
            str(features.get("seating_capacity", "5")),
            str(features.get("cylinders", "4")),
            self._get_age_bucket(vehicle_age),
            kms,
            vehicle_age,
            kms_per_year,
            features.get("horsepower", 200),
            features.get("engine_cc", 2000),
        ]
        
        return [feature_values]
    
    def _get_age_bucket(self, age: int) -> str:
        """Convert age to bucket category."""
        if age <= 1:
            return "0-1"
        elif age <= 3:
            return "2-3"
        elif age <= 5:
            return "4-5"
        elif age <= 7:
            return "6-7"
        elif age <= 10:
            return "8-10"
        else:
            return "10+"
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about the loaded model."""
        return {
            "model_loaded": self.model_loaded,
            "calibration_factor": self.calibration_info.get("calibration_factor") if self.calibration_info else None,
            "model_type": "CatBoost with RMSEWithUncertainty",
            "target_coverage": 0.90
        }
