import pandas as pd

df = pd.read_csv("/Users/saif/Downloads/uae_used_cars_10k.csv")


grouped = (
    df
    .groupby(["Make", "Model"])
    .size()
    .reset_index(name="count")
    .sort_values("count", ascending=False)
)

grouped.to_csv(
    "data/processed/dubi/model_counts_kaggle.csv",
    index=False
)
