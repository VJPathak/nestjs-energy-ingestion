import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PerformanceMetricsDto {
  @ApiProperty({
    description: 'Total AC energy consumed from grid (kWh)',
    example: 450.5,
  })
  totalAcConsumed: number;

  @ApiProperty({
    description: 'Total DC energy delivered to battery (kWh)',
    example: 392.2,
  })
  totalDcDelivered: number;

  @ApiProperty({
    description: 'Power efficiency ratio (DC/AC * 100)',
    example: 87.1,
  })
  efficiencyRatio: number;

  @ApiProperty({
    description: 'Average battery temperature (°C)',
    example: 34.2,
  })
  avgBatteryTemp: number;

  @ApiProperty({
    description: 'Peak battery temperature (°C)',
    example: 42.1,
  })
  peakBatteryTemp: number;

  @ApiProperty({
    description: 'Number of charging sessions detected',
    example: 8,
  })
  chargingSessions: number;

  @ApiPropertyOptional({
    description: 'Minimum State of Charge during period',
    example: 15.2,
  })
  minSoc?: number;

  @ApiPropertyOptional({
    description: 'Maximum State of Charge during period',
    example: 98.5,
  })
  maxSoc?: number;

  @ApiPropertyOptional({
    description: 'Average voltage from meter',
    example: 238.5,
  })
  avgVoltage?: number;
}

export class PeriodDto {
  @ApiProperty({
    description: 'Start of the analysis period',
    example: '2025-01-30T10:00:00Z',
  })
  start: string;

  @ApiProperty({
    description: 'End of the analysis period',
    example: '2025-01-31T10:00:00Z',
  })
  end: string;
}

export class AlertDto {
  @ApiProperty({
    description: 'Alert type',
    example: 'LOW_EFFICIENCY',
  })
  type: string;

  @ApiProperty({
    description: 'Alert severity',
    example: 'warning',
  })
  severity: 'info' | 'warning' | 'critical';

  @ApiProperty({
    description: 'Human-readable message',
    example: 'Efficiency dropped below 85% threshold',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Threshold that was breached',
    example: 85,
  })
  threshold?: number;

  @ApiPropertyOptional({
    description: 'Actual value that triggered the alert',
    example: 82.3,
  })
  actualValue?: number;
}

export class VehiclePerformanceResponseDto {
  @ApiProperty({
    description: 'Vehicle identifier',
    example: 'VH-001',
  })
  vehicleId: string;

  @ApiProperty({
    description: 'Associated meter identifier',
    example: 'METER-001',
  })
  meterId: string;

  @ApiProperty({
    description: 'Analysis period',
    type: PeriodDto,
  })
  period: PeriodDto;

  @ApiProperty({
    description: 'Performance metrics',
    type: PerformanceMetricsDto,
  })
  metrics: PerformanceMetricsDto;

  @ApiProperty({
    description: 'Active alerts for this vehicle',
    type: [AlertDto],
  })
  alerts: AlertDto[];
}
