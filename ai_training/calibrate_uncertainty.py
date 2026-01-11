"""
Standalone script to calibrate uncertainty estimates from pre-trained model.

Usage:
    python calibrate_uncertainty.py

Requires:
    - test_predictions_with_uncertainty.csv
    - final_model_uncertainty.cbm (optional, for future predictions)
"""

import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import json
from scipy.optimize import minimize_scalar
from scipy.stats import norm


# ========================================
# CALIBRATION FUNCTION
# ========================================

def calibrate_uncertainty(
    mu_log,
    sigma_log,
    y_true_log,
    target_coverage=0.90,
    output_dir="ai_training/outputs",
    save_plots=True,
    verbose=True
):
    """
    Calibrate uncertainty estimates to achieve target coverage.
    
    Parameters:
    -----------
    mu_log : array-like
        Predicted mean values in log space
    sigma_log : array-like
        Predicted uncertainty (standard deviation) in log space
    y_true_log : array-like
        True target values in log space
    target_coverage : float, default=0.90
        Desired coverage probability (e.g., 0.90 for 90% intervals)
    output_dir : str
        Directory to save outputs
    save_plots : bool
        Whether to save visualization plots
    verbose : bool
        Whether to print detailed output
    
    Returns:
    --------
    dict with calibration results
    """
    
    # Convert to numpy arrays
    mu_log = np.asarray(mu_log)
    sigma_log = np.asarray(sigma_log)
    y_true_log = np.asarray(y_true_log)
    
    # Z-score for target coverage
    z_target = norm.ppf(0.5 + target_coverage / 2)
    
    # Measure current coverage
    current_coverage = np.mean(
        (y_true_log >= (mu_log - z_target * sigma_log)) &
        (y_true_log <= (mu_log + z_target * sigma_log))
    )
    
    if verbose:
        print("\n" + "="*60)
        print("UNCERTAINTY CALIBRATION")
        print("="*60)
        print(f"Target coverage: {target_coverage*100:.1f}%")
        print(f"\nBEFORE calibration:")
        print(f"  Actual coverage: {current_coverage*100:.2f}%")
        print(f"  Mean sigma (log): {np.nanmean(sigma_log):.4f}")
        print(f"  Median sigma (log): {np.nanmedian(sigma_log):.4f}")
    
    # Find optimal scaling factor
    def coverage_error(scale):
        coverage = np.mean(
            (y_true_log >= (mu_log - z_target * scale * sigma_log)) &
            (y_true_log <= (mu_log + z_target * scale * sigma_log))
        )
        return abs(coverage - target_coverage)
    
    result = minimize_scalar(
        coverage_error,
        bounds=(0.5, 3.0),
        method='bounded'
    )
    
    calibration_factor = result.x
    sigma_calibrated = sigma_log * calibration_factor
    
    new_coverage = np.mean(
        (y_true_log >= (mu_log - z_target * sigma_calibrated)) &
        (y_true_log <= (mu_log + z_target * sigma_calibrated))
    )
    
    if verbose:
        print(f"\n{'—'*60}")
        print(f"Optimal calibration factor: {calibration_factor:.4f}")
        print(f"{'—'*60}")
        print(f"\nAFTER calibration:")
        print(f"  Actual coverage: {new_coverage*100:.2f}%")
        print(f"  Mean sigma (log): {np.nanmean(sigma_calibrated):.4f}")
        print(f"  Median sigma (log): {np.nanmedian(sigma_calibrated):.4f}")
    
    # Check multiple coverage levels
    coverage_levels = {
        '50%': (0.50, 0.674),
        '68%': (0.68, 1.000),
        '80%': (0.80, 1.282),
        '90%': (0.90, 1.645),
        '95%': (0.95, 1.960)
    }
    
    coverage_by_level = {}
    
    if verbose:
        print(f"\n{'—'*60}")
        print("Coverage at different confidence levels:")
    
    for level_name, (conf, z_score) in coverage_levels.items():
        cov = np.mean(
            (y_true_log >= (mu_log - z_score * sigma_calibrated)) &
            (y_true_log <= (mu_log + z_score * sigma_calibrated))
        ) * 100
        coverage_by_level[level_name] = cov
        
        if verbose:
            print(f"  {level_name} interval: {cov:>6.2f}% actual coverage")
    
    if verbose:
        print("="*60 + "\n")
    
    # Save calibration info
    os.makedirs(output_dir, exist_ok=True)
    
    calibration_info = {
        'calibration_factor': float(calibration_factor),
        'target_coverage': float(target_coverage),
        'coverage_before_pct': float(current_coverage * 100),
        'coverage_after_pct': float(new_coverage * 100),
        'mean_sigma_before': float(np.nanmean(sigma_log)),
        'mean_sigma_after': float(np.nanmean(sigma_calibrated)),
        'median_sigma_before': float(np.nanmedian(sigma_log)),
        'median_sigma_after': float(np.nanmedian(sigma_calibrated)),
        'coverage_by_level': coverage_by_level
    }
    
    json_path = os.path.join(output_dir, "calibration_factor.json")
    with open(json_path, 'w') as f:
        json.dump(calibration_info, f, indent=2)
    
    if verbose:
        print(f"✓ Saved calibration info to: {json_path}")
    
    # Create visualization
    if save_plots:
        fig, axes = plt.subplots(1, 2, figsize=(14, 5))
        
        # Plot 1: Uncertainty distribution
        axes[0].hist(sigma_log, bins=50, alpha=0.6, label='Before', color='#e74c3c', edgecolor='black')
        axes[0].hist(sigma_calibrated, bins=50, alpha=0.6, label='After', color='#2ecc71', edgecolor='black')
        axes[0].axvline(np.nanmean(sigma_log), color='#c0392b', linestyle='--', linewidth=2, label=f'Mean (before): {np.nanmean(sigma_log):.3f}')
        axes[0].axvline(np.nanmean(sigma_calibrated), color='#27ae60', linestyle='--', linewidth=2, label=f'Mean (after): {np.nanmean(sigma_calibrated):.3f}')
        axes[0].set_xlabel('Uncertainty (σ) in log space', fontsize=11)
        axes[0].set_ylabel('Count', fontsize=11)
        axes[0].set_title('Uncertainty Distribution: Before vs After Calibration', fontsize=12, fontweight='bold')
        axes[0].legend(fontsize=9)
        axes[0].grid(True, alpha=0.3)
        
        # Plot 2: Calibration curve
        intervals = [50, 68, 80, 90, 95]
        coverage_before = []
        coverage_after = []
        
        for conf in intervals:
            z = {50: 0.674, 68: 1.0, 80: 1.282, 90: 1.645, 95: 1.96}[conf]
            
            cov_before = np.mean(
                (y_true_log >= (mu_log - z * sigma_log)) &
                (y_true_log <= (mu_log + z * sigma_log))
            ) * 100
            coverage_before.append(cov_before)
            
            cov_after = np.mean(
                (y_true_log >= (mu_log - z * sigma_calibrated)) &
                (y_true_log <= (mu_log + z * sigma_calibrated))
            ) * 100
            coverage_after.append(cov_after)
        
        axes[1].plot(intervals, intervals, 'k--', label='Perfect calibration', linewidth=2.5, alpha=0.7)
        axes[1].plot(intervals, coverage_before, 'o-', color='#e74c3c', label='Before', linewidth=2.5, markersize=8)
        axes[1].plot(intervals, coverage_after, 'o-', color='#2ecc71', label='After', linewidth=2.5, markersize=8)
        axes[1].set_xlabel('Expected Coverage (%)', fontsize=11)
        axes[1].set_ylabel('Actual Coverage (%)', fontsize=11)
        axes[1].set_title('Calibration Curve', fontsize=12, fontweight='bold')
        axes[1].legend(fontsize=10, loc='upper left')
        axes[1].grid(True, alpha=0.3)
        axes[1].set_xlim([45, 100])
        axes[1].set_ylim([45, 100])
        
        # Add diagonal reference lines
        axes[1].fill_between([45, 100], [45, 100], [50, 105], alpha=0.1, color='green', label='Good calibration zone')
        
        plt.tight_layout()
        plot_path = os.path.join(output_dir, "calibration_comparison.png")
        plt.savefig(plot_path, dpi=150, bbox_inches='tight')
        
        if verbose:
            print(f"✓ Saved calibration plot to: {plot_path}")
        
        plt.show()
    
    return {
        'calibration_factor': calibration_factor,
        'sigma_calibrated': sigma_calibrated,
        'coverage_before': current_coverage * 100,
        'coverage_after': new_coverage * 100,
        'coverage_by_level': coverage_by_level,
        'mean_sigma_before': np.nanmean(sigma_log),
        'mean_sigma_after': np.nanmean(sigma_calibrated)
    }


