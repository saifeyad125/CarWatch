import pandas as pd
import numpy as np

# 1. Load your dataset
# Replace 'your_data.csv' with your actual file name
input_file = '/Users/saif/Desktop/University Saif/Y3/dissertion/project/ai_training/datasets/test.csv' 
df = pd.read_csv(input_file)

# 2. Reverse the transformation
# np.expm1 is the exact inverse of np.log1p
if 'log_price' in df.columns:
    print("Reversing log1p transformation...")
    df['price_aed'] = np.expm1(df['log_price'])
    
    # 3. Remove the log column to keep the data 'clean' for the next approach
    df = df.drop(columns=['log_price'])
    
    # Round to 2 decimal places (standard for currency)
    df['price_aed'] = df['price_aed'].round(2)
    
    # 4. Save to a new CSV
    output_file = '/Users/saif/Desktop/University Saif/Y3/dissertion/project/ai_training/datasets/test_raw_price.csv'
    df.to_csv(output_file, index=False)
    
    print(f"Done! Created '{output_file}' with original prices.")
    print(df[['price_aed']].head())
else:
    print("Error: 'log_price' column not found in the CSV.")