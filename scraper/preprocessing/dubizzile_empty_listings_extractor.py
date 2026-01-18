#!/usr/bin/env python3
import csv
from pathlib import Path

# ===== CONFIG =====
INPUT_CSV = Path("/Users/saif/Desktop/University Saif/Y3/dissertion/project/data/raw/dubizzle_combined_enriched.csv")

ALL_FIELDS = [
    "brand","model","type","price_aed","year","kms","url",
    "trim","horsepower","doors","fuel_type","cylinders",
    "interior_color","exterior_color","body_type","seating_capacity",
    "entertainment_and_technology","engine_capacity_cc",
    "steering_side","regional_specs"
]

# Missing-fields threshold (out of ~20 columns).
# Rows with only brand/model/type/price/year/kms/url filled have ~13 missing -> good target.
MISSING_ALL_THRESHOLD = 12

OUT_EMPTY  = INPUT_CSV.with_name(INPUT_CSV.stem + "_EMPTY_LISTINGS.csv")
OUT_KEEP   = INPUT_CSV.with_name(INPUT_CSV.stem + "_KEPT.csv")
OUT_REPORT = INPUT_CSV.with_name(INPUT_CSV.stem + "_EMPTY_REPORT.txt")


def norm(v):
    if v is None:
        return ""
    s = str(v).strip()
    if s.lower() in {"na", "n/a", "none", "null", "-", "--"}:
        return ""
    return s


def is_row_empty_listing(row, fieldnames):
    """
    Treat ALL_FIELDS as required-ish. If a row is missing many of them, we classify it as 'empty listing'.
    Returns: (is_empty: bool, missing_count: int, non_empty_count: int)
    """
    missing = 0
    present = 0

    for f in ALL_FIELDS:
        if f in fieldnames:
            present += 1
            if norm(row.get(f, "")) == "":
                missing += 1

    if present == 0:
        return True, 0, 0  # weird file -> treat as empty

    non_empty = present - missing
    return (missing >= MISSING_ALL_THRESHOLD), missing, non_empty


def main():
    if not INPUT_CSV.exists():
        raise FileNotFoundError(f"Input CSV not found: {INPUT_CSV}")

    empty_rows = 0
    kept_rows = 0
    examples = []

    with INPUT_CSV.open("r", newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        if not fieldnames:
            raise ValueError("No header found in CSV (fieldnames is empty).")

        with OUT_EMPTY.open("w", newline="", encoding="utf-8") as fe, \
             OUT_KEEP.open("w", newline="", encoding="utf-8") as fk:

            empty_writer = csv.DictWriter(fe, fieldnames=fieldnames)
            keep_writer  = csv.DictWriter(fk, fieldnames=fieldnames)
            empty_writer.writeheader()
            keep_writer.writeheader()

            for row in reader:
                empty, missing_count, non_empty_count = is_row_empty_listing(row, fieldnames)

                if empty:
                    empty_writer.writerow(row)
                    empty_rows += 1
                    if len(examples) < 10:
                        examples.append((missing_count, non_empty_count, row.get("url", "")))
                else:
                    keep_writer.writerow(row)
                    kept_rows += 1

    report = (
        f"Input: {INPUT_CSV}\n"
        f"Empty listings CSV: {OUT_EMPTY}\n"
        f"Kept listings CSV: {OUT_KEEP}\n\n"
        f"Rule:\n"
        f"- Mark row as EMPTY if missing >= {MISSING_ALL_THRESHOLD} fields from ALL_FIELDS ({len(ALL_FIELDS)} total)\n\n"
        f"Counts:\n"
        f"- Empty rows: {empty_rows}\n"
        f"- Kept rows: {kept_rows}\n\n"
        f"Examples (missing_count, non_empty_count, url):\n"
        + "\n".join([f"- {e}" for e in examples])
    )

    OUT_REPORT.write_text(report, encoding="utf-8")
    print(report)


if __name__ == "__main__":
    main()
