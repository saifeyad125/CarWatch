"""
Chat service – context detection, DB context assembly, and Gemini streaming.
"""
import os
import re
import json
import logging
from typing import AsyncGenerator, List, Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import func, or_, case

from db.models import Listing, Watchlist, WatchlistMatch

logger = logging.getLogger(__name__)

# ─────────── System prompt ───────────

SYSTEM_PROMPT = (
    "You are CarWatch AI, a friendly and knowledgeable UAE used car market expert. "
    "You help users find, compare, and evaluate used cars listed on the UAE market.\n\n"
    "RULES:\n"
    "- Always quote prices in AED.\n"
    "- Only reference data provided in the [CONTEXT FROM DATABASE] block — never fabricate listings or prices.\n"
    "- When mentioning a specific car, include its listing ID so the user can look it up.\n"
    "- Deal labels: 'Good Deal' = priced below predicted market value, 'Fair' = around market value, 'Overpriced' = above predicted value.\n"
    "- When showing listings, format them clearly with key details (year, brand, model, price, deal label).\n"
    "- If a user asks for deals or best listings, highlight savings (difference between price and predicted price).\n"
    "- When comparing brands or models, use the market statistics provided.\n"
    "- Be concise but thorough — show real data, not just counts.\n"
    "- If the context says 'No listings found', tell the user honestly and suggest broadening their search."
)

# ─────────── Brand detection ───────────

# We'll dynamically load brands from the DB on first call, but keep a fallback list
# for keyword detection of common aliases
BRAND_ALIASES = {
    "merc": "Mercedes",
    "mercedes": "Mercedes",
    "benz": "Mercedes",
    "beemer": "BMW",
    "bimmer": "BMW",
    "vw": "Volkswagen",
    "lambo": "Lamborghini",
    "rover": "Land Rover",
    "range rover": "Land Rover",
    "rolls": "Rolls-Royce",
    "chevy": "Chevrolet",
    "landy": "Land Rover",
    "porky": "Porsche",
    "lexie": "Lexus",
}

# Standard brand names for detection
KNOWN_BRANDS = [
    "Acura", "Alfa Romeo", "Aston Martin", "Audi", "Bentley", "BMW", "BYD",
    "Cadillac", "Changan", "Chery", "Chevrolet", "Chrysler", "Citroen",
    "Dodge", "Ferrari", "Fiat", "Ford", "GAC", "Genesis", "GMC",
    "Haval", "Honda", "Hummer", "Hyundai", "Infiniti", "Isuzu", "Jaguar",
    "Jeep", "Kia", "Lamborghini", "Land Rover", "Lexus", "Lincoln", "Lotus",
    "Maserati", "Mazda", "McLaren", "Mercedes", "MG", "MINI",
    "Mitsubishi", "Nissan", "Peugeot", "Porsche", "RAM", "Renault",
    "Rolls-Royce", "Skoda", "Smart", "Subaru", "Suzuki", "Tesla",
    "Toyota", "Volkswagen", "Volvo", "Zeekr", "Geely", "Jetour",
]

_BRAND_LOWER_MAP = {b.lower(): b for b in KNOWN_BRANDS}


def _detect_brands(text: str) -> List[str]:
    """Detect brand names and aliases in user message."""
    text_lower = text.lower()
    matched = set()

    # Check aliases first (lambo, merc, etc.)
    for alias, brand in BRAND_ALIASES.items():
        if re.search(r'\b' + re.escape(alias) + r'\b', text_lower):
            matched.add(brand)

    # Check standard brand names
    for brand_lower, brand in _BRAND_LOWER_MAP.items():
        pattern = r'\b' + re.escape(brand_lower) + r'\b'
        if re.search(pattern, text_lower):
            matched.add(brand)

    return list(matched)


def _detect_price_range(text: str) -> Optional[Tuple[Optional[int], Optional[int]]]:
    """Parse price range from user text."""
    text_lower = text.lower().replace(",", "")

    def _parse_amount(s: str) -> int:
        s = s.strip()
        if s.endswith("k"):
            return int(float(s[:-1]) * 1000)
        return int(float(s))

    # "between X and Y"
    m = re.search(r'between\s+([\d.]+k?)\s+and\s+([\d.]+k?)', text_lower)
    if m:
        return (_parse_amount(m.group(1)), _parse_amount(m.group(2)))

    # "from X to Y" / "X to Y" / "X - Y"
    m = re.search(r'(?:from\s+)?([\d.]+k?)\s*(?:to|-)\s*([\d.]+k?)', text_lower)
    if m:
        return (_parse_amount(m.group(1)), _parse_amount(m.group(2)))

    # "under/below/less than/cheaper than X"
    m = re.search(r'(?:under|below|less than|cheaper than|max|up to)\s+(?:aed\s*)?([\d.]+k?)', text_lower)
    if m:
        return (None, _parse_amount(m.group(1)))

    # "above/over/more than/at least/minimum X"
    m = re.search(r'(?:above|over|more than|at least|minimum|min|starting from)\s+(?:aed\s*)?([\d.]+k?)', text_lower)
    if m:
        return (_parse_amount(m.group(1)), None)

    return None


