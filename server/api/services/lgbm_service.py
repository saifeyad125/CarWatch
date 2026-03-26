import os
import logging
import re
import numpy as np
import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

logger = logging.getLogger(__name__)


class LightGBMService:

    CAT_FEATURES = [
        "brand", "model", "trim", "fuel_type", "body_type",
        "steering_side", "regional_specs", "doors", "seating_capacity",
        "cylinders", "age_bucket",
    ]
    NUM_FEATURES = [
        "kms", "vehicle_age", "kms_per_year", "horsepower_mid", "engine_cc_mid",
    ]
    ALL_FEATURES = CAT_FEATURES + NUM_FEATURES

    def __init__(self):
        self.model = None
        self.model_loaded = False
        self._load_model()

    def _load_model(self):
        try:
            import lightgbm as lgb
        except (ImportError, OSError) as e:
            logger.warning("LightGBM not available: %s", e)
            return

        base = Path(__file__).parent.parent.parent  # server/
        model_path = os.getenv(
            "LGBM_MODEL_PATH",
            str(base / "models" / "lightgbm_stage1.txt"),
        )

        if Path(model_path).exists():
            self.model = lgb.Booster(model_file=model_path)
            self.model_loaded = True
            logger.info("LightGBM loaded: %s", model_path)
        else:
            logger.warning("LightGBM model not found: %s", model_path)

    def predict_price(self, features: Dict[str, Any]) -> Dict[str, float]:
        if not self.model_loaded:
            raise RuntimeError("LightGBM model not loaded.")

        df = self._prepare_features(features)
        mu_log = float(self.model.predict(df)[0])
        predicted_price = float(np.expm1(mu_log))
        predicted_price = max(predicted_price, 0.0)

        return {"predicted_price": round(predicted_price, 0)}

    def _prepare_features(self, f: Dict[str, Any]) -> pd.DataFrame:
        current_year = datetime.now().year
        vehicle_age = current_year - (f.get("year") or 2020)
        kms = f.get("mileage") or 50_000
        kms_per_year = kms / max(vehicle_age, 1)

        row = {
            "brand": f.get("brand") or "Unknown",
            "model": f.get("model") or "Unknown",
            "trim": f.get("trim") or "Unknown",
            "fuel_type": f.get("fuel_type") or "Unknown",
            "body_type": f.get("body_type") or "Unknown",
            "steering_side": f.get("steering_side") or "Unknown",
            "regional_specs": f.get("regional_specs") or "Unknown",
            "doors": f.get("doors") or "Unknown",
            "seating_capacity": f.get("seating_capacity") or "Unknown",
            "cylinders": self._clean_cylinders(f.get("cylinders")),
            "age_bucket": self._age_bucket(vehicle_age),
            "kms": kms,
            "vehicle_age": vehicle_age,
            "kms_per_year": kms_per_year,
            "horsepower_mid": f.get("horsepower") if f.get("horsepower") is not None else 249.5,
            "engine_cc_mid": f.get("engine_cc") if f.get("engine_cc") is not None else 2749.5,
        }

        df = pd.DataFrame([row])
        for col in self.CAT_FEATURES:
            df[col] = df[col].astype("category")
        return df[self.ALL_FEATURES]

    @staticmethod
    def _age_bucket(age: int) -> str:
        if age <= 1:
            return "0-1"
        if age <= 3:
            return "2-3"
        if age <= 6:
            return "4-6"
        if age <= 10:
            return "7-10"
        return "10+"

    @staticmethod
    def _clean_cylinders(raw) -> str:
        if raw is None:
            return "Unknown"
        s = str(raw).strip()
        if not s:
            return "Unknown"
        m = re.match(r"(\d+)", s)
        if m:
            return m.group(1)
        return "Unknown"
