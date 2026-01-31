import pandas as pd
from pathlib import Path

# ---- Paths ----
RAW_CSV   = Path("data/raw/dubicars_partial_320_pages.csv")
CLEAN_CSV = Path("data/processed/dubicars_cars_clean.csv")

# ---- Brand list ----
BRANDS = [
    "abarth", "acura", "aito", "ai-damani", "alfa-romeo", "ariel", "ashok-leyland",
    "aston-martin", "audi", "aurus", "austin-healey", "avatar", "bac", "baic",
    "baw", "bentley", "bentley-onyx", "bestune", "bizzarrini", "bmw", "bmw-alpina",
    "brogward", "brilliance", "bufori", "bugatti", "buick", "byd", "cadillac",
    "can-am", "caterham", "cevo", "changan", "chery", "chevrolet", "chrysler",
    "citroen", "cmc", "cupra", "dacia", "daewoo", "dallara", "datsun", "dayun",
    "delorean", "denza", "devinci", "dfsk", "dodge", "dongfeng", "doreen",
    "entegrа", "equus", "exeed", "faw", "fengon", "fenyr", "ferrari",
    "ferrari-onyx", "fiat", "fisker", "force", "ford", "forthing", "foton",
    "fuso", "gac", "gac-gonow", "geely", "genesis", "genty", "gmc",
    "grand-tiger", "great-wall", "gumpert", "gwm", "haval", "higer", "hino",
    "hiphi", "holden", "honda", "hong", "hummer", "hycan", "hyundai",
    "ineos", "infiniti", "international", "isuzu", "iveco", "jac", "jaecoo",
    "jaguar", "jeep", "jetour", "ji-yue", "jinbei", "jmc", "kaiyi",
    "kia", "king-long", "koenigsegg", "ktm", "lada", "lamborghini",
    "lamborghini-onyx", "lancia", "land-rover", "leapmotor", "levc", "lexus",
    "li-auto", "lincoln", "livan", "lixiang", "lotus", "lucid", "luxglynk-co",
    "maextro", "mahindra", "maserati", "maxus", "maybach", "mazda", "mclaren",
    "mercedes-benz", "mercedes-maybach", "mercedes-onyx", "mercury", "mg",
    "milan", "mini", "mitsubishi", "morgan", "morris", "neta", "nio",
    "nissan", "noble", "oldsmobile", "omoda", "opel", "other-make", "oullim",
    "pagani", "pal-v", "peugeot", "pgo", "plymouth", "polaris", "polestar",
    "pontiac", "porsche", "proton", "qiantu", "rabdan", "ram", "renault",
    "rezvani", "riddara", "rivian", "roewe", "rolls-royce", "rolls-royce-onyx",
    "rover", "rox", "saab", "saic", "seat", "seres", "shenlong-sunlong",
    "sifu", "sinotruk", "skoda", "skywell", "smart", "sourest", "speranza",
    "spyker", "ssangyong", "stelato", "studebaker", "subaru", "suzuki", "tam",
    "tank", "tata", "tesla", "togg", "tova", "toyota", "triumph", "tcr",
    "uaz", "venere", "vgv", "victory", "volkswagen", "volvo", "voyah",
    "w-motors", "westfield-sportscars", "wey", "wiesmann", "wuling", "xev",
    "xiaomi", "xpeng", "yangwang", "zeekr", "zenvo", "zhongxing", "zna",
    "zotye", "zxauto"
]


# Sort by word count (descending) so multi-word brands match first
BRANDS = sorted(BRANDS, key=lambda b: len(b.split()), reverse=True)


def extract_brand_model(title: str):
    """
    Given a full listing title, return (brand, type_text),
    where:
      - brand = matched brand name
      - type_text = everything after the brand (model/variant/etc.)
    """
    t = (title or "").strip()
    t_low = t.lower()

    # 1) Try known brands as prefix
    for b in BRANDS:
        b_low = b.lower()
        if t_low.startswith(b_low):
            brand = b
            type_text = t[len(b):].strip(" -|")
            return brand, type_text

    # 2) Fallback: first word is "brand", rest is type
    parts = t.split()
    if not parts:
        return "", ""

    first = parts[0]
    brand = first  # keep original casing of first word
    type_text = t[len(first):].strip(" -|")

    return brand, type_text


def main():
    print(f"[+] Loading raw data from: {RAW_CSV.resolve()}")
    df = pd.read_csv(RAW_CSV)
    print(f"[+] Raw rows: {len(df)}")

    # Add brand + type columns (no dropping of any rows)
    df["brand"], df["type"] = zip(*df["title"].apply(extract_brand_model))

    # Quick sanity check preview
    print(df[["title", "brand", "type"]].head(15))

    # Ensure output directory exists
    CLEAN_CSV.parent.mkdir(parents=True, exist_ok=True)

    # Save full enriched dataset (duplicates preserved)
    df.to_csv(CLEAN_CSV, index=False)
    print(f"[+] Saved cleaned data with brand/type → {CLEAN_CSV.resolve()}")
    print(f"[+] Final row count: {len(df)}")


if __name__ == "__main__":
    main()
