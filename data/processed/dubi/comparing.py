import pandas as pd
from pathlib import Path

# File paths
file1 = Path("/Users/saif/Desktop/University Saif/Y3/dissertion/project/data/processed/dubi/model_counts.csv")
file2 = Path("/Users/saif/Desktop/University Saif/Y3/dissertion/project/data/processed/dubi/model_counts_kaggle.csv")

# Read the CSV files
print("[+] Reading CSV files...")
df1 = pd.read_csv(file1)
df2 = pd.read_csv(file2)

print(f"[+] File 1: {file1.name}")
print(f"    Rows: {len(df1)}")
print(f"    Columns: {list(df1.columns)}")

print(f"\n[+] File 2: {file2.name}")
print(f"    Rows: {len(df2)}")
print(f"    Columns: {list(df2.columns)}")

# Group by make and sum the counts (since each row is make+model)
df1_grouped = df1.groupby('make_detail')['count'].sum().reset_index()
df1_grouped.columns = ['make', 'count_file1']

df2_grouped = df2.groupby('Make')['count'].sum().reset_index()
df2_grouped.columns = ['make', 'count_file2']

# Merge the dataframes on 'make'
comparison = pd.merge(
    df1_grouped,
    df2_grouped,
    on='make',
    how='outer',
    suffixes=('_file1', '_file2')
)

# Fill NaN values with 0 for better comparison
comparison['count_file1'] = comparison['count_file1'].fillna(0).astype(int)
comparison['count_file2'] = comparison['count_file2'].fillna(0).astype(int)

# Calculate difference
comparison['difference'] = comparison['count_file1'] - comparison['count_file2']

# Sort by file1 count descending
comparison = comparison.sort_values('count_file1', ascending=False)

# Display results
print("\n" + "="*80)
print("COMPARISON: Model Counts")
print("="*80)
print(f"\n{'Make':<20} {'File 1 (model_counts)':<25} {'File 2 (kaggle)':<25} {'Difference':<15}")
print("-"*80)

for _, row in comparison.iterrows():
    make = row['make']
    count1 = int(row['count_file1'])
    count2 = int(row['count_file2'])
    diff = int(row['difference'])
    
    # Color code the difference (just using symbols here)
    if diff > 0:
        diff_str = f"+{diff}"
    elif diff < 0:
        diff_str = f"{diff}"
    else:
        diff_str = "0"
    
    print(f"{make:<20} {count1:<25} {count2:<25} {diff_str:<15}")

# Summary statistics
print("\n" + "="*80)
print("SUMMARY")
print("="*80)
print(f"Total unique makes in File 1: {len(df1_grouped)}")
print(f"Total unique makes in File 2: {len(df2_grouped)}")
print(f"Total unique makes (combined): {len(comparison)}")
print(f"Total model entries in File 1: {len(df1)} (unique make-model combinations)")
print(f"Total model entries in File 2: {len(df2)} (unique make-model combinations)")
print(f"Total listings in File 1: {comparison['count_file1'].sum()}")
print(f"Total listings in File 2: {comparison['count_file2'].sum()}")
print(f"Difference: {comparison['difference'].sum()}")

# Show which file has more models per make
file1_better = len(comparison[comparison['count_file1'] > comparison['count_file2']])
file2_better = len(comparison[comparison['count_file2'] > comparison['count_file1']])
equal = len(comparison[comparison['count_file1'] == comparison['count_file2']])

print(f"\nMakes where File 1 has more models: {file1_better}")
print(f"Makes where File 2 has more models: {file2_better}")
print(f"Makes with equal models: {equal}")

# Save comparison to CSV
output_path = Path("/Users/saif/Desktop/University Saif/Y3/dissertion/project/data/processed/dubi/model_counts_comparison.csv")
comparison.to_csv(output_path, index=False)
print(f"\n[+] Comparison saved to: {output_path}")
