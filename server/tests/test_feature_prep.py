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


if __name__ == "__main__":
    test_hp_to_midpoint()
    test_cc_to_midpoint()
    print("\nAll converter tests passed!")
