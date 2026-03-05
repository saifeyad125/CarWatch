"""
Scraper service — discovers new Dubizzle listings and inserts them into the DB.

Browse pages: Oxylabs Web Scraper API (render=html to bypass Imperva WAF)
  → HTML parsed with data-testid selectors (from dubizzile_scraper.py)
Detail pages: Oxylabs mobile proxy (direct, no rendering needed)
  → __NEXT_DATA__ JSON parsed (from dubizzile_enrich_2.py)
"""
import os
import re
import json
import time
import random
import logging
from typing import Any
from urllib.parse import urljoin
from http.client import IncompleteRead

import requests
from requests.exceptions import ChunkedEncodingError, ContentDecodingError, RequestException
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from db.models import Listing

logger = logging.getLogger("scraper")

BASE_URL = "https://uae.dubizzle.com"
BROWSE_URL = "https://uae.dubizzle.com/motors/used-cars/"
MAX_PAGES = 5
SLEEP_BETWEEN = 1.0

# Headers for detail page fetches (matching dubizzile_enrich_2.py)
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://uae.dubizzle.com/",
    "Connection": "close",
}

DEFAULT_IMAGE = "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&h=600&fit=crop"

UAE_LOCATIONS = [
    "Dubai, UAE", "Abu Dhabi, UAE", "Sharjah, UAE", "Ajman, UAE",
    "Ras Al Khaimah, UAE", "Fujairah, UAE", "Al Ain, UAE",
]

# ── Lazy proxy config ──
_proxy_cache: dict | None = None
_session: requests.Session | None = None


def _get_credentials() -> tuple[str, str]:
    """Return (username, password) from env."""
    return os.getenv("OXY_PROXY_USER", ""), os.getenv("OXY_PROXY_PASS", "")


def _get_proxies() -> dict:
    """Build proxy dict from env vars (lazy, cached)."""
    global _proxy_cache
    if _proxy_cache is not None:
        return _proxy_cache
    user, password = _get_credentials()
    host = os.getenv("OXY_PROXY_HOST", "pr.oxylabs.io")
    port = os.getenv("OXY_PROXY_PORT", "7777")
    if user:
        proxy_url = f"http://{user}:{password}@{host}:{port}"
        _proxy_cache = {"http": proxy_url, "https": proxy_url}
        logger.info(f"Proxy configured: {host}:{port} user={user[:15]}...")
    else:
        _proxy_cache = {}
    return _proxy_cache


def _get_session() -> requests.Session:
    """Reusable session with trust_env=False (matching enrich_2.py)."""
    global _session
    if _session is None:
        _session = requests.Session()
        _session.trust_env = False
    return _session


def _clean(s: str | None) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())


def _to_int(s: str | None) -> int | None:
    """Extract digits from string → int (matching dubizzile_scraper.py)."""
    if not s:
        return None
    digits = re.sub(r"[^\d]", "", s)
    return int(digits) if digits else None


def _extract_images(payload: dict | None) -> list[str]:
    """Extract listing image URLs from __NEXT_DATA__ payload."""
    if not payload:
        return []
    listing = payload.get("listing") or {}
    images: list[str] = []

    # Try common Dubizzle image keys
    for key in ("photos", "images", "gallery"):
        items = listing.get(key)
        if isinstance(items, list):
            for item in items:
                url = None
                if isinstance(item, str):
                    url = item
                elif isinstance(item, dict):
                    # photos usually have "main", "url", "src", or nested "image"
                    url = (item.get("main") or item.get("url")
                           or item.get("src") or item.get("image"))
                if url and isinstance(url, str) and url.startswith("http"):
                    images.append(url)
            if images:
                break

    return images


# ═══════════════════════════════════════════════════════════════════
#  BROWSE PAGE: Oxylabs Web Scraper API (bypasses Imperva WAF)
# ═══════════════════════════════════════════════════════════════════

