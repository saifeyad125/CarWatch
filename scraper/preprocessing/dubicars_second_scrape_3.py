import time
from pathlib import Path
from typing import Dict, List

import pandas as pd
import requests
from bs4 import BeautifulSoup, Tag

# ---- Paths -------------------------------------------------------------

INPUT_CSV = Path("data/processed/dubicars_cars_clean.csv")

# Folder for intermediate checkpoint CSVs
CHECKPOINT_DIR = Path("data/processed/dubi/scraper_3")
CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)

# Final enriched CSV
FINAL_CSV = Path("data/processed/dubi/scraper_3/dubicars_second_scrape_3.csv")

# ---- HTTP config -------------------------------------------------------

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0 Safari/537.36"
    )
}

REQUEST_TIMEOUT = 15   # seconds
SLEEP_BETWEEN_REQUESTS = 1.0  # polite delay between requests
SAVE_EVERY = 400  # checkpoint frequency
PAUSE_AFTER_BATCH = 300  # 5 minutes pause after each batch (in seconds)
START_ROW = 4800  # Start from row 4800
MAX_ROWS = 2400  # Process third quarter (2400 rows)


# ---- Parsing helpers ---------------------------------------------------

# Map the *text prefix* in each <li> to our dataframe column names
KEY_PREFIXES = {
    "Make": "make_detail",
    "Model ": "model_detail",       # notice the space to avoid matching "Model year"
    "Model year": "model_year_detail",
    "Color": "color_detail",
    "Interior color": "interior_color",
    "Cylinders": "cylinders",
    "Transmission": "transmission",
    "Vehicle type": "vehicle_type",
    "Steering side": "steering_side",
    "Number of doors": "num_doors",
    "Seating capacity": "seating_capacity",
    "Wheel size": "wheel_size",
    "Fuel Type": "fuel_type",
    "Fuel type": "fuel_type",       # just in case they use lowercase t
    "Export status": "export_status",
    "Service history": "service_history",
    "Updated on": "updated_on",
    "Specs": "specs_detail",
    "Kilometers": "kilometers_detail",
    "Location": "location_detail",
}


def _collect_section_li_texts(heading: Tag, stop_headings: List[str]) -> List[str]:
    """
    From a heading tag (e.g. 'Highlights', 'Specs & features'), walk forward
    through siblings, collecting all <li> text until we hit another heading
    whose text contains any of stop_headings.
    """
    texts: List[str] = []

    if heading is None:
        return texts

    for sib in heading.next_siblings:
        if isinstance(sib, Tag):
            # Stop when we reach the next big section
            if sib.name in ("h2", "h3", "h4"):
                t = sib.get_text(strip=True)
                if any(stop in t for stop in stop_headings):
                    break

            # Collect direct <li> plus nested ones
            if sib.name == "li":
                texts.append(" ".join(sib.stripped_strings))
            else:
                for li in sib.find_all("li"):
                    texts.append(" ".join(li.stripped_strings))

    return texts


def _update_data_from_line(data: Dict[str, str], line: str) -> None:
    """
    Given a single line like 'Model year 2017' or 'Fuel Type Petrol',
    update the data dict if it matches any of our known prefixes.
    """
    line = line.strip()
    if not line:
        return

    for prefix, col_name in KEY_PREFIXES.items():
        if line.startswith(prefix):
            value = line[len(prefix):].strip(" :")
            if value:
                data[col_name] = value
            break


