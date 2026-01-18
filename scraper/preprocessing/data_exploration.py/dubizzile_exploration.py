from pathlib import Path
import pandas as pd

# -------------------------
# Output path
# ------------------------
# Input path
input_path = Path(
    "/Users/saif/Desktop/University Saif/Y3/dissertion/project/data/raw/dubuzzile/dubizzile_final_raw.csv"
)
output_path = Path(
    "/Users/saif/Desktop/University Saif/Y3/dissertion/project/data/raw/dubuzzile/listings_with_missing_values.csv"
)

df = pd.read_csv(input_path)

# -------------------------
# Filter rows with ANY missing values
# -------------------------
df_missing_type = df[df["type"].isna()].copy()

# -------------------------
# Save to CSV
# -------------------------
df_missing_type.to_csv(output_path, index=False)

# -------------------------
# Quick sanity print
# -------------------------
print(f"Saved {len(df_missing_type)} rows with missing values to:")
print(output_path)
