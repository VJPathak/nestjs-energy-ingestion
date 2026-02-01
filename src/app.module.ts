import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerminusModule } from '@nestjs/terminus';

import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import { TypeOrmConfigService } from './config/typeorm.config';

import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig],
      envFilePath: ['.env.local', '.env'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
    }),

    // Health checks
    TerminusModule,

    // Feature modules
    TelemetryModule,
    AnalyticsModule,
    HealthModule,
    MetricsModule,
  ],
})
export class AppModule {}
