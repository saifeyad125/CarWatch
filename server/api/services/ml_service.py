import os
import json
import re
import numpy as np
import pandas as pd
from datetime import datetime
from pathlib import Path
from typing import Any, Dict


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(x, -500, 500)))


class MLService:

    def __init__(self):
        self.stage1_model = None
        self.stage2_model = None
        self.calibration_info = None
        self.model_loaded = False

        # Defaults (overridden by calibration_info.json)
        self.calibration_factor = 1.352
        self.lux_threshold = 800_000
        self.tau = 0.3
        self.beta = 0.4
        self.stage2_features: list[str] = []
        self.usage_profiles = None

        self._load_models()

    # loading

    def _load_models(self):
        try:
            from catboost import CatBoostRegressor
        except ImportError:
            print("CatBoost not installed. pip install catboost")
            return

        base = Path(__file__).parent.parent.parent  # server/
        models_dir = base / "models"

        # Stage 1
        s1_path = os.getenv("ML_MODEL_PATH", str(models_dir / "final_model_uncertainty.cbm"))
        if Path(s1_path).exists():
            self.stage1_model = CatBoostRegressor()
            self.stage1_model.load_model(s1_path)
            self.model_loaded = True
            print(f"Stage 1 loaded: {s1_path}")
        else:
            print(f"Stage 1 not found: {s1_path}")

        # Stage 2
        s2_path = os.getenv("ML_STAGE2_PATH", str(models_dir / "stage2_luxury_model.cbm"))
        if Path(s2_path).exists():
            self.stage2_model = CatBoostRegressor()
            self.stage2_model.load_model(s2_path)
            print(f"Stage 2 loaded: {s2_path}")
        else:
            print(f"Stage 2 not found: {s2_path}")

        # Calibration config
        cal_path = os.getenv("ML_CALIBRATION_PATH", str(models_dir / "calibration_info.json"))
        if Path(cal_path).exists():
            with open(cal_path) as f:
                self.calibration_info = json.load(f)
            self.calibration_factor = self.calibration_info.get(
                "recommended_for_production",
                self.calibration_info.get("calibration_factor", 1.579),
            )
            s2cfg = self.calibration_info.get("stage2_config", {})
            self.lux_threshold = s2cfg.get("luxury_threshold_aed", 800_000)
            self.tau = s2cfg.get("sigmoid_tau", 0.3)
            self.beta = s2cfg.get("sigma_inflation_beta", 0.4)
            self.stage2_features = s2cfg.get("stage2_features", [])
            print(f"Calibration loaded: factor={self.calibration_factor:.4f}, "
                  f"tau={self.tau}, beta={self.beta}")
        else:
            print(f"Calibration not found: {cal_path}")

        # Usage profiles
        profiles_path = os.getenv(
            "USAGE_PROFILES_PATH", str(models_dir / "usage_profiles.json")
        )
        if Path(profiles_path).exists():
            with open(profiles_path) as f:
                self.usage_profiles = json.load(f)
            print(f"Usage profiles loaded: {profiles_path}")
        else:
            print(f"Usage profiles not found: {profiles_path}")

    # prediction

    def predict_price(self, features: Dict[str, Any]) -> Dict[str, float]:
        if not self.model_loaded:
            raise RuntimeError("Model not loaded.")

        # stage 1
        s1_vector = self._prepare_stage1_features(features)
        mu_log, sigma_log = self._predict_stage1(s1_vector)

        # Floor sigma at p5 of test-set distribution to avoid unrealistically
        # narrow CIs for common feature combinations the model is overconfident on
        sigma_log = max(sigma_log, 0.08)

        # sigmoid gate
        w = float(_sigmoid(np.array((mu_log - np.log1p(self.lux_threshold)) / self.tau)))

        # stage 2
        delta = 0.0
        if self.stage2_model is not None:
            s2_vector = self._prepare_stage2_features(features, mu_log, sigma_log)
            delta = float(self.stage2_model.predict(s2_vector)[0])

        # combine
        final_log = mu_log + w * delta

        # back-transform with log-normal bias correction
        predicted_price = float(np.expm1(final_log + 0.5 * sigma_log ** 2))
        predicted_price = max(predicted_price, 0.0)

        # calibrated CI (inflated for luxury segment)
        sigma_cal = sigma_log * self.calibration_factor
        sigma_adj = sigma_cal * (1.0 + self.beta * w)

        z = 0.842  # 60 % CI
        confidence_low = float(np.expm1(final_log - z * sigma_adj))
        confidence_high = float(np.expm1(final_log + z * sigma_adj))
        confidence_low = max(confidence_low, 0.0)
        confidence_high = max(confidence_high, 0.0)

        return {
            "predicted_price": round(predicted_price, 0),
            "confidence_low": round(confidence_low, 0),
            "confidence_high": round(confidence_high, 0),
            "confidence_level": 0.60,
            "gate_weight": round(w, 4),
            "sigma_log": round(sigma_log, 6),
        }

    # stage 1 helpers

    def _predict_stage1(self, feature_vector: list):
        try:
            pred = self.stage1_model.predict(
                feature_vector, prediction_type="RMSEWithUncertainty"
            )
            pred = np.asarray(pred)
            if pred.ndim == 2 and pred.shape[1] >= 2:
                mu_log = float(pred[0, 0])
                sigma_log = float(np.sqrt(max(pred[0, 1], 0.0)))
            else:
                mu_log = float(pred[0]) if pred.ndim > 0 else float(pred)
                sigma_log = 0.25
        except Exception:
            mu_log = float(self.stage1_model.predict(feature_vector)[0])
            sigma_log = 0.25
        return mu_log, sigma_log

    CAT_FEATURES_S1 = [
        "brand", "model", "trim", "fuel_type", "body_type", "steering_side",
        "regional_specs", "doors", "seating_capacity", "cylinders", "age_bucket",
    ]
    NUM_FEATURES_S1 = ["kms", "vehicle_age", "kms_per_year", "horsepower_mid", "engine_cc_mid"]

    def _prepare_stage1_features(self, f: Dict[str, Any]) -> pd.DataFrame:
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
            "horsepower_mid": f.get("horsepower") if f.get("horsepower") is not None else np.nan,
            "engine_cc_mid": f.get("engine_cc") if f.get("engine_cc") is not None else np.nan,
        }
        df = pd.DataFrame([row])
        for col in self.CAT_FEATURES_S1:
            df[col] = df[col].astype(str)
        return df[self.CAT_FEATURES_S1 + self.NUM_FEATURES_S1]

    # stage 2 helpers

    S2_FEATURES = [
        "brand", "model", "vehicle_age", "kms_per_year", "horsepower_mid",
        "engine_cc_mid", "fuel_type", "body_type", "regional_specs", "trim",
        "mu_log_stage1", "sigma_log_stage1",
    ]

    def _prepare_stage2_features(
        self, f: Dict[str, Any], mu_log: float, sigma_log: float
    ) -> pd.DataFrame:
        current_year = datetime.now().year
        vehicle_age = current_year - (f.get("year") or 2020)
        kms = f.get("mileage") or 50_000
        kms_per_year = kms / max(vehicle_age, 1)

        row = {
            "brand": f.get("brand") or "Unknown",
            "model": f.get("model") or "Unknown",
            "vehicle_age": vehicle_age,
            "kms_per_year": kms_per_year,
            "horsepower_mid": f.get("horsepower") if f.get("horsepower") is not None else np.nan,
            "engine_cc_mid": f.get("engine_cc") if f.get("engine_cc") is not None else np.nan,
            "fuel_type": f.get("fuel_type") or "Unknown",
            "body_type": f.get("body_type") or "Unknown",
            "regional_specs": f.get("regional_specs") or "Unknown",
            "trim": f.get("trim") or "Unknown",
            "mu_log_stage1": mu_log,
            "sigma_log_stage1": sigma_log,
        }
        return pd.DataFrame([row])[self.S2_FEATURES]

    # utilities

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

    def get_annual_kms(self, brand: str, model: str) -> int:
        # model -> brand -> global fallback
        if not self.usage_profiles:
            return 20_000  # Safe default

        brands = self.usage_profiles.get("brands", {})
        brand_data = brands.get(brand, {})
        model_data = brand_data.get("models", {}).get(model, {})

        if model_data.get("median_kms_per_year"):
            return model_data["median_kms_per_year"]
        if brand_data.get("brand_median_kms_per_year"):
            return brand_data["brand_median_kms_per_year"]
        return self.usage_profiles.get("global_median_kms_per_year", 20_000)

    def compute_depreciation(
        self, features: Dict[str, Any], current_predicted_price: float | None = None
    ) -> Dict[str, Any]:
        # reuses current_predicted_price if given to skip redundant inference
        if not self.model_loaded:
            return {}

        brand = features.get("brand", "Unknown")
        model_name = features.get("model", "Unknown")
        annual_kms = self.get_annual_kms(brand, model_name)

        current_year = datetime.now().year
        year = features.get("year", 2020)
        current_age = current_year - year
        current_kms = features.get("mileage", 50_000)

        # Reuse current predicted price if already computed
        if current_predicted_price is not None:
            current_price = current_predicted_price
        else:
            current_pred = self.predict_price(features)
            current_price = current_pred["predicted_price"]

        projections = []
        prev_price = current_price
        for years_ahead in [1, 3, 5]:
            projected_age = current_age + years_ahead
            projected_kms = current_kms + (annual_kms * years_ahead)
            synthetic_year = current_year - projected_age

            # Build modified features
            proj_features = dict(features)
            proj_features["year"] = synthetic_year
            proj_features["mileage"] = projected_kms

            pred = self.predict_price(proj_features)
            raw_price = int(pred["predicted_price"])

            # Enforce monotonic decreasing: a car should never appreciate
            capped_price = min(raw_price, prev_price)
            prev_price = capped_price

            projections.append({
                "years_ahead": years_ahead,
                "projected_age": projected_age,
                "projected_kms": projected_kms,
                "predicted_price": capped_price,
            })

        return {
            "current_price_predicted": int(current_price),
            "annual_kms": annual_kms,
            "projections": projections,
        }

    def get_model_info(self) -> Dict[str, Any]:
        return {
            "model_loaded": self.model_loaded,
            "stage2_loaded": self.stage2_model is not None,
            "calibration_factor": self.calibration_factor,
            "luxury_threshold": self.lux_threshold,
            "sigmoid_tau": self.tau,
            "sigma_inflation_beta": self.beta,
            "model_type": "Two-stage CatBoost with RMSEWithUncertainty + luxury residual correction",
            "target_coverage": 0.90,
        }
