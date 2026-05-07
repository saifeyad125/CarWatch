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
    url = Column(Text, nullable=True, unique=True)      # natural unique key
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
    location = Column(String(255), nullable=True, default="Dubai, UAE")

    # ML-derived fields
    predicted_price = Column(Integer, nullable=True)
    predicted_price_lgbm = Column(Integer, nullable=True)
    deal_label = Column(String(20), nullable=True)       # "Good Deal" / "Fair" / "Overpriced"
    source = Column(String(50), nullable=False, default="dubizzle", index=True)
    depreciation_data = Column(JSON, nullable=True)
    sigma_log = Column(Float, nullable=True)
    confidence_low = Column(Integer, nullable=True)
    confidence_high = Column(Integer, nullable=True)

    is_user_submitted = Column(Boolean, default=False, server_default="false", nullable=False)
    listing_status = Column(String(20), default="approved", server_default="approved", nullable=False, index=True)
    submitted_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    seller_phone = Column(String(50), nullable=True)
    seller_name = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    watchlist_matches = relationship("WatchlistMatch", back_populates="listing", cascade="all, delete-orphan")
    submitter = relationship("User", foreign_keys=[submitted_by_user_id])


class Dealer(Base):
    __tablename__ = "dealers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    logo_url = Column(Text, nullable=True)
    location = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    is_seed = Column(Boolean, default=False, server_default="false", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    listings = relationship("DealerListing", back_populates="dealer", cascade="all, delete-orphan")


class DealerListing(Base):
    __tablename__ = "dealer_listings"

    id = Column(Integer, primary_key=True, index=True)
    dealer_id = Column(Integer, ForeignKey("dealers.id", ondelete="CASCADE"), nullable=False, index=True)
    brand = Column(String(100), nullable=False, index=True)
    model = Column(String(200), nullable=False, index=True)
    trim = Column(String(200), nullable=True)
    year = Column(Integer, nullable=False, index=True)
    price = Column(Integer, nullable=False)
    kms = Column(Integer, nullable=True)
    url = Column(Text, nullable=True)
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
    images = Column(JSON, nullable=True)
    location = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)

    predicted_price = Column(Integer, nullable=True)
    predicted_price_lgbm = Column(Integer, nullable=True)
    deal_label = Column(String(20), nullable=True)
    sigma_log = Column(Float, nullable=True)
    confidence_low = Column(Integer, nullable=True)
    confidence_high = Column(Integer, nullable=True)
    depreciation_data = Column(JSON, nullable=True)

    is_seed = Column(Boolean, default=False, server_default="false", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    dealer = relationship("Dealer", back_populates="listings")
    watchlist_matches = relationship("DealerWatchlistMatch", back_populates="dealer_listing", cascade="all, delete-orphan")


class MotorcycleListing(Base):
    __tablename__ = "motorcycle_listings"

    id = Column(Integer, primary_key=True, index=True)
    brand = Column(String(100), nullable=False, index=True)
    model = Column(String(200), nullable=False, index=True)
    trim = Column(String(200), nullable=True)
    year = Column(Integer, nullable=False, index=True)
    price = Column(Integer, nullable=False)
    kms = Column(Integer, nullable=True)
    url = Column(Text, nullable=True, unique=True)
    engine_cc = Column(Integer, nullable=True)
    motorcycle_type = Column(String(50), nullable=True)
    horsepower = Column(String(50), nullable=True)
    fuel_type = Column(String(50), nullable=True)
    exterior_color = Column(String(50), nullable=True)
    regional_specs = Column(String(50), nullable=True)
    image = Column(Text, nullable=True)
    images = Column(JSON, nullable=True)
    location = Column(String(255), nullable=True, default="Dubai, UAE")
    source = Column(String(50), nullable=False, default="dubizzle", index=True)

    predicted_price = Column(Integer, nullable=True)
    deal_label = Column(String(20), nullable=True)
    sigma_log = Column(Float, nullable=True)
    confidence_low = Column(Integer, nullable=True)
    confidence_high = Column(Integer, nullable=True)
    depreciation_data = Column(JSON, nullable=True)

    is_user_submitted = Column(Boolean, default=False, server_default="false", nullable=False)
    listing_status = Column(String(20), default="approved", server_default="approved", nullable=False, index=True)
    submitted_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    seller_phone = Column(String(50), nullable=True)
    seller_name = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


class MotorcycleDealer(Base):
    __tablename__ = "motorcycle_dealers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    logo_url = Column(Text, nullable=True)
    location = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    is_seed = Column(Boolean, default=False, server_default="false", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    listings = relationship("DealerMotorcycleListing", back_populates="dealer", cascade="all, delete-orphan")


class DealerMotorcycleListing(Base):
    __tablename__ = "dealer_motorcycle_listings"

    id = Column(Integer, primary_key=True, index=True)
    dealer_id = Column(Integer, ForeignKey("motorcycle_dealers.id", ondelete="CASCADE"), nullable=False, index=True)
    brand = Column(String(100), nullable=False, index=True)
    model = Column(String(200), nullable=False, index=True)
    trim = Column(String(200), nullable=True)
    year = Column(Integer, nullable=False, index=True)
    price = Column(Integer, nullable=False)
    kms = Column(Integer, nullable=True)
    url = Column(Text, nullable=True)
    engine_cc = Column(Integer, nullable=True)
    motorcycle_type = Column(String(50), nullable=True)
    horsepower = Column(String(50), nullable=True)
    fuel_type = Column(String(50), nullable=True)
    exterior_color = Column(String(50), nullable=True)
    regional_specs = Column(String(50), nullable=True)
    image = Column(Text, nullable=True)
    images = Column(JSON, nullable=True)
    location = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)

    predicted_price = Column(Integer, nullable=True)
    deal_label = Column(String(20), nullable=True)
    sigma_log = Column(Float, nullable=True)
    confidence_low = Column(Integer, nullable=True)
    confidence_high = Column(Integer, nullable=True)
    depreciation_data = Column(JSON, nullable=True)

    is_seed = Column(Boolean, default=False, server_default="false", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    dealer = relationship("MotorcycleDealer", back_populates="listings")


class PartCategory(Base):
    __tablename__ = "part_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    slug = Column(String(200), nullable=False, unique=True)
    icon = Column(String(50), nullable=True)
    parent_id = Column(Integer, ForeignKey("part_categories.id"), nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    parent = relationship("PartCategory", remote_side=[id], backref="children")
    parts = relationship("Part", back_populates="category")


class Part(Base):
    __tablename__ = "parts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Integer, nullable=False)
    category_id = Column(Integer, ForeignKey("part_categories.id"), nullable=False, index=True)
    seller_name = Column(String(200), nullable=False)
    seller_phone = Column(String(50), nullable=True)
    seller_location = Column(String(255), nullable=True)
    image = Column(Text, nullable=True)
    images = Column(JSON, nullable=True)
    part_number = Column(String(100), nullable=True)
    is_seed = Column(Boolean, default=False, server_default="false", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    category = relationship("PartCategory", back_populates="parts")
    compatibilities = relationship("PartCompatibility", back_populates="part", cascade="all, delete-orphan")
    watchlist_matches = relationship("PartWatchlistMatch", back_populates="part", cascade="all, delete-orphan")


class PartCompatibility(Base):
    __tablename__ = "part_compatibilities"

    id = Column(Integer, primary_key=True, index=True)
    part_id = Column(Integer, ForeignKey("parts.id", ondelete="CASCADE"), nullable=False, index=True)
    brand = Column(String(100), nullable=False)
    model = Column(String(200), nullable=False)
    year_from = Column(Integer, nullable=True)
    year_to = Column(Integer, nullable=True)

    part = relationship("Part", back_populates="compatibilities")


class Watchlist(Base):
    __tablename__ = "watchlists"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    subtitle = Column(String(300), nullable=True)
    location_label = Column(String(200), nullable=True)
    tags = Column(JSON, default=list)                     # e.g. ["Used", "Certified"]
    is_active = Column(Boolean, default=False)   # inactive until user explicitly activates
    alerts_enabled = Column(Boolean, default=False)
    type = Column(String(20), default="car", server_default="car", nullable=False)

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


class DealerWatchlistMatch(Base):
    __tablename__ = "dealer_watchlist_matches"

    id = Column(Integer, primary_key=True, index=True)
    watchlist_id = Column(Integer, ForeignKey("watchlists.id", ondelete="CASCADE"), nullable=False)
    dealer_listing_id = Column(Integer, ForeignKey("dealer_listings.id", ondelete="CASCADE"), nullable=False)
    is_new = Column(Boolean, default=True)
    matched_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("watchlist_id", "dealer_listing_id", name="uq_watchlist_dealer_listing"),
    )

    watchlist = relationship("Watchlist")
    dealer_listing = relationship("DealerListing", back_populates="watchlist_matches")


class PartWatchlistMatch(Base):
    __tablename__ = "part_watchlist_matches"

    id = Column(Integer, primary_key=True, index=True)
    watchlist_id = Column(Integer, ForeignKey("watchlists.id", ondelete="CASCADE"), nullable=False)
    part_id = Column(Integer, ForeignKey("parts.id", ondelete="CASCADE"), nullable=False)
    is_new = Column(Boolean, default=True)
    matched_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("watchlist_id", "part_id", name="uq_watchlist_part"),
    )

    watchlist = relationship("Watchlist")
    part = relationship("Part", back_populates="watchlist_matches")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    watchlist_id = Column(Integer, ForeignKey("watchlists.id", ondelete="CASCADE"), nullable=False)
    listing_id = Column(Integer, ForeignKey("listings.id", ondelete="SET NULL"), nullable=True)
    dealer_listing_id = Column(Integer, ForeignKey("dealer_listings.id", ondelete="SET NULL"), nullable=True)
    part_id = Column(Integer, ForeignKey("parts.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(30), nullable=False)  # "new_match", "listing_expired"
    title = Column(String(200), nullable=False)
    message = Column(String(500), nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    watchlist = relationship("Watchlist")
    listing = relationship("Listing")
    dealer_listing = relationship("DealerListing")
    part_rel = relationship("Part")
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
