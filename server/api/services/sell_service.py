import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from db.models import Listing, MotorcycleListing
from models.schemas import (
    CarListingCreate,
    MotorcycleListingCreate,
    ListingSubmissionResponse,
    MyListingItem,
    MyListingsResponse,
    PendingListingsResponse,
)
from api.services.constants import HYBRID_PRICE_THRESHOLD, hp_to_midpoint, cc_to_midpoint

logger = logging.getLogger(__name__)


def _fmt_price(aed: int | None) -> str:
    if aed is None:
        return "Price on Request"
    return f"د.إ {aed:,}"


def _fmt_mileage(kms: int | None) -> str:
    if kms is None:
        return "N/A"
    return f"{kms:,} km"


def _run_car_prediction(listing: Listing) -> dict | None:
    try:
        from api.services.ml_service import MLService
        ml_service = MLService()
        if not ml_service.model_loaded:
            return None

        features = {
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

        catboost_result = ml_service.predict_price(features)
        catboost_price = int(catboost_result["predicted_price"])

        listing.sigma_log = catboost_result.get("sigma_log")
        listing.confidence_low = int(catboost_result.get("confidence_low", 0)) or None
        listing.confidence_high = int(catboost_result.get("confidence_high", 0)) or None

        lgbm_price = None
        try:
            from api.services.lgbm_service import LightGBMService
            lgbm_service = LightGBMService()
            if lgbm_service.model_loaded:
                lgbm_result = lgbm_service.predict_price(features)
                lgbm_price = int(lgbm_result["predicted_price"])
        except Exception as e:
            logger.warning(f"LightGBM not available: {e}")

        if lgbm_price is not None and listing.price and 0 < listing.price < HYBRID_PRICE_THRESHOLD:
            listing.predicted_price = lgbm_price
            listing.predicted_price_lgbm = catboost_price
        else:
            listing.predicted_price = catboost_price
            listing.predicted_price_lgbm = lgbm_price

        if listing.price and listing.predicted_price:
            diff_pct = (listing.predicted_price - listing.price) / listing.predicted_price * 100
            if diff_pct > 10:
                listing.deal_label = "Good Deal"
            elif diff_pct < -5:
                listing.deal_label = "Overpriced"
            else:
                listing.deal_label = "Fair"

        try:
            dep_data = ml_service.compute_depreciation(
                features, current_predicted_price=catboost_price
            )
            listing.depreciation_data = dep_data
        except Exception as e:
            logger.warning(f"Depreciation failed: {e}")

        return {
            "predicted_price": listing.predicted_price,
            "deal_label": listing.deal_label,
            "confidence_low": listing.confidence_low,
            "confidence_high": listing.confidence_high,
        }
    except Exception as e:
        logger.error(f"ML prediction failed for user listing: {e}")
        return None


def create_car_listing(db: Session, data: CarListingCreate, user_id: int) -> ListingSubmissionResponse:
    listing = Listing(
        brand=data.brand,
        model=data.model,
        trim=data.trim,
        year=data.year,
        price=data.price,
        kms=data.kms,
        fuel_type=data.fuel_type,
        body_type=data.body_type,
        cylinders=data.cylinders,
        horsepower=data.horsepower,
        engine_capacity=data.engine_capacity,
        doors=data.doors,
        seating_capacity=data.seating_capacity,
        steering_side=data.steering_side,
        regional_specs=data.regional_specs,
        exterior_color=data.exterior_color,
        interior_color=data.interior_color,
        location=data.location or "Dubai, UAE",
        image=data.image,
        images=data.images,
        seller_name=data.seller_name,
        seller_phone=data.seller_phone,
        description=data.description,
        source="user",
        is_user_submitted=True,
        listing_status="pending",
        submitted_by_user_id=user_id,
        url=None,
    )
    try:
        db.add(listing)
        db.flush()

        _run_car_prediction(listing)

        db.commit()
        db.refresh(listing)
    except Exception:
        db.rollback()
        raise

    return ListingSubmissionResponse(
        id=listing.id,
        type="car",
        status=listing.listing_status,
        predictedPrice=listing.predicted_price,
        dealLabel=listing.deal_label,
        confidenceLow=listing.confidence_low,
        confidenceHigh=listing.confidence_high,
    )


def create_motorcycle_listing(db: Session, data: MotorcycleListingCreate, user_id: int) -> ListingSubmissionResponse:
    listing = MotorcycleListing(
        brand=data.brand,
        model=data.model,
        trim=data.trim,
        year=data.year,
        price=data.price,
        kms=data.kms,
        engine_cc=data.engine_cc,
        motorcycle_type=data.motorcycle_type,
        horsepower=data.horsepower,
        fuel_type=data.fuel_type,
        exterior_color=data.exterior_color,
        regional_specs=data.regional_specs,
        location=data.location or "Dubai, UAE",
        image=data.image,
        images=data.images,
        seller_name=data.seller_name,
        seller_phone=data.seller_phone,
        description=data.description,
        source="user",
        is_user_submitted=True,
        listing_status="pending",
        submitted_by_user_id=user_id,
        url=None,
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)

    return ListingSubmissionResponse(
        id=listing.id,
        type="motorcycle",
        status=listing.listing_status,
    )


def _listing_to_my_item(row, item_type: str) -> MyListingItem:
    return MyListingItem(
        id=row.id,
        type=item_type,
        make=row.brand,
        model=row.model,
        trim=row.trim,
        year=row.year,
        price=_fmt_price(row.price),
        mileage=_fmt_mileage(row.kms),
        location=row.location or "Dubai, UAE",
        image=row.image or "",
        status=row.listing_status,
        createdAt=row.created_at.replace(tzinfo=timezone.utc).isoformat(),
    )


def get_user_listings(db: Session, user_id: int) -> MyListingsResponse:
    cars = (
        db.query(Listing)
        .filter(Listing.submitted_by_user_id == user_id, Listing.is_user_submitted == True)
        .order_by(Listing.created_at.desc())
        .all()
    )
    motorcycles = (
        db.query(MotorcycleListing)
        .filter(MotorcycleListing.submitted_by_user_id == user_id, MotorcycleListing.is_user_submitted == True)
        .order_by(MotorcycleListing.created_at.desc())
        .all()
    )
    return MyListingsResponse(
        cars=[_listing_to_my_item(r, "car") for r in cars],
        motorcycles=[_listing_to_my_item(r, "motorcycle") for r in motorcycles],
    )


def get_pending_listings(db: Session) -> PendingListingsResponse:
    cars = (
        db.query(Listing)
        .filter(Listing.listing_status == "pending")
        .order_by(Listing.created_at.desc())
        .all()
    )
    motorcycles = (
        db.query(MotorcycleListing)
        .filter(MotorcycleListing.listing_status == "pending")
        .order_by(MotorcycleListing.created_at.desc())
        .all()
    )
    return PendingListingsResponse(
        cars=[_listing_to_my_item(r, "car") for r in cars],
        motorcycles=[_listing_to_my_item(r, "motorcycle") for r in motorcycles],
    )


def update_listing_status(db: Session, listing_type: str, listing_id: int, new_status: str) -> None:
    if listing_type == "car":
        row = db.query(Listing).filter(Listing.id == listing_id).first()
    elif listing_type == "motorcycle":
        row = db.query(MotorcycleListing).filter(MotorcycleListing.id == listing_id).first()
    else:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Invalid type. Must be 'car' or 'motorcycle'.")

    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Listing not found.")

    row.listing_status = new_status
    db.commit()


def delete_user_listing(db: Session, listing_type: str, listing_id: int, user_id: int) -> None:
    from fastapi import HTTPException

    if listing_type == "car":
        row = db.query(Listing).filter(
            Listing.id == listing_id,
            Listing.submitted_by_user_id == user_id,
            Listing.is_user_submitted == True,
        ).first()
    elif listing_type == "motorcycle":
        row = db.query(MotorcycleListing).filter(
            MotorcycleListing.id == listing_id,
            MotorcycleListing.submitted_by_user_id == user_id,
            MotorcycleListing.is_user_submitted == True,
        ).first()
    else:
        raise HTTPException(status_code=400, detail="Invalid type.")

    if not row:
        raise HTTPException(status_code=404, detail="Listing not found.")

    if row.listing_status == "approved":
        raise HTTPException(status_code=400, detail="Cannot delete an approved listing.")

    db.delete(row)
    db.commit()
