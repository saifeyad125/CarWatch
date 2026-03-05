"""
ML Service – two-stage CatBoost inference with sigmoid-gated luxury correction.

Stage 1: RMSEWithUncertainty base model → mu_log, sigma_log
Sigmoid gate: w = sigmoid((mu1 - log1p(800k)) / TAU)
Stage 2: Residual correction model → delta (log-space)
Final: expm1(mu1 + w*delta + 0.5*sigma^2)  with calibrated 90% CI
"""
import os
import json
import numpy as np
from pathlib import Path
from typing import Any, Dict


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(x, -500, 500)))


class MLService:
    """Two-stage price prediction with calibrated uncertainty."""

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

        self._load_models()

    # ── loading ──────────────────────────────────────────────

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

    # ── prediction ───────────────────────────────────────────

    def predict_price(self, features: Dict[str, Any]) -> Dict[str, float]:
        """
        Two-stage price prediction with uncertainty.

        Returns dict with predicted_price, confidence_low, confidence_high,
        confidence_level, gate_weight.
        """
        if not self.model_loaded:
            raise RuntimeError("Model not loaded.")

        # ---- Stage 1 ----
        s1_vector = self._prepare_stage1_features(features)
        mu_log, sigma_log = self._predict_stage1(s1_vector)

        # Floor sigma at p5 of test-set distribution to avoid unrealistically
        # narrow CIs for common feature combinations the model is overconfident on
        sigma_log = max(sigma_log, 0.08)

        # ---- Sigmoid gate ----
        w = float(_sigmoid(np.array((mu_log - np.log1p(self.lux_threshold)) / self.tau)))

        # ---- Stage 2 (if model available) ----
        delta = 0.0
        if self.stage2_model is not None:
            s2_vector = self._prepare_stage2_features(features, mu_log, sigma_log)
            delta = float(self.stage2_model.predict(s2_vector)[0])

        # ---- Final log prediction ----
        final_log = mu_log + w * delta

        # ---- Back-transform with bias correction (log-normal) ----
        predicted_price = float(np.expm1(final_log + 0.5 * sigma_log ** 2))
        predicted_price = max(predicted_price, 0.0)

        # ---- Calibrated uncertainty with luxury inflation ----
        sigma_cal = sigma_log * self.calibration_factor
        sigma_adj = sigma_cal * (1.0 + self.beta * w)

        z = 1.645  # 90 % CI
        confidence_low = float(np.expm1(final_log - z * sigma_adj))
        confidence_high = float(np.expm1(final_log + z * sigma_adj))
        confidence_low = max(confidence_low, 0.0)
        confidence_high = max(confidence_high, 0.0)

        return {
            "predicted_price": round(predicted_price, 0),
            "confidence_low": round(confidence_low, 0),
            "confidence_high": round(confidence_high, 0),
            "confidence_level": 0.90,
            "gate_weight": round(w, 4),
        }

    # ── Stage 1 helpers ──────────────────────────────────────

    def _predict_stage1(self, feature_vector: list):
        """Return (mu_log, sigma_log) from Stage 1."""
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

    def _prepare_stage1_features(self, f: Dict[str, Any]) -> list:
        """
        Build the Stage 1 feature row.
        Order must match training: cat_features + num_features
          cat: brand, model, trim, fuel_type, body_type, steering_side,
               regional_specs, doors, seating_capacity, cylinders, age_bucket
          num: kms, vehicle_age, kms_per_year, horsepower_mid, engine_cc_mid
        """
        current_year = 2026
        vehicle_age = current_year - f.get("year", 2020)
        kms = f.get("mileage", 50_000)
        kms_per_year = kms / max(vehicle_age, 1)

        row = [
            # categorical
            f.get("brand", "Unknown"),
            f.get("model", "Unknown"),
            f.get("trim", "Unknown"),
            f.get("fuel_type", "Petrol"),
            f.get("body_type", "Unknown"),
            f.get("steering_side", "Left"),
            f.get("regional_specs", "GCC"),
            str(f.get("doors", "4")),
            str(f.get("seating_capacity", "5")),
            str(f.get("cylinders", "4")),
            self._age_bucket(vehicle_age),
            # numerical
            kms,
            vehicle_age,
            kms_per_year,
            f.get("horsepower", 200),
            f.get("engine_cc", 2000),
        ]
        return [row]  # CatBoost expects 2-D

    # ── Stage 2 helpers ──────────────────────────────────────

    def _prepare_stage2_features(
        self, f: Dict[str, Any], mu_log: float, sigma_log: float
    ) -> list:
        """
        Build the Stage 2 feature row.
        Order from calibration_info.json → stage2_features:
          brand, model, vehicle_age, kms_per_year, horsepower_mid,
          engine_cc_mid, fuel_type, body_type, regional_specs, trim,
          mu_log_stage1, sigma_log_stage1
        """
        current_year = 2026
        vehicle_age = current_year - f.get("year", 2020)
        kms = f.get("mileage", 50_000)
        kms_per_year = kms / max(vehicle_age, 1)

        row = [
            f.get("brand", "Unknown"),
            f.get("model", "Unknown"),
            vehicle_age,
            kms_per_year,
            f.get("horsepower", 200),
            f.get("engine_cc", 2000),
            f.get("fuel_type", "Petrol"),
            f.get("body_type", "Unknown"),
            f.get("regional_specs", "GCC"),
            f.get("trim", "Unknown"),
            mu_log,
            sigma_log,
        ]
        return [row]

    # ── utilities ────────────────────────────────────────────

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