def _wants_watchlist_info(text: str) -> bool:
    keywords = ["watchlist", "watch list", "tracking", "monitor", "alert", "alerts", "tracked", "watching", "my list"]
    return any(kw in text.lower() for kw in keywords)


def _wants_market_stats(text: str) -> bool:
    keywords = ["average", "market", "trend", "stats", "statistics",
                "cheapest", "most expensive", "price range", "overview", "how much"]
    return any(kw in text.lower() for kw in keywords)


def _wants_deals(text: str) -> bool:
    keywords = ["deal", "deals", "best", "bargain", "steal", "underpriced", "good deal", "savings",
                "worth", "value", "recommend"]
    return any(kw in text.lower() for kw in keywords)


def _wants_comparison(text: str) -> bool:
    keywords = ["compare", "comparison", "vs", "versus", "or", "better", "difference between"]
    return any(kw in text.lower() for kw in keywords)


def _wants_newest(text: str) -> bool:
    keywords = ["newest", "latest", "recent", "new listings", "just listed", "new cars"]
    return any(kw in text.lower() for kw in keywords)


# ─────────── Listing formatter ───────────

def _format_listing(li: Listing) -> str:
    """Format a single listing into a context line."""
    pred = f"AED {li.predicted_price:,}" if li.predicted_price else "N/A"
    kms_str = f"{li.kms:,} km" if li.kms else "N/A"
    savings = ""
    if li.predicted_price and li.price and li.deal_label == "Good Deal":
        diff = li.predicted_price - li.price
        savings = f" | Savings: AED {diff:,}"
    return (
        f"  - ID {li.id}: {li.year} {li.brand} {li.model}"
        f"{(' ' + li.trim) if li.trim else ''} | "
        f"Price: AED {li.price:,} | Predicted: {pred} | "
        f"Deal: {li.deal_label or 'N/A'}{savings} | Kms: {kms_str}"
    )


# ─────────── Context builder ───────────

