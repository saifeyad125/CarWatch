# -----------------------------------
# 6) Uncertainty Threshold Experiment
# -----------------------------------

thresholds = [0.05, 0.10, 0.15, 0.20, 0.25]

results = []

y_true_price = np.exp(y_test)
y_pred_price = np.exp(y_final_log)

for t in thresholds:
    mask = sigma_test_log <= t
    
    kept = mask.sum()
    total = len(mask)
    
    if kept == 0:
        continue
    
    mae = mean_absolute_error(
        y_true_price[mask],
        y_pred_price[mask]
    )
    
    medape = np.median(
        np.abs(
            (y_true_price[mask] - y_pred_price[mask]) / y_true_price[mask]
        )
    ) * 100
    
    results.append({
        "σ_threshold": t,
        "%_shown": kept / total * 100,
        "MAE_AED": mae,
        "MedAPE_%": medape,
        "samples_kept": kept
    })

threshold_df = pd.DataFrame(results)

print("\nUNCERTAINTY THRESHOLD ANALYSIS")
print(threshold_df.to_string(index=False))
