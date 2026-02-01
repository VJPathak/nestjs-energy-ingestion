import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';

import { TelemetryService } from '../services/telemetry.service';
import { TelemetryBatchService } from '../services/telemetry-batch.service';

import { MeterTelemetryDto } from '../dto/meter-telemetry.dto';
import { VehicleTelemetryDto } from '../dto/vehicle-telemetry.dto';
import {
  BulkTelemetryDto,
  BulkIngestionResponseDto,
} from '../dto/bulk-telemetry.dto';

@ApiTags('telemetry')
@Controller('telemetry')
export class TelemetryController {
  constructor(
    private readonly telemetryService: TelemetryService,
    private readonly batchService: TelemetryBatchService,
  ) {}

  @Post('meter')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Ingest meter telemetry' })
  @ApiResponse({
    status: 202,
    description: 'Telemetry accepted for processing',
  })
  @ApiResponse({ status: 400, description: 'Invalid telemetry data' })
  async ingestMeter(@Body() dto: MeterTelemetryDto): Promise<{ status: string }> {
    await this.batchService.queueMeterTelemetry(dto);
    return { status: 'accepted' };
  }

  @Post('vehicle')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Ingest vehicle telemetry' })
  @ApiResponse({
    status: 202,
    description: 'Telemetry accepted for processing',
  })
  @ApiResponse({ status: 400, description: 'Invalid telemetry data' })
  async ingestVehicle(
    @Body() dto: VehicleTelemetryDto,
  ): Promise<{ status: string }> {
    await this.batchService.queueVehicleTelemetry(dto);
    return { status: 'accepted' };
  }

  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk ingest telemetry (recommended for high throughput)' })
  @ApiResponse({
    status: 200,
    description: 'Bulk ingestion complete',
    type: BulkIngestionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid telemetry data' })
  async ingestBulk(
    @Body() dto: BulkTelemetryDto,
  ): Promise<BulkIngestionResponseDto> {
    return this.telemetryService.ingestBulk(dto);
  }

  @Get('meter/:meterId/status')
  @ApiOperation({ summary: 'Get current meter status (live state)' })
  @ApiParam({ name: 'meterId', description: 'Meter identifier' })
  @ApiResponse({ status: 200, description: 'Current meter state' })
  @ApiResponse({ status: 404, description: 'Meter not found' })
  async getMeterStatus(@Param('meterId') meterId: string) {
    return this.telemetryService.getMeterLiveState(meterId);
  }

  @Get('vehicle/:vehicleId/status')
  @ApiOperation({ summary: 'Get current vehicle status (live state)' })
  @ApiParam({ name: 'vehicleId', description: 'Vehicle identifier' })
  @ApiResponse({ status: 200, description: 'Current vehicle state' })
  @ApiResponse({ status: 404, description: 'Vehicle not found' })
  async getVehicleStatus(@Param('vehicleId') vehicleId: string) {
    return this.telemetryService.getVehicleLiveState(vehicleId);
  }

  @Get('queue/status')
  @ApiOperation({ summary: 'Get ingestion queue status' })
  @ApiResponse({ status: 200, description: 'Current queue sizes' })
  getQueueStatus() {
    return this.batchService.getQueueStatus();
  }
}