def build_context(message: str, user_id: int, db: Session) -> str:
    """
    Assemble a context string from the database based on what the user is asking about.
    This gets injected into the prompt so the LLM has real data to work with.
    """
    sections: List[str] = []
    brands = _detect_brands(message)
    price_range = _detect_price_range(message)
    wants_deals = _wants_deals(message)
    wants_compare = _wants_comparison(message) and len(brands) >= 2
    wants_newest = _wants_newest(message)

    # ── Brand filter helper (uses % wildcards for partial matching) ──
    def _brand_filter(query, column=Listing.brand):
        """Apply brand filter with % wildcards so 'Mercedes' matches 'Mercedes-Benz'."""
        if brands:
            return query.filter(or_(*[column.ilike(f"%{b}%") for b in brands]))
        return query

    # ── 1. Best deals (when user asks for deals/best/recommendations) ──
    if wants_deals and not brands and not price_range:
        good_deals = (
            db.query(Listing)
            .filter(
                Listing.deal_label == "Good Deal",
                Listing.predicted_price.isnot(None),
            )
            .order_by((Listing.predicted_price - Listing.price).desc())
            .limit(10)
            .all()
        )
        if good_deals:
            lines = ["TOP 10 BEST DEALS (sorted by savings):"]
            for li in good_deals:
                lines.append(_format_listing(li))
            sections.append("\n".join(lines))

        # Also show deal distribution
        deal_counts = (
            db.query(Listing.deal_label, func.count(Listing.id))
            .filter(Listing.deal_label.isnot(None))
            .group_by(Listing.deal_label)
            .all()
        )
        if deal_counts:
            lines = ["DEAL DISTRIBUTION:"]
            for label, count in deal_counts:
                lines.append(f"  - {label}: {count} listings")
            sections.append("\n".join(lines))

    # ── 2. Comparison mode (two+ brands mentioned with "vs"/"compare") ──
    if wants_compare:
        lines = ["COMPARISON:"]
        for brand in brands:
            stats = db.query(
                func.count(Listing.id).label("count"),
                func.avg(Listing.price).label("avg_price"),
                func.min(Listing.price).label("min_price"),
                func.max(Listing.price).label("max_price"),
                func.avg(Listing.year).label("avg_year"),
            ).filter(Listing.brand.ilike(f"%{brand}%")).first()

            deal_counts = (
                db.query(Listing.deal_label, func.count(Listing.id))
                .filter(Listing.brand.ilike(f"%{brand}%"), Listing.deal_label.isnot(None))
                .group_by(Listing.deal_label)
                .all()
            )
            deal_str = ", ".join(f"{l}: {c}" for l, c in deal_counts) if deal_counts else "N/A"

            if stats and stats.count > 0:
                lines.append(
                    f"\n  {brand}:\n"
                    f"    Listings: {stats.count}\n"
                    f"    Price range: AED {stats.min_price:,} - AED {stats.max_price:,}\n"
                    f"    Average price: AED {int(stats.avg_price):,}\n"
                    f"    Average year: {int(stats.avg_year)}\n"
                    f"    Deals: {deal_str}"
                )

        # Show top 3 listings per brand
        for brand in brands:
            top3 = (
                db.query(Listing)
                .filter(Listing.brand.ilike(f"%{brand}%"))
                .order_by(Listing.deal_label.asc(), Listing.price.asc())
                .limit(3)
                .all()
            )
            if top3:
                lines.append(f"\n  Top {brand} listings:")
                for li in top3:
                    lines.append(_format_listing(li))

        sections.append("\n".join(lines))

    # ── 3. Listing search (brands and/or price detected) ──
    if (brands or price_range) and not wants_compare:
        query = db.query(Listing)
        query = _brand_filter(query)

        if price_range:
            min_p, max_p = price_range
            if min_p is not None:
                query = query.filter(Listing.price >= min_p)
            if max_p is not None:
                query = query.filter(Listing.price <= max_p)

        # Smart ordering: Good Deals first, then by savings
        if wants_deals:
            query = query.filter(Listing.deal_label == "Good Deal")
            listings = (
                query
                .filter(Listing.predicted_price.isnot(None))
                .order_by((Listing.predicted_price - Listing.price).desc())
                .limit(10)
                .all()
            )
        elif wants_newest:
            listings = query.order_by(Listing.created_at.desc()).limit(10).all()
        else:
            # Default: best deals first, then cheapest
            listings = (
                query
                .order_by(
                    case(
                        (Listing.deal_label == "Good Deal", 0),
                        (Listing.deal_label == "Fair", 1),
                        else_=2,
                    ),
                    Listing.price.asc(),
                )
                .limit(10)
                .all()
            )

        total_matching = _brand_filter(db.query(func.count(Listing.id))).scalar() if brands else None

        if listings:
            brand_label = " + ".join(brands) if brands else "All brands"
            price_label = ""
            if price_range:
                min_p, max_p = price_range
                if min_p and max_p:
                    price_label = f" (AED {min_p:,} - {max_p:,})"
                elif max_p:
                    price_label = f" (under AED {max_p:,})"
                elif min_p:
                    price_label = f" (above AED {min_p:,})"

            header = f"MATCHING LISTINGS — {brand_label}{price_label}"
            if total_matching:
                header += f" ({total_matching} total, showing top 10):"
            else:
                header += ":"
            lines = [header]
            for li in listings:
                lines.append(_format_listing(li))
            sections.append("\n".join(lines))
        else:
            filter_desc = []
            if brands:
                filter_desc.append(f"brand={'|'.join(brands)}")
            if price_range:
                min_p, max_p = price_range
                if max_p:
                    filter_desc.append(f"under AED {max_p:,}")
                if min_p:
                    filter_desc.append(f"above AED {min_p:,}")
            sections.append(f"No listings found matching: {', '.join(filter_desc)}.")

    # ── 4. Market stats (if requested or brands detected) ──
    if _wants_market_stats(message) or (brands and not wants_compare):
        stats_query = db.query(
            Listing.brand,
            func.count(Listing.id).label("count"),
            func.avg(Listing.price).label("avg_price"),
            func.min(Listing.price).label("min_price"),
            func.max(Listing.price).label("max_price"),
        ).group_by(Listing.brand)

        if brands:
            stats_query = stats_query.filter(
                or_(*[Listing.brand.ilike(f"%{b}%") for b in brands])
            )

        stats_query = stats_query.order_by(func.count(Listing.id).desc())
        stats = stats_query.all()

        if stats:
            lines = ["MARKET STATISTICS:"]
            for row in stats:
                lines.append(
                    f"  - {row.brand}: {row.count} listings | "
                    f"Avg: AED {int(row.avg_price):,} | "
                    f"Range: AED {row.min_price:,} - AED {row.max_price:,}"
                )
            sections.append("\n".join(lines))

    # ── 5. Watchlist info ──
    if _wants_watchlist_info(message):
        watchlists = (
            db.query(Watchlist)
            .filter(Watchlist.user_id == user_id)
            .all()
        )
        if watchlists:
            lines = ["YOUR WATCHLISTS:"]
            for wl in watchlists:
                match_count = (
                    db.query(func.count(WatchlistMatch.id))
                    .filter(WatchlistMatch.watchlist_id == wl.id)
                    .scalar()
                )
                status = "Active" if wl.is_active else "Inactive"
                lines.append(
                    f"  - \"{wl.title}\" (ID {wl.id}) | Status: {status} | "
                    f"Matches: {match_count} | Criteria: {json.dumps(wl.criteria_json)}"
                )
            sections.append("\n".join(lines))
        else:
            sections.append("You have no watchlists set up yet.")

    # ── 6. Fallback: general DB overview + sample good deals ──
    if not sections:
        total_listings = db.query(func.count(Listing.id)).scalar()
        good_deals_count = (
            db.query(func.count(Listing.id))
            .filter(Listing.deal_label == "Good Deal")
            .scalar()
        )
        brand_list = (
            db.query(Listing.brand, func.count(Listing.id).label("cnt"))
            .group_by(Listing.brand)
            .order_by(func.count(Listing.id).desc())
            .limit(15)
            .all()
        )
        brand_summary = ", ".join(f"{b.brand} ({b.cnt})" for b in brand_list)

        user_watchlist_count = (
            db.query(func.count(Watchlist.id))
            .filter(Watchlist.user_id == user_id)
            .scalar()
        )

        sections.append(
            f"DATABASE OVERVIEW:\n"
            f"  Total listings: {total_listings}\n"
            f"  Good deals: {good_deals_count}\n"
            f"  Top brands: {brand_summary}\n"
            f"  Your watchlists: {user_watchlist_count}"
        )

        # Always include some sample deals in fallback so the bot has concrete data
        sample_deals = (
            db.query(Listing)
            .filter(Listing.deal_label == "Good Deal", Listing.predicted_price.isnot(None))
            .order_by((Listing.predicted_price - Listing.price).desc())
            .limit(5)
            .all()
        )
        if sample_deals:
            lines = ["SAMPLE BEST DEALS:"]
            for li in sample_deals:
                lines.append(_format_listing(li))
            sections.append("\n".join(lines))

    return "\n\n".join(sections)


