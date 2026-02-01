import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MeterTelemetryHistory } from '../entities/meter-telemetry-history.entity';
import { MeterTelemetryDto } from '../dto/meter-telemetry.dto';

@Injectable()
export class MeterTelemetryRepository {
  constructor(
    @InjectRepository(MeterTelemetryHistory)
    private readonly repository: Repository<MeterTelemetryHistory>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Append-only INSERT for historical data
   * Optimized for batch inserts
   */
  async insertHistory(dto: MeterTelemetryDto, fleetId?: string): Promise<MeterTelemetryHistory> {
    const entity = this.repository.create({
      meterId: dto.meterId,
      kwhConsumedAc: dto.kwhConsumedAc,
      voltage: dto.voltage,
      timestamp: new Date(dto.timestamp),
      fleetId,
    });

    return this.repository.save(entity);
  }

  /**
   * Batch insert for high throughput
   * Uses raw query for maximum performance
   */
  async bulkInsertHistory(
    records: MeterTelemetryDto[],
    fleetIdMap?: Map<string, string>,
  ): Promise<number> {
    if (records.length === 0) return 0;

    const values = records.map((r) => ({
      meterId: r.meterId,
      kwhConsumedAc: r.kwhConsumedAc,
      voltage: r.voltage,
      timestamp: new Date(r.timestamp),
      fleetId: fleetIdMap?.get(r.meterId) ?? undefined,
    }));

    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .into(MeterTelemetryHistory)
      .values(values)
      .execute();

    return result.identifiers.length;
  }

  /**
   * Get historical readings for a meter within a time range
   * Uses index on (meterId, timestamp)
   */
  async getHistoryByMeterAndTimeRange(
    meterId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<MeterTelemetryHistory[]> {
    return this.repository
      .createQueryBuilder('mth')
      .where('mth.meterId = :meterId', { meterId })
      .andWhere('mth.timestamp >= :startTime', { startTime })
      .andWhere('mth.timestamp < :endTime', { endTime })
      .orderBy('mth.timestamp', 'ASC')
      .getMany();
  }

  /**
   * Aggregated query for analytics
   * Avoids full table scan using time-based partitioning
   */
  async getAggregatedByTimeRange(
    meterId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<{
    totalKwhConsumedAc: number;
    avgVoltage: number;
    readings: number;
  }> {
    const result = await this.repository
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
}
