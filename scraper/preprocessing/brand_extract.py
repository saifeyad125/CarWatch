import re
import pandas as pd
from pathlib import Path

INPUT_CSV         = Path("z__dataset/clean/dubicars_cars_clean.csv")
OUTPUT_CSV        = Path("z__dataset/clean/dubicars_cars_clean_extracted.csv")
MODEL_COUNTS_CSV  = Path("z__dataset/clean/dubicars_model_counts.csv")


def extract_model_from_type(type_str: str, brand: str = "") -> str:
    """
    Take the 'type' string (title with brand removed as much as possible)
    and try to extract a clean model name.

    Uses a bunch of heuristics to:
      - Cut off engine sizes, horsepower, body types, GCC/specs, mileage, etc.
      - Ignore marketing fluff like 'EXCELLENT DEAL for our ...'
      - Allow leading numeric models (07, 001, 1500, etc.)
    """
    if not isinstance(type_str, str):
        return ""

    # Normalise whitespace
    s = re.sub(r"\s+", " ", type_str).strip()
    if not s:
        return ""

    # Many dealers use " - " as a separator for description bits.
    # Replace " - " with "|" so we can reuse the same split logic.
    s = s.replace(" - ", " | ")

    # Take only the first segment before marketing separators
    first_seg = re.split(r"[|,/]", s, maxsplit=1)[0]
    first_seg = first_seg.strip()
    if not first_seg:
        return ""

    tokens = first_seg.split()

    # Tokens where we stop because they are engine/body/spec stuff, not model
    stopwords = {
        "HP", "HP)", "BHP",
        "AWD", "FWD", "RWD",
        "SUV", "Sedan", "Coupe", "Hatchback", "Pickup", "Van",
        "A/T", "AT", "Automatic", "Tiptronic", "CVT",
        "GCC", "Specs", "SPECS",
        "Petrol", "Diesel", "Hybrid", "Electric",
        "EXCELLENT", "DEAL", "CONDITION", "OFFER",
        "ONLY", "PRICE", "CLEAN", "WARRANTY", "SERVICE",
        "HISTORY", "FULL", "OPTION", "OPTIONS",
        "KM", "KMS",
    }

    # Function words that almost always mean "description is starting"
    function_stops = {"for", "our", "with", "and", "or", "from", "in", "on", "by", "per", "at"}

    brand_lower = (brand or "").strip().lower()
    brand_main = brand_lower.split()[0] if brand_lower else ""

    model_tokens = []

    for i, tok in enumerate(tokens):
        t_clean = tok.strip("(),")

        # 1) If the brand reappears AFTER we've already got some model tokens,
        #    that usually means the dealer has started a new phrase.
        if brand_lower:
            t_low = t_clean.lower()
            if model_tokens and (t_low == brand_lower or t_low == brand_main):
                break

        # 2) Engine displacement anywhere in the token (1.4L, 3.6L, 2L-6CYL, etc.)
        if re.search(r"\d+(\.\d+)?L", t_clean, flags=re.IGNORECASE):
            break

        # 3) 4-digit year (19xx or 20xx)
        if re.match(r"^(19|20)\d{2}$", t_clean):
            break

        # 4) Mileage tokens like "74,000Km" / "120000KM"
        if re.match(r"^\d[\d,]*km$", t_clean, flags=re.IGNORECASE):
            break

        # 5) Generic hard stopwords
        if t_clean.upper() in stopwords:
            break

        # 6) Horsepower-like tokens: "360HP", "108-HP", etc.
        upper = t_clean.upper()
        if re.match(r"^\d{2,4}(-?HP)?$", upper):
            if "HP" in upper:
                break
            # Else, let numeric handling below decide

        # 7) Plain numeric token (potential model OR horsepower / weird code)
        if re.match(r"^\d{2,4}$", t_clean):
            next_tok = tokens[i + 1].strip("(),") if i + 1 < len(tokens) else ""
            if next_tok.upper() in {"HP", "HP)", "BHP"}:
                break
            # If it's the first token, allow it as model (e.g. "07", "001", "1500")
            if model_tokens:
                break

        # 8) Function words once the model has started
        if model_tokens and t_clean.lower() in function_stops:
            break

        model_tokens.append(t_clean if t_clean else tok)

    model = " ".join(model_tokens).strip()
    return model if model else first_seg


def main():
    print(f"[+] Reading: {INPUT_CSV.resolve()}")
    df = pd.read_csv(INPUT_CSV)
    print(f"[+] Rows before filtering: {len(df)}")

    if "type" not in df.columns:
        raise ValueError(
            "Column 'type' not found. Make sure your cleaned CSV already has 'brand' and 'type'."
        )

    # Build 'model' using both 'type' and 'brand'
    df["model"] = df.apply(
        lambda row: extract_model_from_type(row["type"], brand=row.get("brand", "")),
        axis=1,
    )

    # Quick sanity check
    print(df[["title", "brand", "type", "model"]].head(20))

    # 1) Save row-level data with model column
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"[+] Saved updated data with model column → {OUTPUT_CSV.resolve()}")

    # 2) Build and save model counts per (brand, model)
    model_counts = (
        df.groupby(["brand", "model"], dropna=False)
          .size()
          .reset_index(name="count")
          .sort_values(["brand", "count"], ascending=[True, False])
    )

    MODEL_COUNTS_CSV.parent.mkdir(parents=True, exist_ok=True)
    model_counts.to_csv(MODEL_COUNTS_CSV, index=False)
    print(f"[+] Saved model counts → {MODEL_COUNTS_CSV.resolve()}")
    print(model_counts.head(30))


if __name__ == "__main__":
    main()
