import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private registry: Registry;

  // Telemetry ingestion metrics
  public telemetryIngestionTotal: Counter;
  public telemetryIngestionLatency: Histogram;
  public telemetryBatchSize: Histogram;

  // Analytics metrics
  public analyticsQueryDuration: Histogram;
  public analyticsRequestsTotal: Counter;

  // Queue metrics
  public meterQueueSize: Gauge;
  public vehicleQueueSize: Gauge;

  // Database metrics
  public dbConnectionPoolSize: Gauge;
  public dbQueryDuration: Histogram;

  constructor() {
    this.registry = new Registry();
  }

  onModuleInit() {
    // Collect default Node.js metrics
    collectDefaultMetrics({ register: this.registry });

    // Telemetry ingestion
    this.telemetryIngestionTotal = new Counter({
      name: 'telemetry_ingestion_total',
      help: 'Total number of telemetry records ingested',
      labelNames: ['type', 'status'],
      registers: [this.registry],
    });

    this.telemetryIngestionLatency = new Histogram({
      name: 'telemetry_ingestion_latency_ms',
      help: 'Telemetry ingestion latency in milliseconds',
      labelNames: ['type'],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
      registers: [this.registry],
    });

    this.telemetryBatchSize = new Histogram({
      name: 'telemetry_batch_size',
      help: 'Size of ingested batches',
      labelNames: ['type'],
      buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
      registers: [this.registry],
    });

    // Analytics
    this.analyticsQueryDuration = new Histogram({
      name: 'analytics_query_duration_ms',
      help: 'Analytics query duration in milliseconds',
      labelNames: ['endpoint'],
      buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],
      registers: [this.registry],
    });

    this.analyticsRequestsTotal = new Counter({
      name: 'analytics_requests_total',
      help: 'Total number of analytics requests',
      labelNames: ['endpoint', 'status'],
      registers: [this.registry],
    });

    // Queue
    this.meterQueueSize = new Gauge({
      name: 'meter_queue_size',
      help: 'Current size of the meter ingestion queue',
      registers: [this.registry],
    });

    this.vehicleQueueSize = new Gauge({
      name: 'vehicle_queue_size',
      help: 'Current size of the vehicle ingestion queue',
      registers: [this.registry],
    });

    // Database
    this.dbConnectionPoolSize = new Gauge({
      name: 'db_connection_pool_size',
      help: 'Number of active database connections',
      labelNames: ['state'],
      registers: [this.registry],
    });

    this.dbQueryDuration = new Histogram({
      name: 'db_query_duration_ms',
      help: 'Database query duration in milliseconds',
      labelNames: ['operation', 'table'],
      buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500],
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  // Helper methods for common operations
  recordIngestion(type: 'meter' | 'vehicle', count: number, durationMs: number) {
    this.telemetryIngestionTotal.inc({ type, status: 'success' }, count);
    this.telemetryIngestionLatency.observe({ type }, durationMs);
    this.telemetryBatchSize.observe({ type }, count);
  }

  recordIngestionError(type: 'meter' | 'vehicle', count: number) {
    this.telemetryIngestionTotal.inc({ type, status: 'error' }, count);
  }

  recordAnalyticsQuery(endpoint: string, durationMs: number, success: boolean) {
    this.analyticsQueryDuration.observe({ endpoint }, durationMs);
    this.analyticsRequestsTotal.inc({
      endpoint,
      status: success ? 'success' : 'error',
    });
  }

  updateQueueSizes(meterSize: number, vehicleSize: number) {
    this.meterQueueSize.set(meterSize);
    this.vehicleQueueSize.set(vehicleSize);
  }
}
