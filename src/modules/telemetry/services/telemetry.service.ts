import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { MeterTelemetryRepository } from '../repositories/meter-telemetry.repository';
import { VehicleTelemetryRepository } from '../repositories/vehicle-telemetry.repository';
import { LiveStateRepository } from '../repositories/live-state.repository';
import { FleetAssignment } from '../entities/fleet-assignment.entity';

import { MeterTelemetryDto } from '../dto/meter-telemetry.dto';
import { VehicleTelemetryDto } from '../dto/vehicle-telemetry.dto';
import {
  BulkTelemetryDto,
  BulkIngestionResponseDto,
} from '../dto/bulk-telemetry.dto';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(
    private readonly meterRepo: MeterTelemetryRepository,
    private readonly vehicleRepo: VehicleTelemetryRepository,
    private readonly liveStateRepo: LiveStateRepository,
    @InjectRepository(FleetAssignment)
    private readonly assignmentRepo: Repository<FleetAssignment>,
  ) {}

  /**
   * Ingest single meter telemetry
   * Writes to both hot (live state) and cold (history) stores
   */
  async ingestMeterTelemetry(dto: MeterTelemetryDto): Promise<void> {
    const assignment = await this.getAssignmentByMeter(dto.meterId);

    // Parallel writes to both stores
    await Promise.all([
      this.meterRepo.insertHistory(dto, assignment?.fleetId),
      this.liveStateRepo.upsertMeterState(dto),
    ]);

    this.logger.debug(`Ingested meter telemetry: ${dto.meterId}`);
  }

  /**
   * Ingest single vehicle telemetry
   */
  async ingestVehicleTelemetry(dto: VehicleTelemetryDto): Promise<void> {
    const assignment = await this.getAssignmentByVehicle(dto.vehicleId);

    await Promise.all([
      this.vehicleRepo.insertHistory(
        dto,
        assignment?.fleetId,
        assignment?.meterId,
      ),
      this.liveStateRepo.upsertVehicleState(dto, assignment?.meterId),
    ]);

    this.logger.debug(`Ingested vehicle telemetry: ${dto.vehicleId}`);
  }

  /**
   * Bulk ingestion for high throughput scenarios
   * Optimized for processing thousands of records per batch
   */
  async ingestBulk(dto: BulkTelemetryDto): Promise<BulkIngestionResponseDto> {
    const startTime = Date.now();
    const errors: string[] = [];

    let metersProcessed = 0;
    let vehiclesProcessed = 0;

    try {
      // Process meters
      if (dto.meters && dto.meters.length > 0) {
        const meterIds = [...new Set(dto.meters.map((m) => m.meterId))];
        const assignments = await this.getAssignmentsByMeters(meterIds);
        const fleetIdMap = new Map(
          assignments.map((a) => [a.meterId, a.fleetId]),
        );

        await Promise.all([
          this.meterRepo.bulkInsertHistory(dto.meters, fleetIdMap),
          this.liveStateRepo.bulkUpsertMeterStates(dto.meters),
        ]);

        metersProcessed = dto.meters.length;
      }

      // Process vehicles
      if (dto.vehicles && dto.vehicles.length > 0) {
        const vehicleIds = [...new Set(dto.vehicles.map((v) => v.vehicleId))];
        const assignments = await this.getAssignmentsByVehicles(vehicleIds);

        const assignmentMap = new Map(
          assignments.map((a) => [
            a.vehicleId,
            { fleetId: a.fleetId, meterId: a.meterId },
          ]),
        );

        const meterMap = new Map(
          assignments.map((a) => [a.vehicleId, a.meterId]),
        );

        await Promise.all([
          this.vehicleRepo.bulkInsertHistory(dto.vehicles, assignmentMap),
          this.liveStateRepo.bulkUpsertVehicleStates(dto.vehicles, meterMap),
        ]);

        vehiclesProcessed = dto.vehicles.length;
      }
    } catch (error) {
      this.logger.error(`Bulk ingestion error: ${error.message}`, error.stack);
      errors.push(error.message);
    }

    const processingTimeMs = Date.now() - startTime;

    this.logger.log(
      `Bulk ingestion complete: ${metersProcessed} meters, ${vehiclesProcessed} vehicles in ${processingTimeMs}ms`,
    );

    return {
      metersProcessed,
      vehiclesProcessed,
      totalProcessed: metersProcessed + vehiclesProcessed,
      processingTimeMs,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Get live state for a meter
   */
  async getMeterLiveState(meterId: string) {
    return this.liveStateRepo.getMeterState(meterId);
  }

  /**
   * Get live state for a vehicle
   */
  async getVehicleLiveState(vehicleId: string) {
    return this.liveStateRepo.getVehicleState(vehicleId);
  }

  private async getAssignmentByMeter(
    meterId: string,
  ): Promise<FleetAssignment | null> {
    return this.assignmentRepo.findOne({
      where: { meterId, isActive: true },
    });
  }

  private async getAssignmentByVehicle(
    vehicleId: string,
  ): Promise<FleetAssignment | null> {
    return this.assignmentRepo.findOne({
      where: { vehicleId, isActive: true },
    });
  }

  private async getAssignmentsByMeters(
    meterIds: string[],
  ): Promise<FleetAssignment[]> {
    if (meterIds.length === 0) return [];
    
    return this.assignmentRepo
      .createQueryBuilder('fa')
      .where('fa.meterId IN (:...meterIds)', { meterIds })
      .andWhere('fa.isActive = :isActive', { isActive: true })
      .getMany();
  }

  private async getAssignmentsByVehicles(
    vehicleIds: string[],
  ): Promise<FleetAssignment[]> {
    if (vehicleIds.length === 0) return [];

    return this.assignmentRepo
      .createQueryBuilder('fa')
      .where('fa.vehicleId IN (:...vehicleIds)', { vehicleIds })
      .andWhere('fa.isActive = :isActive', { isActive: true })
      .getMany();
  }
}
