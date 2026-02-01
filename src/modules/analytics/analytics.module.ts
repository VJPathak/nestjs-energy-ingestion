import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { AnalyticsController } from './controllers/analytics.controller';
import { AnalyticsService } from './services/analytics.service';
import { EfficiencyService } from './services/efficiency.service';

import { MeterTelemetryHistory } from '../telemetry/entities/meter-telemetry-history.entity';
import { VehicleTelemetryHistory } from '../telemetry/entities/vehicle-telemetry-history.entity';
import { FleetAssignment } from '../telemetry/entities/fleet-assignment.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      MeterTelemetryHistory,
      VehicleTelemetryHistory,
      FleetAssignment,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, EfficiencyService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
