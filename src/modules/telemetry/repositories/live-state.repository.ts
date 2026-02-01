import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MeterLiveState } from '../entities/meter-live-state.entity';
import { VehicleLiveState } from '../entities/vehicle-live-state.entity';
import { MeterTelemetryDto } from '../dto/meter-telemetry.dto';
import { VehicleTelemetryDto } from '../dto/vehicle-telemetry.dto';

@Injectable()
export class LiveStateRepository {
  constructor(
    @InjectRepository(MeterLiveState)
    private readonly meterStateRepo: Repository<MeterLiveState>,
    @InjectRepository(VehicleLiveState)
    private readonly vehicleStateRepo: Repository<VehicleLiveState>,
  ) {}

  /**
   * UPSERT meter live state
   * Atomic update ensuring dashboard never scans history
   */
  async upsertMeterState(dto: MeterTelemetryDto): Promise<void> {
    await this.meterStateRepo
      .createQueryBuilder()
      .insert()
      .into(MeterLiveState)
      .values({
        meterId: dto.meterId,
        kwhConsumedAc: dto.kwhConsumedAc,
        voltage: dto.voltage,
        lastReportedAt: new Date(dto.timestamp),
        status: 'online',
      })
      .orUpdate(
        ['kwhConsumedAc', 'voltage', 'lastReportedAt', 'status', 'updatedAt'],
        ['meterId'],
      )
      .execute();
  }

  /**
   * UPSERT vehicle live state
   */
  async upsertVehicleState(
    dto: VehicleTelemetryDto,
    meterId?: string,
  ): Promise<void> {
    const chargingStatus = this.determineChargingStatus(dto.soc);

    await this.vehicleStateRepo
      .createQueryBuilder()
      .insert()
      .into(VehicleLiveState)
      .values({
        vehicleId: dto.vehicleId,
        soc: dto.soc,
        kwhDeliveredDc: dto.kwhDeliveredDc,
        batteryTemp: dto.batteryTemp,
        lastReportedAt: new Date(dto.timestamp),
        chargingStatus,
        status: 'online',
        associatedMeterId: meterId,
      })
      .orUpdate(
        [
          'soc',
          'kwhDeliveredDc',
          'batteryTemp',
          'lastReportedAt',
          'chargingStatus',
          'status',
          'associatedMeterId',
          'updatedAt',
        ],
        ['vehicleId'],
      )
      .execute();
  }

  /**
   * Batch UPSERT for meters
   */
  async bulkUpsertMeterStates(records: MeterTelemetryDto[]): Promise<void> {
    if (records.length === 0) return;

    const values = records.map((r) => ({
      meterId: r.meterId,
      kwhConsumedAc: r.kwhConsumedAc,
      voltage: r.voltage,
      lastReportedAt: new Date(r.timestamp),
      status: 'online' as const,
    }));

    await this.meterStateRepo
      .createQueryBuilder()
      .insert()
      .into(MeterLiveState)
      .values(values)
      .orUpdate(
        ['kwhConsumedAc', 'voltage', 'lastReportedAt', 'status', 'updatedAt'],
        ['meterId'],
      )
      .execute();
  }

  /**
   * Batch UPSERT for vehicles
   */
  async bulkUpsertVehicleStates(
    records: VehicleTelemetryDto[],
    meterMap?: Map<string, string>,
  ): Promise<void> {
    if (records.length === 0) return;

    const values = records.map((r) => ({
      vehicleId: r.vehicleId,
      soc: r.soc,
      kwhDeliveredDc: r.kwhDeliveredDc,
      batteryTemp: r.batteryTemp,
      lastReportedAt: new Date(r.timestamp),
      chargingStatus: this.determineChargingStatus(r.soc),
      status: 'online' as const,
      associatedMeterId: meterMap?.get(r.vehicleId) ?? undefined,
    }));

    await this.vehicleStateRepo
      .createQueryBuilder()
      .insert()
      .into(VehicleLiveState)
      .values(values)
      .orUpdate(
        [
          'soc',
          'kwhDeliveredDc',
          'batteryTemp',
          'lastReportedAt',
          'chargingStatus',
          'status',
          'associatedMeterId',
          'updatedAt',
        ],
        ['vehicleId'],
      )
      .execute();
  }

  /**
   * Get current meter state
   */
  async getMeterState(meterId: string): Promise<MeterLiveState | null> {
    return this.meterStateRepo.findOne({ where: { meterId } });
  }

  /**
   * Get current vehicle state
   */
  async getVehicleState(vehicleId: string): Promise<VehicleLiveState | null> {
    return this.vehicleStateRepo.findOne({ where: { vehicleId } });
  }

  /**
   * Get all meters with a specific status
   */
  async getMetersByStatus(status: string): Promise<MeterLiveState[]> {
    return this.meterStateRepo.find({ where: { status: status as any } });
  }

  private determineChargingStatus(
    soc: number,
  ): 'charging' | 'idle' | 'discharging' | 'error' {
    // This would be more sophisticated in production
    // using delta between readings
    if (soc >= 99) return 'idle';
    if (soc < 5) return 'error';
    return 'charging';
  }
}
