"""
APScheduler setup for the periodic scrape-and-match job.
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
from api.services.constants import HYBRID_PRICE_THRESHOLD, hp_to_midpoint, cc_to_midpoint

logger = logging.getLogger("scheduler")

scheduler = BackgroundScheduler()


def _build_features(listing) -> dict:
    return {
        "brand": listing.brand,
        "model": listing.model,
        "year": listing.year,
        "mileage": listing.kms,
        "fuel_type": listing.fuel_type,
        "body_type": listing.body_type,
        "trim": listing.trim,
        "cylinders": listing.cylinders,
        "horsepower": hp_to_midpoint(listing.horsepower),
        "engine_cc": cc_to_midpoint(listing.engine_capacity),
        "regional_specs": listing.regional_specs,
        "steering_side": listing.steering_side,
        "doors": listing.doors,
        "seating_capacity": listing.seating_capacity,
    }


def _predict_and_label(listing, ml_service, lgbm_service=None) -> None:
    try:
        features = _build_features(listing)

        # catboost always runs (need uncertainty + depreciation)
        catboost_result = ml_service.predict_price(features)
        catboost_price = int(catboost_result["predicted_price"])

        lgbm_price = None
        if lgbm_service and lgbm_service.model_loaded:
            try:
                lgbm_result = lgbm_service.predict_price(features)
                lgbm_price = int(lgbm_result["predicted_price"])
            except Exception as e:
                logger.warning(f"LightGBM failed for listing {listing.id}: {e}")

        # predicted_price_lgbm is the secondary model, not necessarily LightGBM
        if lgbm_price is not None and listing.price and 0 < listing.price < HYBRID_PRICE_THRESHOLD:
            listing.predicted_price = lgbm_price
            listing.predicted_price_lgbm = catboost_price
        else:
            listing.predicted_price = catboost_price
            listing.predicted_price_lgbm = lgbm_price  # may be None

        if listing.price and listing.predicted_price:
            diff_pct = (listing.predicted_price - listing.price) / listing.predicted_price * 100
            if diff_pct > 10:
                listing.deal_label = "Good Deal"
            elif diff_pct < -5:
                listing.deal_label = "Overpriced"
            else:
                listing.deal_label = "Fair"

        # depreciation uses catboost for curve consistency
        try:
            dep_data = ml_service.compute_depreciation(
                features, current_predicted_price=catboost_price
            )
            listing.depreciation_data = dep_data
        except Exception as e:
            logger.warning(f"Depreciation failed for listing {listing.id}: {e}")
    except Exception as e:
        logger.warning(f"ML prediction failed for listing {listing.id}: {e}")


def hourly_scrape_and_match():
    # scrape -> predict -> expire -> match -> notify
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

        # Step 2: ML predictions
        if new_listings:
            try:
                from api.services.ml_service import MLService
                ml_service = MLService()
                lgbm_service = None
                try:
                    from api.services.lgbm_service import LightGBMService
                    lgbm_service = LightGBMService()
                except Exception as e:
                    logger.warning(f"Step 2: LightGBM not available, using CatBoost only: {e}")
                for listing in new_listings:
                    _predict_and_label(listing, ml_service, lgbm_service)
                db.commit()
                lgbm_status = "loaded" if lgbm_service and lgbm_service.model_loaded else "not available"
                logger.info(f"Step 2: Hybrid predictions complete for {len(new_listings)} listings (LightGBM: {lgbm_status})")
            except Exception as e:
                logger.warning(f"Step 2: ML prediction skipped: {e}")

        # Step 3: Expire old/dead listings
        expiry_result = expire_listings(db)
        logger.info(f"Step 3a: Expired {expiry_result['age_expired']} by age")
        logger.info(f"Step 3b: {expiry_result['image_dead']} dead by image check "
                     f"(of {expiry_result['image_checked']} checked)")
        logger.info(f"Step 3c: {expiry_result['dead']} dead by URL check "
                     f"(of {expiry_result['checked']} sampled)")

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
    scheduler.add_job(
        hourly_scrape_and_match,
        trigger=IntervalTrigger(hours=SCRAPE_INTERVAL_HOURS),
        id="hourly_scrape_and_match",
        name=f"Scrape (Dubizzle+DubiCars) + watchlist match (every {SCRAPE_INTERVAL_HOURS}h)",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"Scheduler started - scrape job every {SCRAPE_INTERVAL_HOURS} hours")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
