# CarWatch

A used car price prediction platform for the UAE market. It scrapes live listings from Dubizzle and DubiCars, then routes each one through a hybrid ML pipeline: listings under 800k AED get priced by LightGBM, while luxury listings (800k+) go through a two-stage CatBoost model with a dedicated residual correction layer. Each listing gets labeled as a good deal, fair, or overpriced based on the prediction. Users can browse listings, set up watchlists with custom filters, and get notified when a matching deal appears.

Live at [carwatch.co](https://carwatch.co)

## Stats

- ~65,000 listings scraped and processed
- 52,028 training samples, 13,008 test samples
- Hybrid model (LightGBM + CatBoost): R2 = 0.88, MAE = 35,337 AED, MedAPE = 9.21%
- 91.4% coverage on 90% confidence intervals (CatBoost)
- 16 features (11 categorical + 5 numerical)
- Scrapes from 2 sources every 5 hours automatically, adjustable 
- 30 API endpoints across 7 route modules
- 15 pages in the frontend, 16 UI components

## Tech Stack

**Frontend** - Next.js 16, React 19, TypeScript, Tailwind CSS v4, Radix UI, Framer Motion

**Backend** - FastAPI (Python), SQLAlchemy 2.0, Alembic/Supabase Dashboard for migrations, APScheduler for job scheduling

**Database** - PostgreSQL (Supabase in production, Docker locally)

**ML** - Hybrid pipeline: LightGBM (budget/mid segment) + two-stage CatBoost with luxury residual correction (800k+ AED)

**Scraping** - BeautifulSoup4, Requests, Oxylabs residential proxies

**AI Chat** - Google Gemini for conversational car advice

**Auth** - Supabase Auth (JWT, supports both HS256 and ES256)

**Deployment** - Vercel (frontend), Railway (backend), Supabase (database + auth)

## Project Structure

```
project/
├── ai_training/          # Training scripts, notebooks, datasets, model comparison
├── app/                  # Next.js pages (browse, chat, listings, watchlist, profile, auth)
├── components/           # React components (car cards, navigation, UI primitives)
├── data/                 # Stored raw and processed data before training the models 
├── lib/                  # API client, hooks, Supabase client, utilities
├── scraper/              # Standalone scraping scripts and preprocessing
├── server/
│   ├── api/
│   │   ├── routes/       # FastAPI route handlers (cars, predictions, watchlists, chat, etc.)
│   │   └── services/     # Business logic (ML, scraping, watchlist matching, notifications)
│   ├── db/               # SQLAlchemy models, Alembic migrations, auth dependencies
│   └── models/           # Production ML model files (.cbm, .txt, .json)
```

## How It Works

### Scraping Pipeline

Every 5 hours, APScheduler kicks off a pipeline that:
1. Scrapes new listings from Dubizzle (via proxy) and DubiCars (direct)
2. Normalizes brand/model names, extracts specs (engine size, horsepower, etc.)
3. Runs each listing through the ML model to get a predicted price and confidence interval
4. Labels the deal quality by comparing the listed price to the prediction
5. Expires listings that are no longer live (image HEAD checks)/30 day automatic deletion
6. Scans all active watchlists against new listings and creates notifications for matches

### ML Model (Hybrid LightGBM + CatBoost)

Both models predict in log-price space, then convert back to AED. The system routes predictions based on a 800k AED threshold.

**Under 800k AED** - LightGBM handles the budget and mid-range segments. It's faster and more accurate on this price range (MedAPE of ~8.8%).

**800k AED and above** - A two-stage CatBoost pipeline takes over. Stage 1 predicts a base price with uncertainty bounds using 16 features (brand, model, trim, year, kms, fuel type, body type, etc.). Stage 2 is a luxury correction layer that refines the residual error for high-value cars. A sigmoid blend smoothly transitions between the base and corrected predictions so there's no hard cutoff.

CatBoost also provides the confidence intervals for all predictions, regardless of which model is primary. Calibration is stored in `calibration_info.json` and controls the interval width, luxury threshold, and blending parameters.

### Watchlists

Users set filters (brand, model, year range, price range, deal quality) and the system periodically scans all listings against active watchlists. When a new listing matches, it shows up in the watchlist's match list and a notification is created.

### Database

8 tables: `listings`, `watchlists`, `watchlist_matches`, `notifications`, `users`, `chat_conversations`, `chat_messages`, `model_analytics`

Managed with SQLAlchemy 2.0 ORM and Alembic migrations.

## Setup (Local Development)

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker (for local PostgreSQL)

### Frontend

```bash
npm install
cp .env.example .env.local
# edit .env.local with your Supabase project URL and anon key
npm run dev
```

Runs on http://localhost:3000

### Backend

```bash
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# edit .env with your database URL, API keys, proxy credentials

# start local postgres
docker compose up -d

# run migrations
alembic upgrade head

# start the server
bash start.sh
```

`start.sh` activates the venv, kills anything already on port 8000, and runs the server.

Runs on http://localhost:8000

API docs available at http://localhost:8000/docs (Swagger UI)

## API Overview

| Route Group | Prefix | What it does |
|---|---|---|
| Cars | `/api/cars` | Browse listings, search by brand/model, get listing details and similar cars |
| Predictions | `/api/predictions` | Get price predictions, deal analysis, model info |
| Watchlists | `/api/watchlists` | Create/manage saved searches, view matches, trigger scans |
| Chat | `/api/chat` | AI-powered car advice conversations (Gemini) |
| Profile | `/api/profile` | User profile management |
| Notifications | `/api/notifications` | List notifications, mark as read, unread count |
| Health | `/api` | Health check and root endpoint |

## Environment Variables

See `.env.example` (frontend) and `server/.env.example` (backend) for all required variables with descriptions.
