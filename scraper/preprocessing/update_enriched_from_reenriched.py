#!/usr/bin/env python3
import csv
from pathlib import Path

# ===== CONFIG =====
REENRICHED_CSV = Path("/Users/saif/Desktop/University Saif/Y3/dissertion/project/z__dataset/raw/dubizzle_combined_enriched_EMPTY_LISTINGS_REENRICHED.csv")
MAIN_ENRICHED_CSV = Path("/Users/saif/Desktop/University Saif/Y3/dissertion/project/z__dataset/raw/dubizzle_combined_enriched.csv")
OUTPUT_CSV = MAIN_ENRICHED_CSV.with_name(MAIN_ENRICHED_CSV.stem + "_UPDATED.csv")

ALL_FIELDS = [
    "brand","model","type","price_aed","year","kms","url",
    "trim","horsepower","doors","fuel_type","cylinders",
    "interior_color","exterior_color","body_type","seating_capacity",
    "entertainment_and_technology","engine_capacity_cc",
    "steering_side","regional_specs"
]

# Missing-fields threshold - skip rows that are still empty
MISSING_ALL_THRESHOLD = 12


def norm(v):
    """Normalize value - treat empty/null-like values as empty string."""
    if v is None:
        return ""
    s = str(v).strip()
    if s.lower() in {"na", "n/a", "none", "null", "-", "--"}:
        return ""
    return s


def is_row_still_empty(row, fieldnames):
    """
    Check if row is still missing too many fields (>= MISSING_ALL_THRESHOLD).
    Returns: (is_empty: bool, missing_count: int)
    """
    missing = 0
    present = 0

    for f in ALL_FIELDS:
        if f in fieldnames:
            present += 1
            if norm(row.get(f, "")) == "":
                missing += 1

    if present == 0:
        return True, 0

    return (missing >= MISSING_ALL_THRESHOLD), missing


def main():
    if not REENRICHED_CSV.exists():
        raise FileNotFoundError(f"Re-enriched CSV not found: {REENRICHED_CSV}")
    
    if not MAIN_ENRICHED_CSV.exists():
        raise FileNotFoundError(f"Main enriched CSV not found: {MAIN_ENRICHED_CSV}")

    print(f"[1/4] Loading re-enriched listings from: {REENRICHED_CSV.name}")
    
    # Load re-enriched data (only non-empty rows)
    reenriched_map = {}  # url -> row_dict
    dropped_count = 0
    loaded_count = 0
    
    with REENRICHED_CSV.open("r", newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        
        for row in reader:
            is_empty, missing = is_row_still_empty(row, fieldnames)
            
            if is_empty:
                dropped_count += 1
                continue
            
            url = norm(row.get("url", ""))
            if url:
                reenriched_map[url] = row
                loaded_count += 1
    
    print(f"    ✓ Loaded {loaded_count} enriched rows")
    print(f"    ✓ Dropped {dropped_count} still-empty rows")
    
    print(f"\n[2/4] Reading main enriched CSV: {MAIN_ENRICHED_CSV.name}")
    
    # Read main CSV and update matching rows
    all_rows = []
    updated_count = 0
    dropped_from_main_count = 0
    total_read = 0
    
    with MAIN_ENRICHED_CSV.open("r", newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames or []
        
        for row in reader:
            total_read += 1
            url = norm(row.get("url", ""))
            
            if url in reenriched_map:
                # Replace this row with the re-enriched version
                all_rows.append(reenriched_map[url])
                updated_count += 1
            else:
                # Check if this row is still empty
                is_empty, missing = is_row_still_empty(row, fieldnames)
                
                if is_empty:
                    # Drop this empty row
                    dropped_from_main_count += 1
                else:
                    # Keep original row
                    all_rows.append(row)
    
    print(f"    ✓ Total rows read from main CSV: {total_read}")
    print(f"    ✓ Updated rows: {updated_count}")
    print(f"    ✓ Dropped still-empty rows from main: {dropped_from_main_count}")
    print(f"    ✓ Final rows to write: {len(all_rows)}")
    
    print(f"\n[3/4] Writing updated CSV to: {OUTPUT_CSV.name}")
    
    # Write updated CSV
    with OUTPUT_CSV.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_rows)
    
    print(f"    ✓ Wrote {len(all_rows)} rows")
    
    print(f"\n[4/4] Summary:")
    print(f"    • Re-enriched rows loaded: {loaded_count}")
    print(f"    • Still-empty rows dropped from re-enriched: {dropped_count}")
    print(f"    • Listings updated in main CSV: {updated_count}")
    print(f"    • Still-empty rows dropped from main CSV: {dropped_from_main_count}")
    print(f"    • Total rows dropped: {dropped_count + dropped_from_main_count}")
    print(f"    • Final output rows: {len(all_rows)}")
    print(f"    • Output: {OUTPUT_CSV}")
    print(f"\n✓ Done!")


if __name__ == "__main__":
    main()
