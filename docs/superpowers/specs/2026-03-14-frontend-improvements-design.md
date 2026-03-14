# CarWatch Frontend Improvements — Design Spec

**Date:** 2026-03-14
**Scope:** 9 discrete front-end and backend improvements
**Status:** Approved

---

## Task 1: Popular Listings by Engagement

### Problem
Home page "Popular Listings" fetches the first 8 listings with no ranking logic. There is no server-side tracking of user engagement (favorites are localStorage-only).

### Solution

**Backend:**
- Alembic migration: add `favorite_count INTEGER DEFAULT 0` to `listings` table
- New route `POST /api/cars/{car_id}/favorite` — increments `favorite_count` by 1, returns updated count
- New route `DELETE /api/cars/{car_id}/favorite` — decrements `favorite_count` by 1 (floor at 0), returns updated count
- Modify `GET /api/cars`: add `sort: Optional[str] = Query(None)` parameter. When `sort == "popular"`, order by `Listing.favorite_count.desc(), Listing.created_at.desc()`. Default (no sort) keeps current behavior: `Listing.id.desc()`

**Frontend (`app/page.tsx`):**
- Change fetch to `GET /api/cars?sort=popular&limit=8`
- Section header: display actual total listing count (see Task 7)

**Frontend (`components/ui/car-card.tsx` + all pages with favorite toggle):**
- On favorite toggle, call `POST` or `DELETE /api/cars/{id}/favorite` alongside existing localStorage logic
- localStorage remains the source of truth for the heart icon state (keeps working for non-auth edge cases)
- API call is fire-and-forget (don't block UI on response)

**Note:** Rapid toggling may cause minor count inaccuracies due to race conditions. This is acceptable since `favorite_count` is a ranking signal, not a precise metric. The floor-at-0 guard prevents negative values.

### Files Changed
- `server/api/routes/cars.py` — new endpoints + sort param
- `server/db/models.py` — add column
- `server/alembic/versions/` — new migration
- `app/page.tsx` — fetch with sort=popular
- `components/ui/car-card.tsx` — API call on toggle
- `lib/api.ts` — add favorite/unfavorite endpoint definitions

---

## Task 2a: Dynamic Retention Bar Colors

### Problem
Retention chart bars in `analysis/page.tsx` currently have a two-tier color system: `>=80%` → emerald, else amber, plus a hardcoded red for the last bar (`isLast`) and emerald-600 for the first bar (`isNow`). This doesn't give a smooth visual gradient as retention drops — bars at 55% and 75% both show amber.

### Solution
Replace the existing color logic (including the `isLast`/`isNow` overrides) with a continuous 4-tier function applied uniformly to every bar based on its `retentionPct`:

```typescript
function retentionColor(pct: number): string {
  if (pct >= 80) return "bg-emerald-500"
  if (pct >= 60) return "bg-amber-500"
  if (pct >= 50) return "bg-orange-500"
  return "bg-red-500"
}
```

The first bar (current value, typically ~100%) will naturally be emerald. The last bar will naturally be red/orange if retention is low enough. No special-case overrides needed.

### Files Changed
- `app/listing/[id]/analysis/page.tsx` — retention chart color logic

---

## Task 2b: Competitive Market Analysis Uses Similar Listings

### Problem
Competitive market analysis on the analysis page pulls from `model_analytics` table — pre-computed offline from training CSV data. The data is stale (doesn't reflect live listings) and the matching is done at the brand+model level via `ModelAnalytics` table lookup, so it can't adapt to the specific listing's characteristics (year, price range, trim).

### Solution

**Backend (`server/api/routes/cars.py`):**
- In the `GET /api/cars/{car_id}/analysis` endpoint, replace the `ModelAnalytics` competitor lookup with a live computation:
  1. Query ALL listings (not just same-brand, unlike the similar listings endpoint) up to 500, excluding the current listing
  2. Reuse the existing `_similarity_score()` function to score each candidate
  3. Take top 30 by score, group by brand+model, aggregate: avg_price, avg_kms, avg_year, count
  4. Return top 5 groups (by count, then avg score) as `competitors[]`
- This gives cross-brand competitors (e.g., a Toyota Camry might show Honda Accord, Nissan Altima)
- Keep priceVsMileage and priceVsYear from ModelAnalytics if available (these are still useful chart data)

**Frontend:** No changes needed — the `competitors` array keeps the same schema (`brand`, `model`, `avgPrice`, `avgKms`, `avgYear`, `count`).

### Files Changed
- `server/api/routes/cars.py` — analysis endpoint competitor computation

---

## Task 3a: Chat Sidebar Previous Conversations

### Problem
The chat sidebar has UI for listing previous conversations, but they never appear. Root cause: `fetchConversations()` runs in `useEffect(() => {...}, [])` on component mount, but the Supabase session isn't initialized yet at that point. `getAuthHeaders()` returns no token, the backend returns 401 (all chat endpoints require auth via `Depends(get_current_user)`), `res.ok` is false, and the function silently exits. `isLoading` becomes `false`, showing "No conversations yet."

### Solution
Change the useEffect dependency array to include `user` from `useAuth()`:

```typescript
useEffect(() => {
  if (user) {
    fetchConversations();
  } else {
    setIsLoading(false);
  }
}, [user]);
```

This ensures the fetch only fires once the Supabase session is available and `user` is populated.

### Files Changed
- `app/chat/page.tsx` — fix useEffect dependency for conversation fetch

---

## Task 3b: Chat Respects Light/Dark Mode

### Problem
Chat sidebar and message area use hardcoded dark colors (`hsl(223, 47%, 11%)`, etc.) that ignore the theme.

### Solution
Replace all hardcoded color values with Tailwind theme tokens:

| Current | Replacement |
|---------|-------------|
| `style={{ backgroundColor: 'hsl(223, 47%, 11%)' }}` | `className="bg-card"` |
| `style={{ backgroundColor: 'hsl(223, 47%, 15%)' }}` | `className="bg-muted"` |
| `style={{ color: 'hsl(...)' }}` | `className="text-foreground"` / `"text-muted-foreground"` |
| Hardcoded border colors | `border-border` |
| Hardcoded hover backgrounds | `hover:bg-accent` |

Apply to all inline `style` props throughout `chat/page.tsx` — sidebar, message list, input area, header. Remove every `style={{ ... }}` that sets color/background and replace with theme-aware class names.

### Files Changed
- `app/chat/page.tsx` — replace all inline styles with theme-aware classes

---

## Task 4: Lenient Browse Search

### Problem
Searching "bmw x5" returns 0 results because the backend wraps the entire string in `%bmw x5%` and no single column contains that substring.

### Solution

**Backend (`server/api/routes/cars.py`, `GET /api/cars`):**

Replace:
```python
if search:
    term = f"%{search}%"
    q = q.filter(or_(
        Listing.brand.ilike(term),
        Listing.model.ilike(term),
        Listing.location.ilike(term),
    ))
```

With:
```python
if search:
    tokens = search.strip().split()
    for token in tokens:
        term = f"%{token}%"
        q = q.filter(or_(
            Listing.brand.ilike(term),
            Listing.model.ilike(term),
            Listing.location.ilike(term),
        ))
```

Each token must match at least one column (AND across tokens). "bmw x5" → "bmw" matches brand AND "x5" matches model.

### Files Changed
- `server/api/routes/cars.py` — search filter logic

---

## Task 5: SQL Injection Protection

### Current State
Already safe — SQLAlchemy `.ilike()` uses parameterized queries. No raw SQL constructed with user input.

### Defense-in-Depth
- Cap `search` parameter at 200 characters via FastAPI `Query(max_length=200)`
- Strip null bytes from search input (only when search is not None): `search = search.replace('\x00', '')`

### Files Changed
- `server/api/routes/cars.py` — add max_length and null byte strip

---

## Task 6: Add Model to Browse Filters

### Problem
Browse page has Make filter but no Model filter. Users can't narrow to specific models.

### Solution

**Frontend (`app/browse/page.tsx`):**
- Add `selectedModel` state and `availableModels` state
- When `selectedMake` changes, fetch models from `GET /api/cars/brands/{make}/models` and populate `availableModels`. Clear `selectedModel`.
- Render Model dropdown below Make dropdown (disabled/hidden when no make selected)
- Add `model` to URL params sent to `GET /api/cars`
- Add Model to active filter chips with clear button

**Note:** The makes dropdown currently derives options from the fetched 200 listings, not from `GET /api/cars/brands`. This means the model dropdown (from the full DB) may occasionally show models not present in the current filtered page. This is acceptable — the API will return the correct filtered results.

**Backend:** Already supports `model` query param in `GET /api/cars`. No changes needed.

### Files Changed
- `app/browse/page.tsx` — model filter dropdown + state + API param

---

## Task 7: Fix Home Screen "8+ Listings"

### Problem
Text shows `${popularListings.length}+ Listings` (e.g., "8+ Listings") which is misleading — it's just the fetch limit, not total count.

### Solution

**Backend (`server/api/routes/cars.py`):**
- In `GET /api/cars`, add a separate count query using the same filters (excluding limit/offset)
- Return response as `{ "listings": [...], "total": <int> }`
- Update response model in schemas if needed

**Breaking change:** This changes the `GET /api/cars` response from a plain array `CarListingSummary[]` to an object `{ listings: CarListingSummary[], total: number }`. All frontend consumers must be updated:
- `app/page.tsx` — destructure `{ listings, total }`, display `${total} Live Listings`
- `app/browse/page.tsx` — destructure `{ listings }` from response instead of using response directly as array
- `app/favorites/page.tsx` — individual car detail fetches (`GET /api/cars/{id}`) are unaffected
- Any other consumer of `GET /api/cars` list endpoint

**This task must be implemented atomically** — backend response change + all frontend consumers in the same step.

### Files Changed
- `server/api/routes/cars.py` — add total count to response, change response shape
- `server/models/schemas.py` — new `CarListingsResponse` schema with `listings` + `total`
- `app/page.tsx` — destructure new response, display total
- `app/browse/page.tsx` — destructure new response

---

## Task 8: Alerts Page Redesign

### Problem
`profile/alerts/page.tsx` has weak visual hierarchy, no grouping, inconsistent spacing, and feels like an afterthought compared to the rest of the app.

### Solution

**Layout restructuring:**
- Group notifications by date: "Today", "Yesterday", "This Week", "Older" — with subtle section headers
- Each notification card: icon (left, color-coded by type), title + message (center, stacked), timestamp (right-aligned)
- Unread indicator: `border-l-4 border-primary` left accent instead of full border glow
- Clickable cards: `new_match` with valid `listingId` → navigate to `/listing/{id}`, `new_match` with null `listingId` (listing deleted) → navigate to watchlist. `listing_expired` → navigate to `/watchlist/{watchlistId}`

**Summary section:**
- Prominent unread count as large number with label
- "Mark all read" button beside it
- Clean stat row: total / unread / this week

**Empty state:**
- Bell icon with message: "No notifications yet"
- CTA: "Create a watchlist to start receiving alerts"

**Styling:**
- Match app-wide card styling: same shadows, radii, hover transitions
- Remove gradient background on summary card (use flat bg-card)
- Consistent padding and spacing with other profile sub-pages

### Files Changed
- `app/profile/alerts/page.tsx` — full redesign

---

## Task 9: Watchlist Dropdown Opacity Fix

### Problem
Make/model dropdowns in watchlist creation form (`app/watchlist/page.tsx`) have transparent or semi-transparent backgrounds, causing content behind them to bleed through.

### Solution
- Set dropdown container to solid background: `bg-white dark:bg-zinc-900` (explicit solid colors, not theme tokens that may resolve to transparent)
- Ensure `z-50` for proper stacking above other content
- Confirm `shadow-elevated` is applied for depth cue
- Add `backdrop-blur-none` to prevent any inherited blur effects

### Files Changed
- `app/watchlist/page.tsx` — dropdown container styling

---

## Dependency Order

**Task 7 is a breaking change** that affects the `GET /api/cars` response shape. It must be implemented atomically (backend + all frontend consumers together).

**Task 1 depends on Task 7** if implemented after it (must use the new response shape). If Task 1 is implemented first, Task 7 must update the home page fetch to use the new shape.

**Recommended implementation order:**
1. Tasks 4 + 5 (search improvements, minimal risk, same file)
2. Task 7 (response shape change — do this early to avoid rework)
3. Task 1 (favorite count + migration, uses new response shape)
4. Task 2b (competitive analysis, backend)
5. Tasks 2a, 3a, 3b, 6, 8, 9 (frontend-only, independent, can be parallelized)
