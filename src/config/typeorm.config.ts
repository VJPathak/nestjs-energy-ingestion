import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';

@Injectable()
export class TypeOrmConfigService implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      url: this.configService.get<string>('database.url'),
      host: this.configService.get<string>('database.host'),
      port: this.configService.get<number>('database.port'),
      username: this.configService.get<string>('database.username'),
      password: this.configService.get<string>('database.password'),
      database: this.configService.get<string>('database.database'),
      ssl: this.configService.get<boolean>('database.ssl')
        ? { rejectUnauthorized: false }
        : false,
      
      // Entity configuration
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
      
      // Pool configuration for high throughput
      poolSize: this.configService.get<number>('database.poolSize'),
      extra: {
        connectionTimeoutMillis: this.configService.get<number>('database.connectionTimeout'),
        idleTimeoutMillis: 30000,
        max: this.configService.get<number>('database.poolSize'),
      },
      
      // Performance settings
      synchronize: false,
      logging: this.configService.get<boolean>('database.logging'),
      migrationsRun: this.configService.get<boolean>('database.migrationsRun'),
      
      // Retry logic
      retryAttempts: 3,
      retryDelay: 3000,
    };
  }
}

// For CLI migrations
const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: true,
};

export default new DataSource(dataSourceOptions);
