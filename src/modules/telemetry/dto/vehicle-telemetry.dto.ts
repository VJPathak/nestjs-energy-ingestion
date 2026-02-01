import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsDateString,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';

export class VehicleTelemetryDto {
  @ApiProperty({
    description: 'Unique identifier for the vehicle',
    example: 'VH-001',
  })
  @IsString()
  @IsNotEmpty()
  vehicleId: string;

  @ApiProperty({
    description: 'State of Charge - Battery percentage (0-100)',
    example: 75.5,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  soc: number;

  @ApiProperty({
    description: 'DC energy delivered to battery (kWh)',
    example: 45.2,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  kwhDeliveredDc: number;

  @ApiProperty({
    description: 'Battery temperature in Celsius',
    example: 32.5,
    minimum: -40,
    maximum: 100,
  })
  @IsNumber()
  @Min(-40)
  @Max(100)
  batteryTemp: number;

  @ApiProperty({
    description: 'Timestamp of the telemetry reading',
    example: '2025-01-31T10:00:00Z',
  })
  @IsDateString()
  timestamp: string;
}

export class VehicleTelemetryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  vehicleId: string;

  @ApiProperty()
  soc: number;

  @ApiProperty()
  kwhDeliveredDc: number;

  @ApiProperty()
  batteryTemp: number;

  @ApiProperty()
  timestamp: Date;

  @ApiProperty()
  ingestedAt: Date;
}
