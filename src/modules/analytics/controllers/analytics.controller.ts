import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';

import { AnalyticsService } from '../services/analytics.service';
import { VehiclePerformanceResponseDto } from '../dto/vehicle-performance.dto';

@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('performance/:vehicleId')
  @ApiOperation({
    summary: 'Get 24-hour vehicle performance summary',
    description: `
      Returns a comprehensive 24-hour performance analysis including:
      - Total energy consumed (AC) vs delivered (DC)
      - Power efficiency ratio (DC/AC)
      - Battery temperature statistics
      - Active alerts for efficiency or temperature issues
      
      The query uses indexed columns to avoid full table scans on historical data.
    `,
  })
  @ApiParam({
    name: 'vehicleId',
    description: 'Unique vehicle identifier',
    example: 'VH-001',
  })
  @ApiResponse({
    status: 200,
    description: '24-hour performance summary',
    type: VehiclePerformanceResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Vehicle not found or no active assignment',
  })
  async getVehiclePerformance(
    @Param('vehicleId') vehicleId: string,
  ): Promise<VehiclePerformanceResponseDto> {
    return this.analyticsService.getVehiclePerformance(vehicleId);
  }
}
