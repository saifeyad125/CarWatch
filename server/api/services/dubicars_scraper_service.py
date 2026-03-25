import os
import json
import time
import random
import logging

import requests
from requests.exceptions import RequestException
from bs4 import BeautifulSoup, Tag
from sqlalchemy.orm import Session

from db.models import Listing
from api.services.model_normalizer import normalize_listing

logger = logging.getLogger("dubicars")

# config from env
DUBICARS_ENABLED = os.getenv("DUBICARS_ENABLED", "true").lower() in ("true", "1", "yes")
DUBICARS_MAX_PAGES = int(os.getenv("DUBICARS_MAX_PAGES", "5"))
DUBICARS_SLEEP_BROWSE = float(os.getenv("DUBICARS_SLEEP_BROWSE", "2.0"))
DUBICARS_SLEEP_DETAIL = float(os.getenv("DUBICARS_SLEEP_DETAIL", "1.5"))
DUBICARS_MAX_CONSECUTIVE_BLOCKS = int(os.getenv("DUBICARS_MAX_CONSECUTIVE_BLOCKS", "3"))

BROWSE_URL = "https://www.dubicars.com/uae/used"
BATCH_SIZE = 20

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate",
    "Referer": "https://www.dubicars.com/",
    "Connection": "keep-alive",
}

DEFAULT_IMAGE = (
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7"
    "?w=800&h=600&fit=crop"
)

UAE_LOCATIONS = [
    "Dubai, UAE",
    "Abu Dhabi, UAE",
    "Sharjah, UAE",
    "Ajman, UAE",
    "Ras Al Khaimah, UAE",
]

# Mapping from DubiCars "Highlights" / "Specs & features" line prefixes
# to our Listing model columns.
KEY_PREFIXES = {
    "Color": "exterior_color",
    "Interior color": "interior_color",
    "Cylinders": "cylinders",
    "Vehicle type": "body_type",
    "Steering side": "steering_side",
    "Number of doors": "doors",
    "Seating capacity": "seating_capacity",
    "Fuel Type": "fuel_type",
    "Fuel type": "fuel_type",
    "Specs": "regional_specs",
    "Horsepower": "horsepower",
    "Engine capacity": "engine_capacity",
}


# http fetch (no proxy)

def _fetch_page(url: str) -> str:
    sleep_time = DUBICARS_SLEEP_DETAIL  # base sleep between retries

    for attempt in range(1, 4):
        try:
            t0 = time.time()
            resp = requests.get(url, headers=HEADERS, timeout=30, allow_redirects=True)
            elapsed = time.time() - t0

            logger.debug(
                "GET %s -> %d (%.2fs, %d bytes)",
                url, resp.status_code, elapsed, len(resp.content),
            )

            if resp.status_code in (429, 403):
                sleep_time *= 2
                logger.warning(
                    "DubiCars %d on %s (attempt %d/3) -- sleeping %.1fs",
                    resp.status_code, url, attempt, sleep_time,
                )
                time.sleep(sleep_time)
                continue

            if resp.status_code == 404:
                logger.info("DubiCars 404 -- listing removed: %s", url)
                return ""

            if resp.status_code >= 400:
                logger.warning(
                    "DubiCars %d on %s -- skipping", resp.status_code, url,
                )
                return ""

            return resp.text

        except RequestException as exc:
            sleep_time *= 2
            logger.warning(
                "DubiCars request error (attempt %d/3) %s: %s -- sleeping %.1fs",
                attempt, type(exc).__name__, exc, sleep_time,
            )
            time.sleep(sleep_time)

    logger.warning("DubiCars gave up after 3 attempts: %s", url)
    return ""


# browse page parser

