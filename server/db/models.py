from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    Enum, ForeignKey, UniqueConstraint, JSON, Text,
)
from sqlalchemy.orm import relationship
from db.database import Base
import enum


class UserStatus(str, enum.Enum):
    free = "free"
    premium = "premium"
    admin = "admin"


class Listing(Base):
    __tablename__ = "listings"

    id = Column(Integer, primary_key=True, index=True)
    brand = Column(String(100), nullable=False, index=True)
    model = Column(String(200), nullable=False, index=True)
    trim = Column(String(200), nullable=True)
    year = Column(Integer, nullable=False, index=True)
    price = Column(Integer, nullable=False)             # AED, raw integer
    favorite_count = Column(Integer, default=0, server_default='0', nullable=False)
    kms = Column(Integer, nullable=True)
    url = Column(Text, nullable=False, unique=True)      # natural unique key
    horsepower = Column(String(50), nullable=True)
    doors = Column(String(20), nullable=True)
    fuel_type = Column(String(50), nullable=True)
    cylinders = Column(String(50), nullable=True)
    interior_color = Column(String(50), nullable=True)
    exterior_color = Column(String(50), nullable=True)
    body_type = Column(String(50), nullable=True)
    seating_capacity = Column(String(20), nullable=True)
    engine_capacity = Column(String(50), nullable=True)
    steering_side = Column(String(20), nullable=True)
    regional_specs = Column(String(50), nullable=True)
    image = Column(Text, nullable=True)
    images = Column(JSON, nullable=True)  # array of image URLs
    location = Column(String(100), nullable=True, default="Dubai, UAE")

    # ML-derived fields
    predicted_price = Column(Integer, nullable=True)
    predicted_price_lgbm = Column(Integer, nullable=True)
    deal_label = Column(String(20), nullable=True)       # "Good Deal" / "Fair" / "Overpriced"
    source = Column(String(50), nullable=False, default="dubizzle", index=True)
    depreciation_data = Column(JSON, nullable=True)

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
    is_active = Column(Boolean, default=False)   # inactive until user explicitly activates
    alerts_enabled = Column(Boolean, default=False)

    # Search criteria stored as JSONB
    criteria_json = Column(JSON, nullable=False, default=dict)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    matches = relationship("WatchlistMatch", back_populates="watchlist", cascade="all, delete-orphan")
    user = relationship("User", back_populates="watchlists")


class WatchlistMatch(Base):
    __tablename__ = "watchlist_matches"

    id = Column(Integer, primary_key=True, index=True)
    watchlist_id = Column(Integer, ForeignKey("watchlists.id", ondelete="CASCADE"), nullable=False)
    listing_id = Column(Integer, ForeignKey("listings.id", ondelete="CASCADE"), nullable=False)
    is_new = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    matched_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Prevent duplicate matches
    __table_args__ = (
        UniqueConstraint("watchlist_id", "listing_id", name="uq_watchlist_listing"),
    )

    # Relationships
    watchlist = relationship("Watchlist", back_populates="matches")
    listing = relationship("Listing", back_populates="watchlist_matches")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    watchlist_id = Column(Integer, ForeignKey("watchlists.id", ondelete="CASCADE"), nullable=False)
    listing_id = Column(Integer, ForeignKey("listings.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(30), nullable=False)  # "new_match", "listing_expired"
    title = Column(String(200), nullable=False)
    message = Column(String(500), nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    watchlist = relationship("Watchlist")
    listing = relationship("Listing")
    user = relationship("User", back_populates="notifications")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    supabase_id = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(200), nullable=False)
    phone = Column(String(50), nullable=True)
    location = Column(String(200), nullable=True)
    status = Column(Enum(UserStatus), default=UserStatus.free, nullable=False)
    avatar_seed = Column(String(100), default="Saif")

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    watchlists = relationship("Watchlist", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    chat_conversations = relationship("ChatConversation", back_populates="user", cascade="all, delete-orphan")


class ChatConversation(Base):
    __tablename__ = "chat_conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False, default="New Chat")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="chat_conversations")
    messages = relationship("ChatMessage", back_populates="conversation", cascade="all, delete-orphan",
                            order_by="ChatMessage.created_at")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("chat_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    conversation = relationship("ChatConversation", back_populates="messages")


class ModelAnalytics(Base):
    __tablename__ = "model_analytics"

    brand = Column(String(100), primary_key=True)
    model = Column(String(200), primary_key=True)
    chart_data = Column(JSON, nullable=False)
    sample_count = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
