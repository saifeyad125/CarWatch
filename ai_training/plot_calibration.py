#!/usr/bin/env python3
import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# =============================
# Config
# =============================
CSV_PATH = "ai_training/outputs/test_predictions_with_uncertainty.csv"
OUT_DIR  = "ai_training/outputs/plots"
SAVE_PLOTS = True
VERBOSE = True

# z-scores for common central intervals
Z_BY_CONF = {
    50: 0.674,
    68: 1.0,
    80: 1.282,
    90: 1.645,
    95: 1.96,
}


def compute_coverage(y_true_log, mu_log, sigma_log, z):
    """Percent of points where y_true is within mu ± z*sigma."""
    y_true_log = np.asarray(y_true_log)
    mu_log = np.asarray(mu_log)
    sigma_log = np.asarray(sigma_log)

    valid = np.isfinite(y_true_log) & np.isfinite(mu_log) & np.isfinite(sigma_log) & (sigma_log > 0)
    if valid.sum() == 0:
        return np.nan

    inside = (y_true_log[valid] >= (mu_log[valid] - z * sigma_log[valid])) & \
             (y_true_log[valid] <= (mu_log[valid] + z * sigma_log[valid]))
    return inside.mean() * 100.0


def plot_calibration_from_csv(
    csv_path=CSV_PATH,
    output_dir=OUT_DIR,
    save_plots=SAVE_PLOTS,
    verbose=VERBOSE
):
    # -----------------------------
    # Load CSV
    # -----------------------------
    df = pd.read_csv(csv_path)

    required_cols = [
        "true_log_price",
        "pred_log_price",
        "sigma_log_raw",
        "sigma_log_calibrated",
    ]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns in CSV: {missing}\n"
                         f"Found columns: {list(df.columns)}")

    y_true_log = df["true_log_price"].to_numpy()
    mu_log = df["pred_log_price"].to_numpy()
    sigma_log = df["sigma_log_raw"].to_numpy()
    sigma_calibrated = df["sigma_log_calibrated"].to_numpy()

    # -----------------------------
    # Quick summary
    # -----------------------------
    if verbose:
        print("=" * 60)
        print("Loaded CSV for calibration plots")
        print(f"Path: {csv_path}")
        print(f"Rows: {len(df):,}")
        print(f"Mean σ (before): {np.nanmean(sigma_log):.4f}")
        print(f"Mean σ (after) : {np.nanmean(sigma_calibrated):.4f}")
        print("=" * 60)

    # -----------------------------
    # Compute calibration curve points
    # -----------------------------
    intervals = [50, 68, 80, 90, 95]
    coverage_before = []
    coverage_after = []

    for conf in intervals:
        z = Z_BY_CONF[conf]
        cov_b = compute_coverage(y_true_log, mu_log, sigma_log, z)
        cov_a = compute_coverage(y_true_log, mu_log, sigma_calibrated, z)
        coverage_before.append(cov_b)
        coverage_after.append(cov_a)

    if verbose:
        print("Calibration curve (Expected -> Actual)")
        for conf, cb, ca in zip(intervals, coverage_before, coverage_after):
            print(f"  {conf:>3}% -> before: {cb:6.2f}% | after: {ca:6.2f}%")

    # -----------------------------
    # Plot
    # -----------------------------
    if save_plots:
        os.makedirs(output_dir, exist_ok=True)

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # Plot 1: Uncertainty distribution
    axes[0].hist(sigma_log, bins=50, alpha=0.6, label="Before", edgecolor="black")
    axes[0].hist(sigma_calibrated, bins=50, alpha=0.6, label="After", edgecolor="black")
    axes[0].axvline(np.nanmean(sigma_log), linestyle="--", linewidth=2,
                    label=f"Mean (before): {np.nanmean(sigma_log):.3f}")
    axes[0].axvline(np.nanmean(sigma_calibrated), linestyle="--", linewidth=2,
                    label=f"Mean (after): {np.nanmean(sigma_calibrated):.3f}")
    axes[0].set_xlabel("Uncertainty (σ) in log space", fontsize=11)
    axes[0].set_ylabel("Count", fontsize=11)
    axes[0].set_title("Uncertainty Distribution: Before vs After Calibration",
                      fontsize=12, fontweight="bold")
    axes[0].legend(fontsize=9)
    axes[0].grid(True, alpha=0.3)

    # Plot 2: Calibration curve
    axes[1].plot(intervals, intervals, "k--", label="Perfect calibration", linewidth=2.5, alpha=0.7)
    axes[1].plot(intervals, coverage_before, "o-", label="Before", linewidth=2.5, markersize=8)
    axes[1].plot(intervals, coverage_after, "o-", label="After", linewidth=2.5, markersize=8)
    axes[1].set_xlabel("Expected Coverage (%)", fontsize=11)
    axes[1].set_ylabel("Actual Coverage (%)", fontsize=11)
    axes[1].set_title("Calibration Curve", fontsize=12, fontweight="bold")
    axes[1].legend(fontsize=10, loc="upper left")
    axes[1].grid(True, alpha=0.3)
    axes[1].set_xlim([45, 100])
    axes[1].set_ylim([45, 100])

    # Light "good zone" band around diagonal (±5%)
    x = np.array([45, 100])
    axes[1].fill_between(x, x - 5, x + 5, alpha=0.12, label="±5% zone")

    plt.tight_layout()

    if save_plots:
        plot_path = os.path.join(output_dir, "calibration_comparison.png")
        plt.savefig(plot_path, dpi=150, bbox_inches="tight")
        if verbose:
            print(f"\n✓ Saved calibration plot to: {plot_path}")

    plt.show()

    return {
        "mean_sigma_before": float(np.nanmean(sigma_log)),
        "mean_sigma_after": float(np.nanmean(sigma_calibrated)),
        "coverage_curve": {
            "intervals": intervals,
            "coverage_before": [float(x) if np.isfinite(x) else None for x in coverage_before],
            "coverage_after": [float(x) if np.isfinite(x) else None for x in coverage_after],
        }
    }


if __name__ == "__main__":
    plot_calibration_from_csv()
