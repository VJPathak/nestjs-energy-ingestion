import { Injectable } from '@nestjs/common';

/**
 * Service for calculating power efficiency metrics
 * Handles the physics of AC to DC conversion losses
 */
@Injectable()
export class EfficiencyService {
  /**
   * Calculate power efficiency ratio
   * 
   * In real-world charging:
   * - AC power from grid is always higher than DC power stored
   * - Losses occur due to heat, conversion, and cable resistance
   * - Typical efficiency: 85-95%
   * - Below 85%: Indicates potential hardware fault
   * 
   * @param acConsumed Total AC energy consumed from grid (kWh)
   * @param dcDelivered Total DC energy delivered to battery (kWh)
   * @returns Efficiency percentage (0-100)
   */
  calculateEfficiency(acConsumed: number, dcDelivered: number): number {
    // Handle edge cases
    if (acConsumed <= 0) return 0;
    if (dcDelivered <= 0) return 0;
    if (dcDelivered > acConsumed) {
      // DC can't exceed AC (would violate physics)
      // This indicates a metering error
      return -1; // Signal invalid data
    }

    const efficiency = (dcDelivered / acConsumed) * 100;
    
    // Round to 1 decimal place
    return Math.round(efficiency * 10) / 10;
  }

  /**
   * Analyze efficiency trend over time
   * Useful for detecting degradation
   */
  analyzeEfficiencyTrend(
    readings: Array<{ acConsumed: number; dcDelivered: number; timestamp: Date }>,
  ): {
    trend: 'improving' | 'stable' | 'degrading';
    slope: number;
    avgEfficiency: number;
  } {
    if (readings.length < 2) {
      return {
        trend: 'stable',
        slope: 0,
        avgEfficiency: readings.length === 1 
          ? this.calculateEfficiency(readings[0].acConsumed, readings[0].dcDelivered)
          : 0,
      };
    }

    const efficiencies = readings.map((r) =>
      this.calculateEfficiency(r.acConsumed, r.dcDelivered),
    ).filter((e) => e >= 0); // Filter out invalid readings

    if (efficiencies.length < 2) {
      return { trend: 'stable', slope: 0, avgEfficiency: 0 };
    }

    const avgEfficiency = 
      efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length;

    // Simple linear regression for trend
    const n = efficiencies.length;
    const xMean = (n - 1) / 2;
    const yMean = avgEfficiency;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (efficiencies[i] - yMean);
      denominator += (i - xMean) ** 2;
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;

    let trend: 'improving' | 'stable' | 'degrading';
    if (slope > 0.1) {
      trend = 'improving';
    } else if (slope < -0.1) {
      trend = 'degrading';
    } else {
      trend = 'stable';
    }

    return {
      trend,
      slope: Math.round(slope * 100) / 100,
      avgEfficiency: Math.round(avgEfficiency * 10) / 10,
    };
  }

  /**
   * Estimate power loss
   */
  calculatePowerLoss(acConsumed: number, dcDelivered: number): {
    lossKwh: number;
    lossPercentage: number;
  } {
    const lossKwh = Math.max(0, acConsumed - dcDelivered);
    const lossPercentage = acConsumed > 0 
      ? Math.round((lossKwh / acConsumed) * 1000) / 10 
      : 0;

    return {
      lossKwh: Math.round(lossKwh * 100) / 100,
      lossPercentage,
    };
  }
}