def _fetch_browse_html(url: str) -> str:
    """
    Fetch a browse page via Oxylabs mobile proxy.
    Retries on Imperva blocks and transient errors.
    """
    proxies = _get_proxies()
    s = _get_session()

    for attempt in range(1, 4):
        try:
            resp = s.get(
                url, timeout=45, proxies=proxies, headers=HEADERS,
                allow_redirects=True,
            )

            if resp.status_code in (429, 502, 503, 504):
                wait = 2 * attempt
                logger.warning(f"Browse {resp.status_code} (attempt {attempt}/3) sleeping {wait}s...")
                time.sleep(wait)
                continue

            if resp.status_code in (401, 403):
                logger.error(f"Browse {resp.status_code} — blocked: {url}")
                time.sleep(2 * attempt)
                continue

            if resp.status_code == 404:
                return ""

            resp.raise_for_status()
            txt = resp.text

            # Check for Imperva WAF block
            if "Pardon Our Interruption" in txt:
                wait = 3 * attempt
                logger.warning(f"Browse: Imperva block (attempt {attempt}/3) sleeping {wait}s...")
                time.sleep(wait)
                continue

            return txt

        except (requests.exceptions.Timeout,
                requests.exceptions.ConnectionError,
                ChunkedEncodingError,
                ContentDecodingError,
                IncompleteRead,
                RequestException) as e:
            wait = 2 * attempt
            logger.warning(f"Browse error (attempt {attempt}/3) sleeping {wait}s... ({type(e).__name__})")
            time.sleep(wait)

    return ""


def _extract_listings_from_browse(html: str) -> list[dict]:
    """
    Parse Dubizzle browse page. Tries two approaches:
    1) data-testid selectors (matching dubizzile_scraper.py)
    2) __NEXT_DATA__ JSON (fallback if page has embedded data)
    """
    soup = BeautifulSoup(html, "html.parser")

    # ── Approach 1: data-testid selectors (dubizzile_scraper.py) ──
    wrapper = soup.select_one("#listing-card-wrapper") or soup
    anchors = wrapper.select('a[data-testid^="listing-"]')

    if anchors:
        results = []
        for a in anchors:
            href = a.get("href")
            url = urljoin(BASE_URL, href) if href else None

            price_el = a.select_one('[data-testid="listing-price"]')
            brand_el = a.select_one('[data-testid="heading-text-1"]')
            model_el = a.select_one('[data-testid="heading-text-2"]')
            year_el = a.select_one('[data-testid="listing-year"]')
            kms_el = a.select_one('[data-testid="listing-kms"]')

            price = _to_int(_clean(price_el.get_text())) if price_el else None
            brand = _clean(brand_el.get_text()) if brand_el else None
            model = _clean(model_el.get_text()) if model_el else None
            year = _to_int(_clean(year_el.get_text())) if year_el else None
            kms = _to_int(_clean(kms_el.get_text())) if kms_el else None

            if not url or not price or not year:
                continue

            results.append({
                "url": url,
                "brand": brand or "Unknown",
                "model": model or "Unknown",
                "price": price,
                "year": year,
                "kms": kms,
            })

        logger.info(f"Browse (data-testid): {len(anchors)} anchors, {len(results)} valid")
        return results

    # ── Approach 2: __NEXT_DATA__ JSON (fallback) ──
    tag = soup.find("script", id="__NEXT_DATA__")
    if tag and tag.string:
        try:
            data = json.loads(tag.string)
            listings = _find_listings_array(data)
            if listings:
                results = []
                for item in listings:
                    url = item.get("absolute_url") or item.get("url") or ""
                    if not url:
                        continue
                    if url.startswith("/"):
                        url = f"{BASE_URL}{url}"

                    # Extract from details slugs
                    details: dict[str, str] = {}
                    for section in ("primary", "secondary"):
                        for d in (item.get("details", {}).get(section) or []):
                            slug = d.get("slug", "")
                            val = d.get("value")
                            if slug and val is not None:
                                details[slug] = str(val)

                    brand = _clean(details.get("make") or item.get("make") or "")
                    model = _clean(details.get("model") or item.get("model") or "")
                    price = _to_int(str(item.get("price") or details.get("price") or ""))
                    year = _to_int(str(details.get("year") or ""))
                    kms = _to_int(str(details.get("kilometers") or details.get("kms") or ""))

                    if not url or not price or not year:
                        continue

                    results.append({
                        "url": url,
                        "brand": brand or "Unknown",
                        "model": model or "Unknown",
                        "price": price,
                        "year": year,
                        "kms": kms,
                    })

                logger.info(f"Browse (__NEXT_DATA__): {len(listings)} items, {len(results)} valid")
                return results
        except json.JSONDecodeError:
            pass

    snippet = html[:300].replace("\n", " ")
    logger.warning(f"No listings found in browse page (len={len(html)}, snippet={snippet[:150]}...)")
    return []