def _extract_listings_from_browse(html: str) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    cards = soup.select("li.serp-list-item")
    rows: list[dict] = []

    for card in cards:
        kms_raw = card.get("data-item-kilometers")
        ga4_raw = card.get("data-ga4-detail")
        sp_raw = card.get("data-sp-item")

        price = None
        city = None
        year = None
        km_numeric = None
        brand = None
        model = None
        ga4_image = None

        # primary source: ga4 json
        if ga4_raw:
            try:
                ga4 = json.loads(ga4_raw)
                price = ga4.get("price")
                city = ga4.get("city")
                year = ga4.get("car_year")
                brand = ga4.get("car_make") or ga4.get("make") or ga4.get("item_brand")
                model = ga4.get("car_model") or ga4.get("model") or ga4.get("item_name")
                ga4_image = ga4.get("image_url")
            except (json.JSONDecodeError, TypeError):
                pass

        # fallback: sp-item json
        if sp_raw:
            try:
                sp = json.loads(sp_raw)
                if price is None:
                    price = sp.get("rpr") or sp.get("pr")
                if year is None:
                    year = sp.get("y")
                if km_numeric is None:
                    km_numeric = sp.get("km")
            except (json.JSONDecodeError, TypeError):
                pass

        # kilometres from data attribute
        if km_numeric is None and kms_raw:
            digits = "".join(ch for ch in kms_raw if ch.isdigit())
            km_numeric = int(digits) if digits else None

        # url from first <a> tag
        url = None
        link_el = card.select_one("a")
        if link_el and link_el.has_attr("href"):
            href = link_el["href"]
            url = href if href.startswith("http") else "https://www.dubicars.com" + href

        # thumbnail: prefer <img>, fallback to ga4
        image = None
        img_el = card.select_one("img")
        if img_el and img_el.has_attr("src"):
            image = img_el["src"]
        if not image:
            image = ga4_image

        # coerce price to int
        if price is not None:
            try:
                price = int(price)
            except (ValueError, TypeError):
                price = None

        # coerce year to int
        if year is not None:
            try:
                year = int(year)
            except (ValueError, TypeError):
                year = None

        # Skip if essential fields are missing (price=0 means "Price on request in dubicar")
        if not url or not price or year is None:
            continue

        rows.append({
            "brand": str(brand) if brand else "Unknown",
            "model": str(model) if model else "Unknown",
            "price": price,
            "year": year,
            "kms": km_numeric,
            "url": url,
            "image": image,
            "city": str(city) if city else None,
        })

    logger.info("DubiCars browse: %d cards parsed, %d valid rows", len(cards), len(rows))
    return rows


# detail page parser

def _collect_section_li_texts(heading, stop_headings: list[str]) -> list[str]:
    texts: list[str] = []
    if heading is None:
        return texts

    for sib in heading.next_siblings:
        if isinstance(sib, Tag):
            if sib.name in ("h2", "h3", "h4"):
                heading_text = sib.get_text(strip=True)
                if any(stop in heading_text for stop in stop_headings):
                    break
            if sib.name == "li":
                texts.append(" ".join(sib.stripped_strings))
            else:
                for li in sib.find_all("li"):
                    texts.append(" ".join(li.stripped_strings))
    return texts


def _update_data_from_line(data: dict, line: str) -> None:
    for prefix, column in KEY_PREFIXES.items():
        if line.startswith(prefix):
            # Value is everything after the prefix, stripped of leading
            # whitespace / colon / dash.
            value = line[len(prefix):].lstrip(" :\u2013\u2014-")
            if value:
                data[column] = value
            return


