import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'energy_db',
  ssl: process.env.DATABASE_SSL === 'true',
  
  // Connection pool settings optimized for high throughput
  poolSize: parseInt(process.env.DATABASE_POOL_SIZE ?? '100', 10),
  connectionTimeout: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT ?? '30000', 10),
  
  // TypeORM specific
  synchronize: false, // Never use in production
  logging: process.env.ENABLE_QUERY_LOGGING === 'true',
  migrationsRun: process.env.NODE_ENV === 'production',
}));