def _find_listings_array(obj: Any) -> list | None:
    """Recursively find the listings/hits array in __NEXT_DATA__."""
    if isinstance(obj, dict):
        for key in ("hits", "listings", "results", "ads"):
            val = obj.get(key)
            if isinstance(val, list) and len(val) > 0 and isinstance(val[0], dict):
                if any(v.get("absolute_url") or v.get("url") for v in val[:3]):
                    return val
        for v in obj.values():
            found = _find_listings_array(v)
            if found:
                return found
    elif isinstance(obj, list):
        for item in obj:
            found = _find_listings_array(item)
            if found:
                return found
    return None


# ═══════════════════════════════════════════════════════════════════
#  DETAIL PAGE: Oxylabs mobile proxy (direct, matching enrich_2.py)
# ═══════════════════════════════════════════════════════════════════

def _fetch_detail_html(url: str) -> str:
    """
    Fetch a detail page via Oxylabs mobile proxy with retries.
    Includes soft-block detection: if __NEXT_DATA__ is missing, retries.
    Matching dubizzile_enrich_2.py fetch_html() exactly.
    """
    proxies = _get_proxies()
    s = _get_session()

    for attempt in range(1, 4):
        try:
            resp = s.get(
                url, timeout=35, proxies=proxies, headers=HEADERS,
                allow_redirects=True,
            )

            if resp.status_code in (429, 502, 503, 504):
                wait = 1.5 * attempt
                logger.warning(f"Detail {resp.status_code} (attempt {attempt}/3) sleeping {wait:.1f}s...")
                time.sleep(wait)
                continue

            if resp.status_code == 404:
                logger.info(f"Detail 404 — listing removed/sold: {url}")
                return ""

            if resp.status_code in (401, 403):
                logger.error(f"Detail {resp.status_code} — blocked: {url}")
                return ""

            resp.raise_for_status()
            txt = resp.text

            # Soft-block / interstitial detection (matching enrich_2.py)
            if "__NEXT_DATA__" not in txt:
                wait = 1.5 * attempt
                logger.warning(f"Detail: no __NEXT_DATA__ (attempt {attempt}/3) len={len(txt)} sleeping {wait:.1f}s...")
                time.sleep(wait)
                continue

            return txt

        except (requests.exceptions.Timeout,
                requests.exceptions.ConnectionError,
                ChunkedEncodingError,
                ContentDecodingError,
                IncompleteRead,
                RequestException) as e:
            wait = 1.5 * attempt
            logger.warning(f"Detail error (attempt {attempt}/3) sleeping {wait:.1f}s... ({type(e).__name__})")
            time.sleep(wait)

    return ""


def _parse_detail_page(html: str) -> dict[str, Any]:
    """
    Extract enrichment fields + images from a detail page.
    1) __NEXT_DATA__ JSON (preferred, matching enrich_2.py)
    2) data-testid selectors (fallback, matching enrich_2.py)
    """
    soup = BeautifulSoup(html, "html.parser")

    # 1) __NEXT_DATA__ JSON
    tag = soup.find("script", id="__NEXT_DATA__")
    if tag and tag.string:
        try:
            data = json.loads(tag.string)
            payload = _find_listing_payload(data)
            if payload:
                listing = payload.get("listing") or {}
                details = listing.get("details") or {}
                slug_map: dict[str, str] = {}
                for section in ("primary", "secondary"):
                    for item in (details.get(section) or []):
                        slug = item.get("slug")
                        val = item.get("value")
                        if slug and val is not None:
                            slug_map[str(slug)] = _clean(str(val))

                wanted = {
                    "trim": "motors_trim",
                    "horsepower": "horsepower",
                    "doors": "doors",
                    "fuel_type": "fuel_type",
                    "cylinders": "no_of_cylinders",
                    "interior_color": "interior_color",
                    "exterior_color": "exterior_color",
                    "body_type": "body_type",
                    "seating_capacity": "seating_capacity",
                    "engine_capacity": "engine_capacity_cc",
                    "steering_side": "steering_side",
                    "regional_specs": "regional_specs",
                }
                result = {col: slug_map.get(slug) for col, slug in wanted.items()}
                result["_images"] = _extract_images(payload)
                return result
        except json.JSONDecodeError:
            pass

    # 2) Fallback: data-testid selectors (matching enrich_2.py)
    def _get(testid: str) -> str | None:
        el = soup.select_one(f'[data-testid="{testid}"]')
        return _clean(el.get_text()) if el else None

    # Try to extract images from og:image meta tags as fallback
    fallback_images: list[str] = []
    for meta in soup.select('meta[property="og:image"]'):
        content = meta.get("content")
        if content and isinstance(content, str) and content.startswith("http"):
            fallback_images.append(content)

    result = {
        "trim": _get("overview-motors_trim-value"),
        "horsepower": _get("overview-horsepower-value"),
        "doors": _get("overview-doors-value"),
        "fuel_type": _get("overview-fuel_type-value"),
        "cylinders": _get("overview-no_of_cylinders-value"),
        "interior_color": _get("overview-interior_color-value"),
        "exterior_color": _get("overview-exterior_color-value"),
        "body_type": _get("overview-body_type-value"),
        "seating_capacity": _get("overview-seating_capacity-value"),
        "engine_capacity": _get("overview-engine_capacity_cc-value"),
        "steering_side": _get("listing-steering_side-value"),
        "regional_specs": _get("listing-regional_specs-value"),
        "_images": fallback_images,
    }
    return result


