"""
Baseline prediction test — run BEFORE applying the fix.
Records current (broken) predictions for 7 real listings.
Run from server/: python -m tests.test_prediction_baseline
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from api.services.ml_service import MLService
from api.services.scheduler import _build_features

# Real listings from production DB (DubiCars + Dubizzle)
TEST_LISTINGS = [
    {"id": 13340, "brand": "Ferrari", "model": "Roma", "year": 2021, "price": 770000,
     "kms": 19700, "horsepower": "620 HP", "engine_capacity": "3.9 L",
     "cylinders": "8 Cylinders", "doors": "2 Doors", "seating_capacity": "4 seater",
     "fuel_type": "Petrol", "body_type": "Coupe", "steering_side": "Left hand",
     "regional_specs": "GCC", "source": "dubicars"},
    {"id": 13339, "brand": "Rolls-Royce", "model": "Wraith", "year": 2017, "price": 650000,
     "kms": 30000, "horsepower": "624 HP", "engine_capacity": "6.6 L",
     "cylinders": "12 Cylinders", "doors": "2 Doors", "seating_capacity": "4 seater",
     "fuel_type": "Petrol", "body_type": "Coupe", "steering_side": "Left hand",
     "regional_specs": "GCC", "source": "dubicars"},
    {"id": 13465, "brand": "Porsche", "model": "Cayman", "year": 2023, "price": 740000,
     "kms": 6018, "horsepower": "493 HP", "engine_capacity": "4 L",
     "cylinders": "6 Cylinders", "doors": "2 Doors", "seating_capacity": "2 seater",
     "fuel_type": "Petrol", "body_type": "Coupe", "steering_side": "Left hand",
     "regional_specs": "GCC", "source": "dubicars"},
    {"id": 13473, "brand": "Nissan", "model": "Patrol", "year": 2016, "price": 82000,
     "kms": 238000, "horsepower": "400 HP", "engine_capacity": "5.6 L",
     "cylinders": "8 Cylinders", "doors": "5 Doors", "seating_capacity": "8 seater",
     "fuel_type": "Petrol", "body_type": "SUV/Crossover", "steering_side": "Left hand",
     "regional_specs": "GCC", "source": "dubicars"},
    {"id": 13342, "brand": "Toyota", "model": "Prado", "year": 2019, "price": 116000,
     "kms": 78000, "horsepower": "164 HP", "engine_capacity": "2.7 L",
     "cylinders": "4 Cylinders", "doors": "4 Doors", "seating_capacity": "7 seater",
     "fuel_type": "Petrol", "body_type": "SUV/Crossover", "steering_side": "Left hand",
     "regional_specs": "GCC", "source": "dubicars"},
    {"id": 13461, "brand": "Mazda", "model": "CX-9", "trim": "GT", "year": 2014, "price": 26000,
     "kms": 126000, "horsepower": "200 - 299 HP", "engine_capacity": "3500 - 3999 cc",
     "cylinders": "6", "doors": "5+ doors", "seating_capacity": "7 Seater",
     "fuel_type": "Petrol", "body_type": "SUV", "steering_side": "Left Hand",
     "regional_specs": "GCC Specs", "source": "dubizzle"},
    {"id": 13457, "brand": "Mercedes-Benz", "model": "M-Class", "trim": "ML 400 AMG 4MATIC",
     "year": 2015, "price": 38000, "kms": 175000, "horsepower": "300 - 399 HP",
     "engine_capacity": "3000 - 3499 cc", "cylinders": "6", "doors": "5+ doors",
     "seating_capacity": "5 Seater", "fuel_type": "Petrol", "body_type": "SUV",
     "steering_side": "Left Hand", "regional_specs": "GCC Specs", "source": "dubizzle"},
]


class FakeListing:
    """Mimics a DB Listing object from a dict."""
    def __init__(self, d):
        for k, v in d.items():
            setattr(self, k, v)
        # ensure all expected attrs exist
        for attr in ["trim", "doors", "seating_capacity"]:
            if not hasattr(self, attr):
                setattr(self, attr, None)


def main():
    ml = MLService()
    if not ml.model_loaded:
        print("CatBoost model not loaded. Run from server/ directory.")
        return

    print(f"{'ID':<8} {'Car':<35} {'Actual':>10} {'Predicted':>10} {'Error':>8}")
    print("-" * 75)

    for listing_data in TEST_LISTINGS:
        fake = FakeListing(listing_data)
        features = _build_features(fake)
        result = ml.predict_price(features)
        predicted = int(result["predicted_price"])
        actual = listing_data["price"]
        error_pct = (predicted - actual) / actual * 100
        car = f"{listing_data['year']} {listing_data['brand']} {listing_data['model']}"
        print(f"{listing_data['id']:<8} {car:<35} {actual:>10,} {predicted:>10,} {error_pct:>+7.1f}%")


if __name__ == "__main__":
    main()
