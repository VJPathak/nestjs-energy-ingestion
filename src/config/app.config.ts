import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'v1',
  
  // Ingestion settings
  batchSize: parseInt(process.env.BATCH_SIZE ?? '1000', 10),
  batchIntervalMs: parseInt(process.env.BATCH_INTERVAL_MS ?? '5000', 10),
  maxQueueSize: parseInt(process.env.MAX_QUEUE_SIZE ?? '50000', 10),
  
  // Alert thresholds
  efficiencyThreshold: parseFloat(process.env.EFFICIENCY_THRESHOLD ?? '85'),
  batteryTempWarning: parseFloat(process.env.BATTERY_TEMP_WARNING ?? '45'),
  batteryTempCritical: parseFloat(process.env.BATTERY_TEMP_CRITICAL ?? '55'),
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  enableQueryLogging: process.env.ENABLE_QUERY_LOGGING === 'true',
  slowQueryThresholdMs: parseInt(process.env.SLOW_QUERY_THRESHOLD_MS ?? '1000', 10),
}));
