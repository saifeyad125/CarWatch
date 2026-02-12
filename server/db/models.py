"""
SQLAlchemy ORM models – the actual DB tables.
"""
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, UniqueConstraint, JSON, Text,
)
from sqlalchemy.orm import relationship
from db.database import Base


class Listing(Base):
    __tablename__ = "listings"

    id = Column(Integer, primary_key=True, index=True)
    brand = Column(String(100), nullable=False, index=True)
    model = Column(String(200), nullable=False, index=True)
    trim = Column(String(200), nullable=True)
    year = Column(Integer, nullable=False, index=True)
    price = Column(Integer, nullable=False)             # AED, raw integer
    kms = Column(Integer, nullable=True)
    url = Column(Text, nullable=False, unique=True)      # natural unique key
    horsepower = Column(String(50), nullable=True)
    doors = Column(String(20), nullable=True)
    fuel_type = Column(String(50), nullable=True)
    cylinders = Column(String(10), nullable=True)
    interior_color = Column(String(50), nullable=True)
    exterior_color = Column(String(50), nullable=True)
    body_type = Column(String(50), nullable=True)
    seating_capacity = Column(String(20), nullable=True)
    engine_capacity = Column(String(50), nullable=True)
    steering_side = Column(String(20), nullable=True)
    regional_specs = Column(String(50), nullable=True)
    image = Column(Text, nullable=True)
    location = Column(String(100), nullable=True, default="Dubai, UAE")

    # ML-derived fields (populated by prediction service)
    predicted_price = Column(Integer, nullable=True)
    deal_label = Column(String(20), nullable=True)       # "Good Deal" / "Fair" / "Overpriced"

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    watchlist_matches = relationship("WatchlistMatch", back_populates="listing", cascade="all, delete-orphan")


class Watchlist(Base):
    __tablename__ = "watchlists"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    subtitle = Column(String(300), nullable=True)
    location_label = Column(String(200), nullable=True)
    tags = Column(JSON, default=list)                     # e.g. ["Used", "Certified"]
    is_active = Column(Boolean, default=True)
    alerts_enabled = Column(Boolean, default=False)

    # Search criteria stored as JSONB
    criteria_json = Column(JSON, nullable=False, default=dict)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    matches = relationship("WatchlistMatch", back_populates="watchlist", cascade="all, delete-orphan")


class WatchlistMatch(Base):
    __tablename__ = "watchlist_matches"

    id = Column(Integer, primary_key=True, index=True)
    watchlist_id = Column(Integer, ForeignKey("watchlists.id", ondelete="CASCADE"), nullable=False)
    listing_id = Column(Integer, ForeignKey("listings.id", ondelete="CASCADE"), nullable=False)
    is_new = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Prevent duplicate matches
    __table_args__ = (
        UniqueConstraint("watchlist_id", "listing_id", name="uq_watchlist_listing"),
    )

    # Relationships
    watchlist = relationship("Watchlist", back_populates="matches")
    listing = relationship("Listing", back_populates="watchlist_matches")
