import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsDateString,
  IsPositive,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';

export class MeterTelemetryDto {
  @ApiProperty({
    description: 'Unique identifier for the smart meter',
    example: 'METER-001',
  })
  @IsString()
  @IsNotEmpty()
  meterId: string;

  @ApiProperty({
    description: 'Total AC energy consumed from the grid (kWh)',
    example: 150.5,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  kwhConsumedAc: number;

  @ApiProperty({
    description: 'Current voltage reading (V)',
    example: 240.2,
    minimum: 0,
    maximum: 500,
  })
  @IsNumber()
  @Min(0)
  @Max(500)
  voltage: number;

  @ApiProperty({
    description: 'Timestamp of the telemetry reading',
    example: '2025-01-31T10:00:00Z',
  })
  @IsDateString()
  timestamp: string;
}

export class MeterTelemetryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  meterId: string;

  @ApiProperty()
  kwhConsumedAc: number;

  @ApiProperty()
  voltage: number;

  @ApiProperty()
  timestamp: Date;

  @ApiProperty()
  ingestedAt: Date;
}
