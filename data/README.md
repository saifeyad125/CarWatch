# Data Directory

This directory contains all datasets for the CarWatch project. CSV files are excluded from git to keep the repository size small.

## Structure

```
data/
├── brands.csv              # List of car brands (tracked in git)
├── raw/                    # Raw scraped data (NOT in git)
│   ├── dubuzzile/         # Dubizzle UAE scraped listings
│   │   ├── dubizzle_combined.csv              ✅ EXISTS
│   │   ├── dubizzile_final_raw.csv            ✅ EXISTS  
│   │   └── dubizzle_combined_enriched_with_empty.csv  ✅ EXISTS
│   └── auto_ae/           # Auto.ae scraped listings
│       ├── auto_ae_listings.csv               ✅ EXISTS
│       └── auto_ae_listings_pages_*.csv       ✅ EXISTS
│
├── processed/              # Cleaned/processed data (NOT in git)
│   └── dubi/              # Dubicars processed data
│       ├── extended_dubi_listings.csv         ✅ EXISTS
│       ├── model_counts.csv                   ✅ EXISTS
│       ├── model_counts_comparison.csv        ✅ EXISTS
│       └── model_counts_kaggle.csv            ✅ EXISTS
│
└── models/                 # Trained ML models (NOT in git)
    ├── final_model_uncertainty.cbm            ✅ EXISTS
    └── calibration_info.json                  ✅ EXISTS
```

## Missing Files (Need to be Generated)

Some scripts reference files that don't exist yet because they're OUTPUT files created by running other scripts:

### Dubicars Pipeline:
1. **dubicars_partial_320_pages.csv** (data/raw/dubicars/)
   - Created by: `scraper/websites/scraper_dubicars.py`
   - Used by: `scraper/preprocessing/cleaning.py`

2. **dubicars_cars_clean.csv** (data/processed/)
   - Created by: `scraper/preprocessing/cleaning.py`
   - Used by: `scraper/preprocessing/brand_extract.py`, `dubicars_second_scrape*.py`

### Dubizzle Pipeline:
1. **dubizzile_combined_2.csv** (data/raw/dubuzzile/)
   - This file doesn't exist. Use `dubizzle_combined.csv` instead
   - Or create by splitting/processing existing dubizzle files

## Usage

### To generate missing files:

```bash
# 1. Scrape Dubicars data
cd scraper/websites
python scraper_dubicars.py

# 2. Clean the scraped data
cd ../preprocessing
python cleaning.py

# 3. Extract brand/model information
python brand_extract.py

# 4. Enrich with additional details
python dubicars_second_scrape.py
```

### For Dubizzle data:
```bash
# Use existing dubizzle_combined.csv or run enrichment
cd scraper/.venv/dubizzile
python dubizzile_enrich_2.py
```

## Notes

- All `.csv` files in `raw/` and `processed/` are excluded from git
- Only `.gitkeep` files are tracked to preserve directory structure
- Model files (`.cbm`, `.json`) in `models/` are also excluded
- Keep your local data files backed up separately!