def parse_listing_details(html: str) -> Dict[str, str]:
    """
    Parse a single Dubicars listing HTML and return the extracted attributes.
    We read from both 'Highlights' and 'Specs & features' sections.
    """
    soup = BeautifulSoup(html, "lxml")
    data: Dict[str, str] = {}

    # ---- Highlights section ----
    highlights_heading = soup.find(
        lambda tag: tag.name in ("h2", "h3", "h4")
        and "Highlights" in tag.get_text()
    )
    highlight_lines = _collect_section_li_texts(
        highlights_heading,
        stop_headings=[
            "Description",
            "Specs & features",
            "Exterior",
            "Interior",
            "Safety",
            "Entertainment",
            "Similar cars",
            "Buyer tips",
            "Other",
        ],
    )
    for line in highlight_lines:
        _update_data_from_line(data, line)

    # ---- Specs & features section ----
    specs_heading = soup.find(
        lambda tag: tag.name in ("h2", "h3", "h4")
        and "Specs & features" in tag.get_text()
    )
    specs_lines = _collect_section_li_texts(
        specs_heading,
        stop_headings=[
            "Exterior",
            "Interior",
            "Safety",
            "Entertainment",
            "Similar cars",
            "Buyer tips",
            "Other",
            "Dubicars car inspection",
            "Instant free car valuation",
        ],
    )
    for line in specs_lines:
        _update_data_from_line(data, line)

    return data


def fetch_listing(url: str) -> Dict[str, str]:
    """
    Download one listing and return extracted specs. Returns {} on failure.
    """
    try:
        resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
    except Exception as e:
        print(f"[!] Error fetching {url}: {e}")
        return {}

    return parse_listing_details(resp.text)


# ---- Main runner -------------------------------------------------------

def main():
    print(f"[SCRAPER 3] Reading: {INPUT_CSV.resolve()}")
    df = pd.read_csv(INPUT_CSV)

    if "url" not in df.columns:
        raise ValueError("Input CSV must contain a 'url' column with listing URLs.")

    # Make sure all our detail columns exist
    for col in KEY_PREFIXES.values():
        if col not in df.columns:
            df[col] = pd.NA

    # Process rows from START_ROW to START_ROW + MAX_ROWS
    df_to_process = df.iloc[START_ROW:START_ROW + MAX_ROWS].copy()
    total_to_process = len(df_to_process)
    
    print(f"[SCRAPER 3] Processing rows {START_ROW} to {START_ROW + MAX_ROWS - 1} ({total_to_process} rows)")

    requests_made = 0  # counter for requests in current batch

    for idx, row in df_to_process.iterrows():
        url = row.get("url")

        if not isinstance(url, str) or not url.startswith("http"):
            print(f"[SCRAPER 3] Skipping row {idx} – no valid URL")
            continue

        # Resume logic: if you re-run, skip rows that already have details
        if pd.notna(row.get("make_detail")):
            print(f"[SCRAPER 3] Row {idx} already has details, skipping...")
            continue

        print(f"[SCRAPER 3] [{idx+1}/{START_ROW + total_to_process}] Fetching {url} ...")
        details = fetch_listing(url)
        requests_made += 1

        if not details:
            print(f"[SCRAPER 3] [!] No details parsed for row {idx}")
        else:
            for col_name, value in details.items():
                df_to_process.at[idx, col_name] = value

        # polite delay
        time.sleep(SLEEP_BETWEEN_REQUESTS)

        # periodic checkpoints after every SAVE_EVERY requests
        if requests_made % SAVE_EVERY == 0:
            checkpoint_path = CHECKPOINT_DIR / f"scraper_3_batch_{requests_made}.csv"
            df_to_process.to_csv(checkpoint_path, index=False)
            print(f"[SCRAPER 3] [✓] Checkpoint saved → {checkpoint_path}")
            
            # Take a 5-minute break after each batch to avoid timeout
            if requests_made < total_to_process:
                print(f"[SCRAPER 3] [⏸] Pausing for {PAUSE_AFTER_BATCH // 60} minutes to avoid timeout...")
                time.sleep(PAUSE_AFTER_BATCH)
                print(f"[SCRAPER 3] [▶] Resuming scraping...")

    # final save
    FINAL_CSV.parent.mkdir(parents=True, exist_ok=True)
    df_to_process.to_csv(FINAL_CSV, index=False)
    print(f"[SCRAPER 3] [+] Final CSV saved → {FINAL_CSV.resolve()}")
    print(f"[SCRAPER 3] [+] Total requests made: {requests_made}")


if __name__ == "__main__":
    main()