# ========================================
# MAIN SCRIPT
# ========================================

if __name__ == "__main__":
    
    print("\n" + "🔧 " * 30)
    print("UNCERTAINTY CALIBRATION SCRIPT")
    print("🔧 " * 30 + "\n")
    
    # Paths
    csv_path = "ai_training/outputs/test_predictions_with_uncertainty.csv"
    output_dir = "ai_training/outputs"
    
    # Check if file exists
    if not os.path.exists(csv_path):
        print(f"❌ ERROR: File not found: {csv_path}")
        print("Please ensure test_predictions_with_uncertainty.csv exists.")
        exit(1)
    
    print(f"📂 Loading predictions from: {csv_path}")
    
    # Load the CSV
    df = pd.read_csv(csv_path)
    
    print(f"✓ Loaded {len(df):,} predictions")
    print(f"✓ Columns found: {', '.join(df.columns[:5])}...")
    
    # Extract required columns
    y_true_log = df['true_log_price'].values
    mu_log = df['pred_log_price'].values
    sigma_log = df['sigma_log'].values
    
    # Run calibration
    cal_result = calibrate_uncertainty(
        mu_log=mu_log,
        sigma_log=sigma_log,
        y_true_log=y_true_log,
        target_coverage=0.90,
        output_dir=output_dir,
        save_plots=True,
        verbose=True
    )
    
    # Get calibrated values
    sigma_calibrated = cal_result['sigma_calibrated']
    calibration_factor = cal_result['calibration_factor']
    
    # Recalculate price intervals with calibrated uncertainty
    print("📊 Recalculating price intervals with calibrated uncertainty...")
    
    z90 = 1.645
    z68 = 1.000
    
    df['sigma_log_calibrated'] = sigma_calibrated
    df['pred_low_90_calibrated'] = np.exp(mu_log - z90 * sigma_calibrated)
    df['pred_high_90_calibrated'] = np.exp(mu_log + z90 * sigma_calibrated)
    df['pred_low_68_calibrated'] = np.exp(mu_log - z68 * sigma_calibrated)
    df['pred_high_68_calibrated'] = np.exp(mu_log + z68 * sigma_calibrated)
    df['interval_width_90_calibrated'] = df['pred_high_90_calibrated'] - df['pred_low_90_calibrated']
    
    # Save updated CSV
    output_csv = os.path.join(output_dir, "test_predictions_calibrated.csv")
    df.to_csv(output_csv, index=False)
    print(f"✓ Saved calibrated predictions to: {output_csv}")
    
    # Display examples
    print("\n" + "="*60)
    print("SAMPLE PREDICTIONS (with calibrated intervals)")
    print("="*60)
    
    examples = df[['true_price', 'pred_price', 'pred_low_90_calibrated', 
                   'pred_high_90_calibrated', 'sigma_log_calibrated']].copy()
    examples.columns = ['True Price', 'Pred Price', 'Low 90%', 'High 90%', 'Sigma (log)']
    
    # Most uncertain
    print("\n🔴 Most UNCERTAIN predictions (top 5):")
    print(examples.nlargest(5, 'Sigma (log)').to_string(index=False, float_format=lambda x: f'{x:,.0f}' if x > 1 else f'{x:.3f}'))
    
    # Most confident
    print("\n🟢 Most CONFIDENT predictions (top 5):")
    print(examples.nsmallest(5, 'Sigma (log)').to_string(index=False, float_format=lambda x: f'{x:,.0f}' if x > 1 else f'{x:.3f}'))
    
    print("\n" + "="*60)
    print(f"🎯 CALIBRATION COMPLETE!")
    print("="*60)
    print(f"\n📌 IMPORTANT: In production, multiply all sigma values by: {calibration_factor:.4f}")
    print(f"   Example: sigma_calibrated = sigma_raw * {calibration_factor:.4f}")
    print("\n" + "✅ " * 30 + "\n")