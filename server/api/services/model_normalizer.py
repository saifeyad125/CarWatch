import re

BRAND_MAP = {
    "Mercedes Maybach": "Mercedes-Maybach",
}

# (brand, dubicars_model) -> training_model
# Merge explicit maps including Maybach
EXPLICIT_MAP = {
    ("Honda", "CRV"): "CR-V",
    ("Honda", "HRV"): "HR-V",
    ("Honda", "Civic Type R"): "Civic",

    ("Mazda", "CX3"): "CX-3",
    ("Mazda", "CX5"): "CX-5",
    ("Mazda", "CX9"): "CX-9",
    ("Mazda", "MX5"): "MX-5",

    ("Nissan", "XTrail"): "X-Trail",
    ("Nissan", "XTerra"): "Xterra",
    ("Nissan", "Patrol Super Safari"): "Patrol Safari",
    ("Nissan", "400 Z"): "400Z",

    ("Toyota", "RAV4"): "Rav 4",
    ("Toyota", "CHR"): "C-HR",
    ("Toyota", "Land Cruiser Pick Up"): "Land Cruiser",

    ("Volkswagen", "T ROC"): "T-Roc",
    ("Volkswagen", "Golf GTI"): "Golf",
    ("Volkswagen", "Golf R"): "Golf",

    ("Ford", "F 150"): "F-Series",
    ("Ford", "F 150 Raptor"): "F-Series",
    ("Ford", "Ranger Raptor"): "Ranger",
    ("Ford", "Explorer Sport Trac"): "Explorer",

    ("Bentley", "Continental GT"): "Continental",
    ("Bentley", "Continental GTC"): "Continental",

    ("Lamborghini", "Huracan Evo Spyder"): "Huracan",

    ("Chevrolet", "Corvette Z06"): "Corvette",

    ("Jaguar", "F Pace"): "F-Pace",
    ("Jaguar", "F Type"): "F-Type",

    ("Dodge", "Ram Van"): "Ram",

    # Audi
    ("Audi", "etron"): "e-tron",
    ("Audi", "etron GT"): "e-tron GT",
    ("Audi", "RS etron GT"): "RS e-tron",
    ("Audi", "RS3"): "S3/RS3",
    ("Audi", "RS6"): "S6/RS6",
    ("Audi", "RS7"): "S7/RS7",
    ("Audi", "Cabriolet"): "TT",

    ("Porsche", "911"): "Carrera / 911",
    ("Porsche", "718 Boxster"): "Boxster",
    ("Porsche", "718 Cayman"): "Cayman",

    ("Mercedes-Maybach", "GLS600 Maybach"): "GLS-Class",
    ("Mercedes-Maybach", "S500 Maybach"): "S-Class",
    ("Mercedes-Maybach", "S580 Maybach"): "S-Class",
    ("Mercedes-Maybach", "S680 Maybach"): "S-Class",
    ("Mercedes-Maybach", "62"): "62",
}

# Formatting-only fixes: trim is NOT extracted (original name has no extra info)
FORMATTING_ONLY = {
    ("Honda", "CRV"), ("Honda", "HRV"),
    ("Mazda", "CX3"), ("Mazda", "CX5"), ("Mazda", "CX9"), ("Mazda", "MX5"),
    ("Nissan", "XTrail"), ("Nissan", "XTerra"), ("Nissan", "400 Z"),
    ("Toyota", "RAV4"), ("Toyota", "CHR"),
    ("Volkswagen", "T ROC"),
    ("Jaguar", "F Pace"), ("Jaguar", "F Type"),
    ("Audi", "etron"), ("Audi", "etron GT"),
}

# Lexus explicit mappings
LEXUS_MAP = {
    "ES350": "ES-Series",
    "GS350": "GS-Series",
    "GX460": "GX 460",
    "GX550": "GX 550",
    "IS300": "IS-Series",
    "IS350": "IS-Series",
    "LC500": "LC 500",
    "LS 430": "LS-Series",
    "LS460": "LS-Series",
    "LS600h": "LS-Series",
    "LX 570": "LX-Series",
    "NX 250": "NX-Series",
    "NX350h": "NX-Series",
    "RX350": "RX-Series",
    "RX450h": "RX-Series",
    "UX300h": "UX-Series",
}

# BMW models that already exist in training and should pass through
_BMW_PASSTHROUGH = {
    "X1", "X2", "X3", "X4", "X5", "X6", "X7", "XM",
    "M2", "M3", "M4", "M5", "M8",
    "i4", "i5", "i7", "i8", "iX", "iX1", "iX3",
    "Z4",
    "1-Series", "2-Series", "3-Series", "4-Series", "5-Series",
    "6-Series", "7-Series", "8-Series",
}

