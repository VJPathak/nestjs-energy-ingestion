import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelemetryService } from './telemetry.service';
import { MeterTelemetryDto } from '../dto/meter-telemetry.dto';
import { VehicleTelemetryDto } from '../dto/vehicle-telemetry.dto';

/**
 * Batch processing service for high-throughput telemetry ingestion
 * Buffers incoming records and flushes periodically for optimal DB performance
 */
@Injectable()
export class TelemetryBatchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemetryBatchService.name);

  private meterBuffer: MeterTelemetryDto[] = [];
  private vehicleBuffer: VehicleTelemetryDto[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;

  private readonly batchSize: number;
  private readonly batchIntervalMs: number;
  private readonly maxQueueSize: number;

  constructor(
    private readonly telemetryService: TelemetryService,
    private readonly configService: ConfigService,
  ) {
    this.batchSize = this.configService.get<number>('app.batchSize', 1000);
    this.batchIntervalMs = this.configService.get<number>(
      'app.batchIntervalMs',
      5000,
    );
    this.maxQueueSize = this.configService.get<number>(
      'app.maxQueueSize',
      50000,
    );
  }

  onModuleInit() {
    this.startFlushTimer();
    this.logger.log(
      `Batch service initialized: size=${this.batchSize}, interval=${this.batchIntervalMs}ms`,
    );
  }

  onModuleDestroy() {
    this.stopFlushTimer();
    // Final flush on shutdown
    this.flush();
  }

  /**
   * Queue meter telemetry for batch processing
   */
  async queueMeterTelemetry(dto: MeterTelemetryDto): Promise<void> {
    if (this.meterBuffer.length >= this.maxQueueSize) {
      this.logger.warn('Meter buffer full, triggering immediate flush');
      await this.flush();
    }

    this.meterBuffer.push(dto);

    if (this.meterBuffer.length >= this.batchSize) {
      await this.flushMeters();
    }
  }

  /**
   * Queue vehicle telemetry for batch processing
   */
  async queueVehicleTelemetry(dto: VehicleTelemetryDto): Promise<void> {
    if (this.vehicleBuffer.length >= this.maxQueueSize) {
      this.logger.warn('Vehicle buffer full, triggering immediate flush');
      await this.flush();
    }

    this.vehicleBuffer.push(dto);

    if (this.vehicleBuffer.length >= this.batchSize) {
      await this.flushVehicles();
    }
  }

  /**
   * Get current queue sizes for monitoring
   */
  getQueueStatus(): { meterQueueSize: number; vehicleQueueSize: number } {
    return {
      meterQueueSize: this.meterBuffer.length,
      vehicleQueueSize: this.vehicleBuffer.length,
    };
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        this.logger.error(`Periodic flush failed: ${err.message}`);
      });
    }, this.batchIntervalMs);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private async flush(): Promise<void> {
    if (this.isProcessing) {
      this.logger.debug('Flush already in progress, skipping');
      return;
    }

    this.isProcessing = true;

    try {
      await Promise.all([this.flushMeters(), this.flushVehicles()]);
    } finally {
      this.isProcessing = false;
    }
  }

  private async flushMeters(): Promise<void> {
    if (this.meterBuffer.length === 0) return;

    const batch = this.meterBuffer.splice(0, this.batchSize);
    const startTime = Date.now();

    try {
      await this.telemetryService.ingestBulk({
        meters: batch,
        vehicles: [],
      });

      this.logger.debug(
        `Flushed ${batch.length} meters in ${Date.now() - startTime}ms`,
      );
    } catch (error) {
      // Re-queue failed records (in production, use dead-letter queue)
      this.meterBuffer.unshift(...batch);
      this.logger.error(`Meter flush failed: ${(error as Error).message}`);
      throw error;
    }
  }

  private async flushVehicles(): Promise<void> {
    if (this.vehicleBuffer.length === 0) return;

    const batch = this.vehicleBuffer.splice(0, this.batchSize);
    const startTime = Date.now();

    try {
      await this.telemetryService.ingestBulk({
        meters: [],
        vehicles: batch,
      });

      this.logger.debug(
        `Flushed ${batch.length} vehicles in ${Date.now() - startTime}ms`,
      );
    } catch (error) {
      this.vehicleBuffer.unshift(...batch);
      this.logger.error(`Vehicle flush failed: ${(error as Error).message}`);
      throw error;
    }
  }
}
