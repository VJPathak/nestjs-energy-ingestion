import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  ValidateNested,
  ArrayMaxSize,
  IsOptional,
} from 'class-validator';
import { MeterTelemetryDto } from './meter-telemetry.dto';
import { VehicleTelemetryDto } from './vehicle-telemetry.dto';

export class BulkTelemetryDto {
  @ApiPropertyOptional({
    description: 'Array of meter telemetry readings',
    type: [MeterTelemetryDto],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @ArrayMaxSize(10000)
  @Type(() => MeterTelemetryDto)
  meters?: MeterTelemetryDto[];

  @ApiPropertyOptional({
    description: 'Array of vehicle telemetry readings',
    type: [VehicleTelemetryDto],
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @ArrayMaxSize(10000)
  @Type(() => VehicleTelemetryDto)
  vehicles?: VehicleTelemetryDto[];
}

export class BulkIngestionResponseDto {
  @ApiProperty({ description: 'Number of meter records processed' })
  metersProcessed: number;

  @ApiProperty({ description: 'Number of vehicle records processed' })
  vehiclesProcessed: number;

  @ApiProperty({ description: 'Total records ingested' })
  totalProcessed: number;

  @ApiProperty({ description: 'Processing duration in milliseconds' })
  processingTimeMs: number;

  @ApiPropertyOptional({ description: 'Any errors encountered' })
  errors?: string[];
}
