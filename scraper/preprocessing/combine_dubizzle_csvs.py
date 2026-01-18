import pandas as pd
from pathlib import Path

# ---- Paths ----
INPUT_DIR = Path("/Users/saif/Desktop/University Saif/Y3/dissertion/project/data/raw/dubuzzile")
OUTPUT_CSV = Path("/Users/saif/Desktop/University Saif/Y3/dissertion/project/data/raw/dubizzle_combined.csv")

def combine_csv_files():
    print(f"[+] Combining CSV files from part 1 to 72...")
    
    all_data = []
    
    # Define the column names
    columns = ['brand', 'model', 'type', 'price_aed', 'year', 'kms', 'url']
    
    for i in range(1, 73):  # Part 1 to 72
        file_path = INPUT_DIR / f"dubizzle_used_cars_part_{i}.csv"
        
        if file_path.exists():
            print(f"[{i}/72] Reading: {file_path.name}")
            
            # Read first file with header, rest without header
            if i == 1:
                df = pd.read_csv(file_path)
            else:
                df = pd.read_csv(file_path, header=None, names=columns)
            
            all_data.append(df)
            print(f"         Rows: {len(df)}")
        else:
            print(f"[{i}/72] NOT FOUND: {file_path.name}")
    
    print(f"\n[+] Concatenating {len(all_data)} files...")
    combined_df = pd.concat(all_data, ignore_index=True)
    
    print(f"[+] Total rows: {len(combined_df)}")
    
    # Save combined CSV
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    combined_df.to_csv(OUTPUT_CSV, index=False)
    print(f"\n[✓] Combined CSV saved to: {OUTPUT_CSV}")
    print(f"[✓] Final row count: {len(combined_df)}")
    print(f"[✓] Unique brands: {combined_df['brand'].nunique()}")


if __name__ == "__main__":
    combine_csv_files()
