import time
import json
import requests
import pandas as pd
from bs4 import BeautifulSoup

MAX_PAGES = 332          # how many pages to try
SLEEP_SECONDS = 1.5      # pause between pages (be nice!)
PARTIAL_SAVE_EVERY = 20  # save a backup every N pages



BASE_URL = "https://www.dubicars.com"
SEARCH_URL = "https://www.dubicars.com/uae/used?page={page}"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    )
}


def parse_listings(html: str):
    """
    Extract car listings from a Dubicars search results page.
    """
    soup = BeautifulSoup(html, "html.parser")

    # each card = one li.serp-list-item (premium or not)
    cards = soup.select("li.serp-list-item")

    rows = []

    for card in cards:
        title = card.get("data-item-title")
        kms_raw = card.get("data-item-kilometers")

        ga4_raw = card.get("data-ga4-detail")
        sp_raw = card.get("data-sp-item")

        price = None
        currency = None
        city = None
        year = None
        km_numeric = None

        # Prefer data-ga4-detail
        if ga4_raw:
            try:
                ga4 = json.loads(ga4_raw)
                price = ga4.get("price")
                currency = ga4.get("currency")
                city = ga4.get("city")
                year = ga4.get("car_year")
            except Exception:
                pass

        # Fallbacks from data-sp-item
        if sp_raw:
            try:
                sp = json.loads(sp_raw)
                if price is None:
                    price = sp.get("rpr") or sp.get("pr")
                if year is None:
                    year = sp.get("y")
                if km_numeric is None:
                    km_numeric = sp.get("km")
            except Exception:
                pass

        # If km_numeric still None, clean text like "110,000 km"
        if km_numeric is None and kms_raw:
            digits = "".join(ch for ch in kms_raw if ch.isdigit())
            km_numeric = int(digits) if digits else None

        # URL – first link inside the card
        url = None
        link_el = card.select_one("a")
        if link_el and link_el.has_attr("href"):
            href = link_el["href"]
            if href.startswith("http"):
                url = href
            else:
                url = BASE_URL + href

        # skip junk (ads with no real title/price)
        if not title or price is None:
            continue

        rows.append(
            {
                "title": title,
                "price": price,
                "currency": currency,
                "city": city,
                "year": year,
                "kms_raw": kms_raw,
                "kms_numeric": km_numeric,
                "url": url,
            }
        )

    print(f"    Found {len(rows)} listings on this page")
    return rows


def main():
    all_rows = []
    pages_scraped = 0

    for page in range(1, MAX_PAGES + 1):
        url = SEARCH_URL.format(page=page)
        print(f"[+] Loading page {page}: {url}")

        resp = requests.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        html = resp.text

        # debug dump of first page
        if page == 1:
            with open("debug_dubicars_page1.html", "w", encoding="utf-8") as f:
                f.write(html)
            print("[+] Wrote debug_dubicars_page1.html")

        rows = parse_listings(html)
        if not rows:
            print("    No listings on this page, stopping.")
            break

        all_rows.extend(rows)
        pages_scraped += 1

        # partial backup every N pages
        if pages_scraped % PARTIAL_SAVE_EVERY == 0:
            tmp_name = f"dubicars_partial_{pages_scraped}_pages.csv"
            pd.DataFrame(all_rows).to_csv(tmp_name, index=False)
            print(f"[+] Saved partial backup: {tmp_name}")

        # be polite
        time.sleep(SLEEP_SECONDS)

    if not all_rows:
        print("[+] No data scraped, nothing to save.")
        return

    df = pd.DataFrame(all_rows)
    out_name = "dubicars_cars_seed.csv"
    df.to_csv(out_name, index=False)
    print(f"[+] Finished. Scraped {len(df)} listings from {pages_scraped} pages -> {out_name}")


if __name__ == "__main__":
    main()
