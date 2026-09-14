// E2E test for the health endpoint using NestJS TestingModule

// Mock prisma to prevent real DB connection
jest.mock('../../lib/prisma', () => ({
  prisma: {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    catalogSettings: {
      upsert: jest.fn().mockResolvedValue({ id: 'default', bufferHours: 3, maxRentalDays: 30, updatedAt: new Date() }),
    },
  },
}));

// Mock firebase-admin to prevent real auth initialization
jest.mock('../../lib/firebase-admin', () => ({
  firebaseAdmin: jest.fn().mockResolvedValue(null),
  getFirebaseAdmin: jest.fn().mockResolvedValue(null),
}));

// Mock any modules that try to connect to external services on startup
jest.mock('../../lib/http', () => ({
  ...jest.requireActual('../../lib/http'),
  internalFetch: jest.fn().mockResolvedValue({}),
  serviceUrls: jest.fn().mockReturnValue({
    catalog: 'http://localhost:4001',
    booking: 'http://localhost:4000',
    socket: 'http://localhost:4002',
  }),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { HealthController } from '../../modules/health/health.controller';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health returns status ok', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    expect(response.body.status).toBe('ok');
  });

  it('GET /health returns service name', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    expect(response.body.service).toBe('api');
  });
});
