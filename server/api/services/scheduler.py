"""
APScheduler setup — runs the periodic scrape-and-match job.
"""
import os
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

SCRAPE_INTERVAL_HOURS = int(os.getenv("SCRAPE_INTERVAL_HOURS", "5"))

from db.database import SessionLocal
from db.models import Watchlist
from api.services.scraper_service import scrape_new_listings
from api.services.dubicars_scraper_service import scrape_dubicars_listings
from api.services.expiry_service import expire_listings
from api.services.notification_service import create_match_notifications
from api.services.watchlists_service import run_watchlist_scan

logger = logging.getLogger("scheduler")

scheduler = BackgroundScheduler()


def _safe_int(val: str | None) -> int | None:
    if val is None:
        return None
    try:
        return int(str(val).replace(",", "").strip())
    except (ValueError, AttributeError):
        return None


def _predict_and_label(listing, ml_service) -> None:
    """Run ML prediction on a single listing and update its fields."""
    try:
        features = {
            "brand": listing.brand or "Unknown",
            "model": listing.model or "Unknown",
            "year": listing.year or 2020,
            "mileage": listing.kms or 50000,
            "fuel_type": listing.fuel_type or "Petrol",
            "body_type": listing.body_type or "Unknown",
            "trim": listing.trim or "Unknown",
            "cylinders": _safe_int(listing.cylinders) or 4,
            "horsepower": _safe_int(listing.horsepower) or 200,
            "engine_cc": _safe_int(listing.engine_capacity) or 2000,
            "regional_specs": listing.regional_specs or "GCC",
            "steering_side": listing.steering_side or "Left",
            "doors": getattr(listing, "doors", None),
            "seating_capacity": getattr(listing, "seating_capacity", None),
        }
        result = ml_service.predict_price(features)
        listing.predicted_price = int(result["predicted_price"])

        # Label the deal
        if listing.price and listing.predicted_price:
            diff_pct = (listing.predicted_price - listing.price) / listing.predicted_price * 100
            if diff_pct > 10:
                listing.deal_label = "Good Deal"
            elif diff_pct < -5:
                listing.deal_label = "Overpriced"
            else:
                listing.deal_label = "Fair"

        # Compute depreciation projections (reuse predicted_price to avoid redundant inference)
        try:
            dep_data = ml_service.compute_depreciation(features, current_predicted_price=listing.predicted_price)
            listing.depreciation_data = dep_data
        except Exception as e:
            logger.warning(f"Depreciation failed for listing {listing.id}: {e}")
    except Exception as e:
        logger.warning(f"ML prediction failed for listing {listing.id}: {e}")


def hourly_scrape_and_match():
    """
    The main hourly job:
      1. Scrape new Source (Dubizzile, DubiCars, etc.) listings
      2. Run ML predictions on new listings
      3. Expire old/dead listings
      4. Re-scan all active watchlists
      5. Create notifications for new matches
    """
    logger.info("=== Hourly scrape-and-match job started ===")
    db = SessionLocal()
    try:
        # Step 1a: Discover + insert new Dubizzle listings
        new_listings = scrape_new_listings(db, pages=5)
        logger.info(f"Step 1a: {len(new_listings)} new Dubizzle listings scraped")

        # Step 1b: Discover + insert new DubiCars listings
        try:
            dubicars_listings = scrape_dubicars_listings(db, pages=int(os.getenv("DUBICARS_MAX_PAGES", "5")))
            new_listings.extend(dubicars_listings)
            logger.info(f"Step 1b: {len(dubicars_listings)} new DubiCars listings scraped")
        except Exception as e:
            logger.error(f"Step 1b: DubiCars scrape failed (continuing): {e}")

        # Step 2: Run ML predictions
        if new_listings:
            try:
                from api.services.ml_service import MLService
                ml_service = MLService()
                for listing in new_listings:
                    _predict_and_label(listing, ml_service)
                db.commit()
                logger.info(f"Step 2: ML predictions complete for {len(new_listings)} listings")
            except Exception as e:
                logger.warning(f"Step 2: ML prediction skipped: {e}")

        # Step 3: Expire old/dead listings
        expiry_result = expire_listings(db)
        logger.info(f"Step 3: Expired {expiry_result['age_expired']} by age, "
                     f"{expiry_result['dead']} by 404")

        # Step 4 & 5: Re-scan active watchlists + create notifications
        active_watchlists = (
            db.query(Watchlist)
            .filter(Watchlist.is_active == True)
            .all()
        )
        total_new_matches = 0
        total_notifications = 0
        for w in active_watchlists:
            result = run_watchlist_scan(db, w.id)
            new_ids = result.get("newMatchListingIds", [])
            total_new_matches += len(new_ids)

            if new_ids and w.alerts_enabled:
                total_notifications += create_match_notifications(db, w, new_ids)

        db.commit()
        logger.info(f"Step 4-5: Scanned {len(active_watchlists)} watchlists, "
                     f"{total_new_matches} new matches, {total_notifications} notifications")

        logger.info("=== Hourly job complete ===")

    except Exception as e:
        logger.error(f"Hourly job failed: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    """Start the APScheduler with the periodic scrape job."""
    scheduler.add_job(
        hourly_scrape_and_match,
        trigger=IntervalTrigger(hours=SCRAPE_INTERVAL_HOURS),
        id="hourly_scrape_and_match",
        name=f"Scrape (Dubizzle+DubiCars) + watchlist match (every {SCRAPE_INTERVAL_HOURS}h)",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"Scheduler started — scrape job every {SCRAPE_INTERVAL_HOURS} hours")


def stop_scheduler():
    """Gracefully shut down the scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
