import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(private dataSource: DataSource) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const startTime = Date.now();
    
    try {
      await this.dataSource.query('SELECT 1');
      const responseTime = Date.now() - startTime;
      
      return this.getStatus(key, true, {
        responseTime: `${responseTime}ms`,
        type: 'postgres',
      });
    } catch (error) {
      throw new HealthCheckError(
        'Database check failed',
        this.getStatus(key, false, {
          message: error.message,
        }),
      );
    }
  }
}
