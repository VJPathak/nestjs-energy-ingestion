import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Analytics (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v1/analytics/performance/:vehicleId', () => {
    it('should return 404 for non-existent vehicle', () => {
      return request(app.getHttpServer())
        .get('/v1/analytics/performance/NON-EXISTENT-VH')
        .expect(404);
    });

    // This test requires seeded data
    it.skip('should return performance metrics for existing vehicle', () => {
      return request(app.getHttpServer())
        .get('/v1/analytics/performance/VH-001-01')
        .expect(200)
        .expect((res: request.Response) => {
          const data = res.body.data;
          expect(data).toHaveProperty('vehicleId');
          expect(data).toHaveProperty('meterId');
          expect(data).toHaveProperty('period');
          expect(data).toHaveProperty('metrics');
          expect(data).toHaveProperty('alerts');
          
          expect(data.metrics).toHaveProperty('totalAcConsumed');
          expect(data.metrics).toHaveProperty('totalDcDelivered');
          expect(data.metrics).toHaveProperty('efficiencyRatio');
          expect(data.metrics).toHaveProperty('avgBatteryTemp');
        });
    });
  });
});