# ─────────── Gemini streaming ───────────

async def stream_chat_response(
    message: str,
    conversation_history: List[dict],
    user_id: int,
    db: Session,
) -> AsyncGenerator[str, None]:
    """
    Async generator that streams Gemini responses as SSE-formatted chunks.
    Each yield is a string like: data: {"text": "chunk"}\n\n
    Final yield is: data: [DONE]\n\n
    """
    try:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            yield f'data: {json.dumps({"text": "Error: Gemini API key not configured."})}\n\n'
            yield "data: [DONE]\n\n"
            return

        from google import genai

        client = genai.Client(api_key=api_key)

        # Build context from DB
        context = build_context(message, user_id, db)

        # Build conversation contents (last 20 messages)
        contents = []
        recent_history = conversation_history[-20:] if len(conversation_history) > 20 else conversation_history
        for msg in recent_history:
            role = "model" if msg.get("role") == "assistant" else "user"
            contents.append({"role": role, "parts": [{"text": msg["content"]}]})

        # Inject context into the current user message
        augmented_message = (
            f"[CONTEXT FROM DATABASE]\n{context}\n[END CONTEXT]\n\n"
            f"User message: {message}"
        )
        contents.append({"role": "user", "parts": [{"text": augmented_message}]})

        # Stream from Gemini
        response = client.models.generate_content_stream(
            model="gemini-2.5-flash",
            contents=contents,
            config={
                "system_instruction": SYSTEM_PROMPT,
                "temperature": 0.7,
                "max_output_tokens": 1024,
            },
        )

        for chunk in response:
            if chunk.text:
                yield f'data: {json.dumps({"text": chunk.text})}\n\n'

    except Exception as e:
        logger.error(f"Chat streaming error: {e}", exc_info=True)
        yield f'data: {json.dumps({"text": f"Sorry, I encountered an error: {str(e)}"})}\n\n'

    yield "data: [DONE]\n\n"
