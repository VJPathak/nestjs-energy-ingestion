import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Telemetry (e2e)', () => {
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

  describe('POST /v1/telemetry/meter', () => {
    it('should accept valid meter telemetry', () => {
      return request(app.getHttpServer())
        .post('/v1/telemetry/meter')
        .send({
          meterId: 'METER-TEST-001',
          kwhConsumedAc: 150.5,
          voltage: 240.2,
          timestamp: new Date().toISOString(),
        })
        .expect(202)
        .expect({ status: 'accepted' });
    });

    it('should reject invalid meter telemetry', () => {
      return request(app.getHttpServer())
        .post('/v1/telemetry/meter')
        .send({
          meterId: '', // Invalid: empty
          kwhConsumedAc: -10, // Invalid: negative
          voltage: 240.2,
          timestamp: new Date().toISOString(),
        })
        .expect(400);
    });
  });

  describe('POST /v1/telemetry/vehicle', () => {
    it('should accept valid vehicle telemetry', () => {
      return request(app.getHttpServer())
        .post('/v1/telemetry/vehicle')
        .send({
          vehicleId: 'VH-TEST-001',
          soc: 75.5,
          kwhDeliveredDc: 45.2,
          batteryTemp: 32.5,
          timestamp: new Date().toISOString(),
        })
        .expect(202)
        .expect({ status: 'accepted' });
    });

    it('should reject SoC over 100', () => {
      return request(app.getHttpServer())
        .post('/v1/telemetry/vehicle')
        .send({
          vehicleId: 'VH-TEST-001',
          soc: 150, // Invalid: over 100
          kwhDeliveredDc: 45.2,
          batteryTemp: 32.5,
          timestamp: new Date().toISOString(),
        })
        .expect(400);
    });
  });

  describe('POST /v1/telemetry/bulk', () => {
    it('should process bulk telemetry', () => {
      return request(app.getHttpServer())
        .post('/v1/telemetry/bulk')
        .send({
          meters: [
            {
              meterId: 'METER-BULK-001',
              kwhConsumedAc: 100,
              voltage: 230,
              timestamp: new Date().toISOString(),
            },
            {
              meterId: 'METER-BULK-002',
              kwhConsumedAc: 120,
              voltage: 235,
              timestamp: new Date().toISOString(),
            },
          ],
          vehicles: [
            {
              vehicleId: 'VH-BULK-001',
              soc: 80,
              kwhDeliveredDc: 85,
              batteryTemp: 30,
              timestamp: new Date().toISOString(),
            },
          ],
        })
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.data.metersProcessed).toBe(2);
          expect(res.body.data.vehiclesProcessed).toBe(1);
          expect(res.body.data.totalProcessed).toBe(3);
        });
    });
  });

  describe('GET /v1/telemetry/queue/status', () => {
    it('should return queue status', () => {
      return request(app.getHttpServer())
        .get('/v1/telemetry/queue/status')
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.data).toHaveProperty('meterQueueSize');
          expect(res.body.data).toHaveProperty('vehicleQueueSize');
        });
    });
  });
});
