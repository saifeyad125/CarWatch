import re

HYBRID_PRICE_THRESHOLD = 800_000  # AED, below this LightGBM is primary

HP_MIDPOINTS = {
    "0 - 99 HP": 49.5,
    "100 - 199 HP": 149.5,
    "200 - 299 HP": 249.5,
    "300 - 399 HP": 349.5,
    "400 - 499 HP": 449.5,
    "500 - 599 HP": 549.5,
    "600 - 699 HP": 649.5,
    "700 - 799 HP": 749.5,
    "800 - 899 HP": 849.5,
    "900+ HP": 950.0,
}

CC_MIDPOINTS = {
    "0 - 499 cc": 249.5,
    "500 - 999 cc": 749.5,
    "1000 - 1499 cc": 1249.5,
    "1500 - 1999 cc": 1749.5,
    "2000 - 2499 cc": 2249.5,
    "2500 - 2999 cc": 2749.5,
    "3000 - 3499 cc": 3249.5,
    "3500 - 3999 cc": 3749.5,
    "4000+ cc": 4000.0,
}

_NUM_RE = re.compile(r"[\d.]+")


def hp_to_midpoint(raw: str | None) -> float | None:
    if not raw or not raw.strip():
        return None
    raw = raw.strip()
    mid = HP_MIDPOINTS.get(raw)
    if mid is not None:
        return mid
    m = _NUM_RE.search(raw)
    if m:
        try:
            return float(m.group())
        except ValueError:
            pass
    return None


def cc_to_midpoint(raw: str | None) -> float | None:
    if not raw or not raw.strip():
        return None
    raw = raw.strip()
    mid = CC_MIDPOINTS.get(raw)
    if mid is not None:
        return mid
    # DubiCars litre format: "5.6 L", "2.7 L"
    if raw.upper().endswith("L"):
        m = _NUM_RE.search(raw)
        if m:
            try:
                return float(m.group()) * 1000.0
            except ValueError:
                pass
    # plain number fallback
    m = _NUM_RE.search(raw)
    if m:
        try:
            return float(m.group())
        except ValueError:
            pass
    return None
