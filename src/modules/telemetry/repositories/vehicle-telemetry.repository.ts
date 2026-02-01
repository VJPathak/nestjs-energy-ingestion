import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VehicleTelemetryHistory } from '../entities/vehicle-telemetry-history.entity';
import { VehicleTelemetryDto } from '../dto/vehicle-telemetry.dto';

@Injectable()
export class VehicleTelemetryRepository {
  constructor(
    @InjectRepository(VehicleTelemetryHistory)
    private readonly repository: Repository<VehicleTelemetryHistory>,
  ) {}

  /**
   * Append-only INSERT for historical data
   */
  async insertHistory(
    dto: VehicleTelemetryDto,
    fleetId?: string,
    meterId?: string,
  ): Promise<VehicleTelemetryHistory> {
    const entity = this.repository.create({
      vehicleId: dto.vehicleId,
      soc: dto.soc,
      kwhDeliveredDc: dto.kwhDeliveredDc,
      batteryTemp: dto.batteryTemp,
      timestamp: new Date(dto.timestamp),
      fleetId,
      meterId,
    });

    return this.repository.save(entity);
  }

  /**
   * Batch insert for high throughput
   */
  async bulkInsertHistory(
    records: VehicleTelemetryDto[],
    assignmentMap?: Map<string, { fleetId: string; meterId: string }>,
  ): Promise<number> {
    if (records.length === 0) return 0;

    const values = records.map((r) => {
      const assignment = assignmentMap?.get(r.vehicleId);
      return {
        vehicleId: r.vehicleId,
        soc: r.soc,
        kwhDeliveredDc: r.kwhDeliveredDc,
        batteryTemp: r.batteryTemp,
        timestamp: new Date(r.timestamp),
        fleetId: assignment?.fleetId ?? undefined,
        meterId: assignment?.meterId ?? undefined,
      };
    });

    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .into(VehicleTelemetryHistory)
      .values(values)
      .execute();

    return result.identifiers.length;
  }

  /**
   * Get historical readings for a vehicle within a time range
   */
  async getHistoryByVehicleAndTimeRange(
    vehicleId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<VehicleTelemetryHistory[]> {
    return this.repository
      .createQueryBuilder('vth')
      .where('vth.vehicleId = :vehicleId', { vehicleId })
      .andWhere('vth.timestamp >= :startTime', { startTime })
      .andWhere('vth.timestamp < :endTime', { endTime })
      .orderBy('vth.timestamp', 'ASC')
      .getMany();
  }

  /**
   * Aggregated query for analytics
   */
  async getAggregatedByTimeRange(
    vehicleId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<{
    totalKwhDeliveredDc: number;
    avgBatteryTemp: number;
    peakBatteryTemp: number;
    readings: number;
    minSoc: number;
    maxSoc: number;
  }> {
    const result = await this.repository
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
   * Get associated meter for a vehicle to calculate efficiency
   */
  async getAssociatedMeter(vehicleId: string): Promise<string | null> {
    const latest = await this.repository.findOne({
      where: { vehicleId },
      order: { timestamp: 'DESC' },
      select: ['meterId'],
    });

    return latest?.meterId || null;
  }
}
