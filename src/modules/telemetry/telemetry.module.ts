import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { TelemetryController } from './controllers/telemetry.controller';
import { TelemetryService } from './services/telemetry.service';
import { TelemetryBatchService } from './services/telemetry-batch.service';
import { MeterTelemetryRepository } from './repositories/meter-telemetry.repository';
import { VehicleTelemetryRepository } from './repositories/vehicle-telemetry.repository';
import { LiveStateRepository } from './repositories/live-state.repository';

import { MeterTelemetryHistory } from './entities/meter-telemetry-history.entity';
import { VehicleTelemetryHistory } from './entities/vehicle-telemetry-history.entity';
import { MeterLiveState } from './entities/meter-live-state.entity';
import { VehicleLiveState } from './entities/vehicle-live-state.entity';
import { FleetAssignment } from './entities/fleet-assignment.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      MeterTelemetryHistory,
      VehicleTelemetryHistory,
      MeterLiveState,
      VehicleLiveState,
      FleetAssignment,
    ]),
  ],
  controllers: [TelemetryController],
  providers: [
    TelemetryService,
    TelemetryBatchService,
    MeterTelemetryRepository,
    VehicleTelemetryRepository,
    LiveStateRepository,
  ],
  exports: [TelemetryService],
})
export class TelemetryModule {}
