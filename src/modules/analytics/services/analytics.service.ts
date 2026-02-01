import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import { MeterTelemetryHistory } from '../../telemetry/entities/meter-telemetry-history.entity';
import { VehicleTelemetryHistory } from '../../telemetry/entities/vehicle-telemetry-history.entity';
import { FleetAssignment } from '../../telemetry/entities/fleet-assignment.entity';

import { EfficiencyService } from './efficiency.service';
import {
  VehiclePerformanceResponseDto,
  AlertDto,
} from '../dto/vehicle-performance.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly efficiencyThreshold: number;
  private readonly batteryTempWarning: number;
  private readonly batteryTempCritical: number;

  constructor(
    @InjectRepository(MeterTelemetryHistory)
    private readonly meterHistoryRepo: Repository<MeterTelemetryHistory>,
    @InjectRepository(VehicleTelemetryHistory)
    private readonly vehicleHistoryRepo: Repository<VehicleTelemetryHistory>,
    @InjectRepository(FleetAssignment)
    private readonly assignmentRepo: Repository<FleetAssignment>,
    private readonly efficiencyService: EfficiencyService,
    private readonly configService: ConfigService,
  ) {
    this.efficiencyThreshold = this.configService.get<number>(
      'app.efficiencyThreshold',
      85,
    );
    this.batteryTempWarning = this.configService.get<number>(
      'app.batteryTempWarning',
      45,
    );
    this.batteryTempCritical = this.configService.get<number>(
      'app.batteryTempCritical',
      55,
    );
  }

  /**
   * Get 24-hour performance summary for a vehicle
   * Optimized query using indexed columns and avoiding full table scans
   */
  async getVehiclePerformance(
    vehicleId: string,
  ): Promise<VehiclePerformanceResponseDto> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

    // Get vehicle's associated meter
    const assignment = await this.assignmentRepo.findOne({
      where: { vehicleId, isActive: true },
    });

    if (!assignment) {
      throw new NotFoundException(
        `No active assignment found for vehicle ${vehicleId}`,
      );
    }

    const meterId = assignment.meterId;

    // Parallel queries for meter and vehicle aggregates
    // Uses composite indexes (vehicleId/meterId, timestamp)
    const [vehicleAgg, meterAgg, chargingSessions] = await Promise.all([
      this.getVehicleAggregates(vehicleId, startTime, endTime),
      this.getMeterAggregates(meterId, startTime, endTime),
      this.countChargingSessions(vehicleId, startTime, endTime),
    ]);

    // Calculate efficiency
    const efficiencyRatio = this.efficiencyService.calculateEfficiency(
      meterAgg.totalKwhConsumedAc,
      vehicleAgg.totalKwhDeliveredDc,
    );

    // Generate alerts
    const alerts = this.generateAlerts(
      efficiencyRatio,
      vehicleAgg.avgBatteryTemp,
      vehicleAgg.peakBatteryTemp,
    );

    return {
      vehicleId,
      meterId,
      period: {
        start: startTime.toISOString(),
        end: endTime.toISOString(),
      },
      metrics: {
        totalAcConsumed: meterAgg.totalKwhConsumedAc,
        totalDcDelivered: vehicleAgg.totalKwhDeliveredDc,
        efficiencyRatio,
        avgBatteryTemp: vehicleAgg.avgBatteryTemp,
        peakBatteryTemp: vehicleAgg.peakBatteryTemp,
        chargingSessions,
        minSoc: vehicleAgg.minSoc,
        maxSoc: vehicleAgg.maxSoc,
        avgVoltage: meterAgg.avgVoltage,
      },
      alerts,
    };
  }

  /**
   * Aggregated vehicle metrics using indexed query
   * Index on (vehicleId, timestamp) enables efficient range scan
   */
  private async getVehicleAggregates(
    vehicleId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<{
    totalKwhDeliveredDc: number;
    avgBatteryTemp: number;
    peakBatteryTemp: number;
    minSoc: number;
    maxSoc: number;
    readings: number;
  }> {
    const result = await this.vehicleHistoryRepo
      .createQueryBuilder('vth')
      .select('SUM(vth.kwhDeliveredDc)', 'totalKwhDeliveredDc')
      .addSelect('AVG(vth.batteryTemp)', 'avgBatteryTemp')
      .addSelect('MAX(vth.batteryTemp)', 'peakBatteryTemp')
      .addSelect('MIN(vth.soc)', 'minSoc')
      .addSelect('MAX(vth.soc)', 'maxSoc')
      .addSelect('COUNT(*)', 'readings')
      .where('vth.vehicleId = :vehicleId', { vehicleId })
      .andWhere('vth.timestamp >= :startTime', { startTime })
      .andWhere('vth.timestamp < :endTime', { endTime })
      .getRawOne();

    return {
      totalKwhDeliveredDc: parseFloat(result.totalKwhDeliveredDc) || 0,
      avgBatteryTemp: parseFloat(result.avgBatteryTemp) || 0,
      peakBatteryTemp: parseFloat(result.peakBatteryTemp) || 0,
      minSoc: parseFloat(result.minSoc) || 0,
      maxSoc: parseFloat(result.maxSoc) || 0,
      readings: parseInt(result.readings) || 0,
    };
  }

  /**
   * Aggregated meter metrics using indexed query
   */
  private async getMeterAggregates(
    meterId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<{
    totalKwhConsumedAc: number;
    avgVoltage: number;
    readings: number;
  }> {
    const result = await this.meterHistoryRepo
      .createQueryBuilder('mth')
      .select('SUM(mth.kwhConsumedAc)', 'totalKwhConsumedAc')
      .addSelect('AVG(mth.voltage)', 'avgVoltage')
      .addSelect('COUNT(*)', 'readings')
      .where('mth.meterId = :meterId', { meterId })
      .andWhere('mth.timestamp >= :startTime', { startTime })
      .andWhere('mth.timestamp < :endTime', { endTime })
      .getRawOne();

    return {
      totalKwhConsumedAc: parseFloat(result.totalKwhConsumedAc) || 0,
      avgVoltage: parseFloat(result.avgVoltage) || 0,
      readings: parseInt(result.readings) || 0,
    };
  }

  /**
   * Count distinct charging sessions
   * A session is detected when SoC increases significantly between readings
   */
  private async countChargingSessions(
    vehicleId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<number> {
    // Using window function to detect charging start events
    const result = await this.vehicleHistoryRepo.query(
      `
      WITH soc_changes AS (
        SELECT 
          timestamp,
          soc,
          LAG(soc) OVER (ORDER BY timestamp) as prev_soc
        FROM vehicle_telemetry_history
        WHERE vehicle_id = $1
          AND timestamp >= $2
          AND timestamp < $3
      )
      SELECT COUNT(*) as sessions
      FROM soc_changes
      WHERE soc > prev_soc + 5
    `,
      [vehicleId, startTime, endTime],
    );

    return parseInt(result[0]?.sessions) || 0;
  }

  private generateAlerts(
    efficiency: number,
    avgTemp: number,
    peakTemp: number,
  ): AlertDto[] {
    const alerts: AlertDto[] = [];

    // Efficiency alert
    if (efficiency > 0 && efficiency < this.efficiencyThreshold) {
      alerts.push({
        type: 'LOW_EFFICIENCY',
        severity: efficiency < 75 ? 'critical' : 'warning',
        message: `Power efficiency (${efficiency.toFixed(1)}%) is below the ${this.efficiencyThreshold}% threshold. This may indicate hardware faults or energy leakage.`,
        threshold: this.efficiencyThreshold,
        actualValue: efficiency,
      });
    }

    // Temperature alerts
    if (peakTemp >= this.batteryTempCritical) {
      alerts.push({
        type: 'CRITICAL_BATTERY_TEMP',
        severity: 'critical',
        message: `Peak battery temperature (${peakTemp.toFixed(1)}°C) exceeded critical threshold. Immediate inspection required.`,
        threshold: this.batteryTempCritical,
        actualValue: peakTemp,
      });
    } else if (avgTemp >= this.batteryTempWarning) {
      alerts.push({
        type: 'HIGH_BATTERY_TEMP',
        severity: 'warning',
        message: `Average battery temperature (${avgTemp.toFixed(1)}°C) is elevated. Monitor cooling system.`,
        threshold: this.batteryTempWarning,
        actualValue: avgTemp,
      });
    }

    return alerts;
  }
}