def _parse_detail_page(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    data: dict = {}

    # highlights section
    highlights_heading = soup.find(
        lambda tag: tag.name in ("h2", "h3", "h4") and "Highlights" in tag.get_text()
    )
    highlight_lines = _collect_section_li_texts(
        highlights_heading,
        stop_headings=[
            "Description", "Specs & features", "Exterior", "Interior",
            "Safety", "Entertainment", "Similar cars", "Buyer tips", "Other",
        ],
    )
    for line in highlight_lines:
        _update_data_from_line(data, line)

    # specs & features section
    specs_heading = soup.find(
        lambda tag: tag.name in ("h2", "h3", "h4") and "Specs & features" in tag.get_text()
    )
    specs_lines = _collect_section_li_texts(
        specs_heading,
        stop_headings=[
            "Exterior", "Interior", "Safety", "Entertainment",
            "Similar cars", "Buyer tips", "Other",
            "Dubicars car inspection", "Instant free car valuation",
        ],
    )
    for line in specs_lines:
        _update_data_from_line(data, line)

    # images
    images: list[str] = []

    # 1) og:image meta tag
    og_meta = soup.find("meta", property="og:image")
    if og_meta:
        og_url = og_meta.get("content")
        if og_url and isinstance(og_url, str) and og_url.startswith("http"):
            images.append(og_url)

    # 2) <img> tags whose src contains "dubicars" (CDN images)
    for img in soup.find_all("img"):
        src = img.get("src") or ""
        if isinstance(src, str) and "dubicars" in src and src.startswith("http"):
            if src not in images:
                images.append(src)

    data["_images"] = images
    return data


# main entry point

def scrape_dubicars_listings(
    db: Session,
    pages: int = DUBICARS_MAX_PAGES,
) -> list[Listing]:
    if not DUBICARS_ENABLED:
        logger.info("DubiCars scraping is disabled (DUBICARS_ENABLED=false)")
        return []

    # Load existing URLs so we skip duplicates
    existing_urls: set[str] = set(
        r[0] for r in db.query(Listing.url).all()
    )
    logger.info("Existing URLs in DB: %d", len(existing_urls))

    # browse phase
    discovered: list[dict] = []
    seen_urls: set[str] = set()
    consecutive_blocks = 0

    for page_num in range(1, pages + 1):
        url = f"{BROWSE_URL}?page={page_num}"
        logger.info("DubiCars browse page %d/%d: %s", page_num, pages, url)

        html = _fetch_page(url)
        if not html:
            consecutive_blocks += 1
            logger.warning(
                "Empty response for browse page %d (%d consecutive blocks)",
                page_num, consecutive_blocks,
            )
            if consecutive_blocks >= DUBICARS_MAX_CONSECUTIVE_BLOCKS:
                logger.error(
                    "Aborting browse: %d consecutive empty pages -- likely blocked",
                    consecutive_blocks,
                )
                break
            time.sleep(DUBICARS_SLEEP_BROWSE)
            continue

        consecutive_blocks = 0
        stubs = _extract_listings_from_browse(html)

        for stub in stubs:
            if stub["url"] not in seen_urls:
                discovered.append(stub)
                seen_urls.add(stub["url"])

        time.sleep(DUBICARS_SLEEP_BROWSE)

    # Filter to only URLs we haven't stored yet
    new_stubs = [s for s in discovered if s["url"] not in existing_urls]
    logger.info(
        "DubiCars discovered %d total, %d new (after dedup against DB)",
        len(discovered), len(new_stubs),
    )

    if not new_stubs:
        return []

    # detail phase
    new_listings: list[Listing] = []
    consecutive_blocks = 0

    for i, stub in enumerate(new_stubs):
        logger.info(
            "DubiCars detail %d/%d: %s", i + 1, len(new_stubs), stub["url"],
        )

        html = _fetch_page(stub["url"])
        if not html:
            consecutive_blocks += 1
            if consecutive_blocks >= DUBICARS_MAX_CONSECUTIVE_BLOCKS:
                logger.error(
                    "Aborting detail phase: %d consecutive empty responses",
                    consecutive_blocks,
                )
                break
            details: dict = {}
        else:
            consecutive_blocks = 0
            details = _parse_detail_page(html)

        scraped_images = details.get("_images") or []

        # Use browse-phase thumbnail as first image if we got one
        browse_image = stub.get("image")
        if browse_image and browse_image not in scraped_images:
            scraped_images.insert(0, browse_image)

        listing = Listing(
            brand=stub["brand"],
            model=stub["model"],
            trim=details.get("trim"),
            year=stub["year"],
            price=stub["price"],
            kms=stub["kms"],
            url=stub["url"],
            horsepower=details.get("horsepower"),
            doors=details.get("doors"),
            fuel_type=details.get("fuel_type"),
            cylinders=details.get("cylinders"),
            interior_color=details.get("interior_color"),
            exterior_color=details.get("exterior_color"),
            body_type=details.get("body_type"),
            seating_capacity=details.get("seating_capacity"),
            engine_capacity=details.get("engine_capacity"),
            steering_side=details.get("steering_side"),
            regional_specs=details.get("regional_specs"),
            image=scraped_images[0] if scraped_images else DEFAULT_IMAGE,
            images=scraped_images if scraped_images else None,
            location=f"{stub['city']}, UAE" if stub.get("city") else "Dubai, UAE",
            source="dubicars",
        )

        # Normalize DubiCars model names to match training data
        norm_brand, norm_model, norm_trim = normalize_listing(
            listing.brand, listing.model
        )
        listing.brand = norm_brand
        listing.model = norm_model
        if norm_trim and not listing.trim:
            listing.trim = norm_trim

        db.add(listing)
        new_listings.append(listing)

        # Batch commit every BATCH_SIZE listings
        if (i + 1) % BATCH_SIZE == 0:
            db.commit()
            logger.info("Committed batch (%d/%d)", i + 1, len(new_stubs))

        time.sleep(DUBICARS_SLEEP_DETAIL)

    # Final commit for remaining listings
    if new_listings and len(new_listings) % BATCH_SIZE != 0:
        db.commit()

    logger.info("DubiCars: inserted %d new listings", len(new_listings))
    return new_listings
