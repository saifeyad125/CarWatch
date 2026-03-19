"""
Unit tests for hp_to_midpoint and cc_to_midpoint converters.
Run from server/: python -m tests.test_feature_prep
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from api.services.constants import hp_to_midpoint, cc_to_midpoint


def test_hp_to_midpoint():
    # Dubizzle range strings
    assert hp_to_midpoint("300 - 399 HP") == 349.5
    assert hp_to_midpoint("0 - 99 HP") == 49.5
    assert hp_to_midpoint("900+ HP") == 950.0

    # DubiCars plain numbers with suffix
    assert hp_to_midpoint("400 HP") == 400.0
    assert hp_to_midpoint("620 HP") == 620.0
    assert hp_to_midpoint("164 HP") == 164.0

    # Edge cases
    assert hp_to_midpoint(None) is None
    assert hp_to_midpoint("") is None
    assert hp_to_midpoint("unknown") is None

    print("hp_to_midpoint: ALL PASSED")


def test_cc_to_midpoint():
    # Dubizzle range strings
    assert cc_to_midpoint("2000 - 2499 cc") == 2249.5
    assert cc_to_midpoint("4000+ cc") == 4000.0
    assert cc_to_midpoint("0 - 499 cc") == 249.5

    # DubiCars litre format -> cc
    assert cc_to_midpoint("5.6 L") == 5600.0
    assert cc_to_midpoint("2.7 L") == 2700.0
    assert cc_to_midpoint("3.9 L") == 3900.0
    assert cc_to_midpoint("4 L") == 4000.0
    assert cc_to_midpoint("2 L") == 2000.0

    # Edge cases
    assert cc_to_midpoint(None) is None
    assert cc_to_midpoint("") is None
    assert cc_to_midpoint("unknown") is None

    print("cc_to_midpoint: ALL PASSED")


from api.services.scheduler import _build_features


class FakeListing:
    def __init__(self, **kwargs):
        defaults = {
            "brand": "Toyota", "model": "Camry", "year": 2020, "kms": 50000,
            "fuel_type": "Petrol", "body_type": "Sedan", "trim": "LE",
            "cylinders": "4", "horsepower": "200 - 299 HP",
            "engine_capacity": "2000 - 2499 cc", "regional_specs": "GCC Specs",
            "steering_side": "Left Hand", "doors": "4 door",
            "seating_capacity": "5 Seater",
        }
        defaults.update(kwargs)
        for k, v in defaults.items():
            setattr(self, k, v)


def test_build_features_dubizzle():
    listing = FakeListing(horsepower="300 - 399 HP", engine_capacity="3000 - 3499 cc")
    f = _build_features(listing)
    assert f["horsepower"] == 349.5, f"Expected 349.5, got {f['horsepower']}"
    assert f["engine_cc"] == 3249.5, f"Expected 3249.5, got {f['engine_cc']}"
    # raw strings passed through
    assert f["doors"] == "4 door"
    assert f["seating_capacity"] == "5 Seater"
    assert f["cylinders"] == "4"
    print("test_build_features_dubizzle: PASSED")


def test_build_features_dubicars():
    listing = FakeListing(
        horsepower="620 HP", engine_capacity="3.9 L",
        cylinders="8 Cylinders", doors="2 Doors", seating_capacity="4 seater",
    )
    f = _build_features(listing)
    assert f["horsepower"] == 620.0, f"Expected 620.0, got {f['horsepower']}"
    assert f["engine_cc"] == 3900.0, f"Expected 3900.0, got {f['engine_cc']}"
    assert f["doors"] == "2 Doors"
    assert f["cylinders"] == "8 Cylinders"
    print("test_build_features_dubicars: PASSED")


def test_build_features_none_passthrough():
    listing = FakeListing(
        horsepower=None, engine_capacity=None, doors=None,
        fuel_type=None, trim=None, cylinders=None,
    )
    f = _build_features(listing)
    assert f["horsepower"] is None
    assert f["engine_cc"] is None
    assert f["doors"] is None
    assert f["fuel_type"] is None
    assert f["trim"] is None
    assert f["cylinders"] is None
    print("test_build_features_none_passthrough: PASSED")


if __name__ == "__main__":
    test_hp_to_midpoint()
    test_cc_to_midpoint()
    print("\nAll converter tests passed!")
    test_build_features_dubizzle()
    test_build_features_dubicars()
    test_build_features_none_passthrough()
    print("All _build_features tests passed!")