# Mercedes prefix rules in priority order (longest first)
# Each tuple: (prefix, target, check_coupe)
_MERC_PREFIX_RULES = [
    ("AMG GT", "AMG", False),
    ("GT 63", "AMG", False),
    ("GLE ", "GLE-Class", True),    # check_coupe -> GLE Coupe
    ("GLC ", "GLC", True),          # check_coupe -> GLC Coupe
    ("GLS ", "GLS-Class", False),
    ("GLB ", "GLB", False),
    ("GLA ", "GLA", False),
    ("GL ", "GL-Class", False),
    ("CLE ", "CLE-Class", False),
    ("CLS ", "CLS-Class", False),
    ("CLA ", "CLA", False),
    ("CL ", "CL-Class", False),
    ("EQE ", "EQE", False),
    ("EQS ", "EQS", False),
    ("EQG ", "EQG", False),
    ("EQB ", "EQB", False),
    ("EQA ", "EQA", False),
    ("SLK ", "SLK-Class", False),
    ("SLC ", "SLC", False),
    ("SLR ", "SLR", False),
    ("SLS ", "SLS", False),
    ("SL ", "SL-Class", False),
    ("ML ", "M-Class", False),
    ("V ", "V-Class", False),
]

# Single-letter Mercedes prefixes (checked last, require space or digit after)
_MERC_SINGLE_LETTER = [
    ("A ", "A-Class"),
    ("C ", "C-Class"),
    ("S ", "S-Class"),
    ("G ", "G-Class"),
]

# Regex for E-Class: starts with E followed by a space or digit
_MERC_E_RE = re.compile(r"^E[\s\d]")

# BMW: M + 3+ digits = extract series digit
_BMW_M_VARIANT_RE = re.compile(r"^M(\d)\d{2}")
# BMW: starts with digit = extract first digit for series
_BMW_NUMERIC_RE = re.compile(r"^(\d)")
# BMW: X followed by digit then M (e.g. X5M, X6M)
_BMW_XM_RE = re.compile(r"^(X\d)M$")


def _normalize_bmw(model: str) -> str | None:
    if model in _BMW_PASSTHROUGH:
        return None  # already matches training

    # X-M variants: X3M -> X3, X5M -> X5
    m = _BMW_XM_RE.match(model)
    if m:
        return m.group(1)

    # M-variants with 3+ digit suffix: M235i -> 2-Series, M340i -> 3-Series
    m = _BMW_M_VARIANT_RE.match(model)
    if m:
        return f"{m.group(1)}-Series"

    # Numeric prefix: 320i -> 3-Series, 750Li -> 7-Series
    m = _BMW_NUMERIC_RE.match(model)
    if m:
        return f"{m.group(1)}-Series"

    return None  # no rule matched


def _normalize_mercedes(model: str) -> str | None:
    # Multi-letter prefix rules (longest first)
    for prefix, target, check_coupe in _MERC_PREFIX_RULES:
        if model.startswith(prefix) or model == prefix.strip():
            if check_coupe and "coupe" in model.lower():
                base = target.replace("-Class", "")
                return f"{base} Coupe"
            return target

    # E-Class: E followed by space or digit (E300, E 400, E200, E 53 AMG)
    if _MERC_E_RE.match(model):
        return "E-Class"

    # Single-letter prefixes: require PREFIX + space
    for prefix, target in _MERC_SINGLE_LETTER:
        if model.startswith(prefix):
            return target

    return None  # no rule matched (e.g. Sprinter, Viano)


def _normalize_lexus(model: str) -> str | None:
    return LEXUS_MAP.get(model)


def normalize_listing(brand: str, model: str) -> tuple[str, str, str | None]:
    original_brand = brand
    original_model = model

    # 1. brand normalization
    brand = BRAND_MAP.get(brand, brand)

    # 2. explicit map (checked first, highest priority)
    key = (brand, model)
    if key in EXPLICIT_MAP:
        normalized = EXPLICIT_MAP[key]
        trim = None
        if key not in FORMATTING_ONLY and normalized != model:
            trim = original_model
        return brand, normalized, trim

    # 3. brand-level pattern rules
    normalized = None
    if brand == "BMW":
        normalized = _normalize_bmw(model)
    elif brand in ("Mercedes-Benz", "Mercedes-Maybach"):
        normalized = _normalize_mercedes(model)
    elif brand == "Lexus":
        normalized = _normalize_lexus(model)

    if normalized is not None and normalized != model:
        return brand, normalized, original_model

    # 4. fallthrough — no rule matched, pass through as-is
    return brand, model, None