def _find_listing_payload(obj: Any) -> dict | None:
    """
    Recursively search __NEXT_DATA__ for:
      payload -> listing -> details -> {primary, secondary}
    Matching enrich_2.py's find_first_listing_payload().
    """
    if isinstance(obj, dict):
        if "payload" in obj and isinstance(obj["payload"], dict):
            p = obj["payload"]
            if isinstance(p.get("listing"), dict) and isinstance(p["listing"].get("details"), dict):
                det = p["listing"]["details"]
                if isinstance(det.get("primary"), list) or isinstance(det.get("secondary"), list):
                    return p
        if isinstance(obj.get("listing"), dict) and isinstance(obj["listing"].get("details"), dict):
            det = obj["listing"]["details"]
            if isinstance(det.get("primary"), list) or isinstance(det.get("secondary"), list):
                return obj
        for v in obj.values():
            found = _find_listing_payload(v)
            if found:
                return found
    elif isinstance(obj, list):
        for item in obj:
            found = _find_listing_payload(item)
            if found:
                return found
    return None


# ═══════════════════════════════════════════════════════════════════
#  MAIN ENTRY POINTS
# ═══════════════════════════════════════════════════════════════════

def scrape_new_listings(db: Session, pages: int = MAX_PAGES) -> list[Listing]:
    """
    Scrape Dubizzle browse pages, discover new listing URLs,
    fetch detail pages for enrichment, and insert new Listings into DB.
    """
    user, _ = _get_credentials()
    if not user:
        logger.warning("OXY_PROXY_USER not set — skipping scrape")
        return []

    existing_urls: set[str] = set(
        r[0] for r in db.query(Listing.url).all()
    )
    logger.info(f"Existing URLs in DB: {len(existing_urls)}")

    # Step 1: Discover listings from browse pages (Web Scraper API)
    discovered: list[dict] = []
    seen_urls: set[str] = set()

    for page in range(1, pages + 1):
        url = f"{BROWSE_URL}?sorting=date_desc&page={page}"
        logger.info(f"Scraping browse page {page}/{pages}: {url}")
        html = _fetch_browse_html(url)
        if not html:
            logger.warning(f"Empty response for browse page {page}")
            continue

        stubs = _extract_listings_from_browse(html)
        for s in stubs:
            if s["url"] not in seen_urls:
                discovered.append(s)
                seen_urls.add(s["url"])

        time.sleep(SLEEP_BETWEEN)

    # Filter to only new URLs
    new_stubs = [s for s in discovered if s["url"] not in existing_urls]
    logger.info(f"Discovered {len(discovered)} total, {len(new_stubs)} new")

    if not new_stubs:
        return []

    # Step 2: Enrich each new listing via detail page (mobile proxy)
    new_listings: list[Listing] = []
    for i, stub in enumerate(new_stubs):
        logger.info(f"Enriching {i+1}/{len(new_stubs)}: {stub['url']}")
        html = _fetch_detail_html(stub["url"])
        details = _parse_detail_page(html) if html else {}

        scraped_images = details.get("_images") or []
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
            location=random.choice(UAE_LOCATIONS),
        )
        db.add(listing)
        new_listings.append(listing)
        time.sleep(SLEEP_BETWEEN)

    db.flush()
    logger.info(f"Inserted {len(new_listings)} new listings")
    return new_listings


def check_listing_alive(url: str) -> bool:
    """HEAD-check a listing URL. Returns True if alive, False if 404/gone."""
    proxies = _get_proxies()
    s = _get_session()
    try:
        resp = s.head(
            url, timeout=15, proxies=proxies, headers=HEADERS,
            allow_redirects=True,
        )
        if resp.status_code in (401, 403):
            logger.warning(f"Alive check {resp.status_code} for {url} — assuming alive (proxy block)")
            return True
        return resp.status_code != 404
    except RequestException:
        return True
