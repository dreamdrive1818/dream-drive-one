// E2E tests for internal endpoints using a focused TestingModule
// Tests authentication guard behavior and basic endpoint routing

// Mock all DB/external services
jest.mock('../../lib/prisma', () => ({
  prisma: {
    booking: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    notification: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    notificationLog: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    notificationTemplate: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    vehicle: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    vehicleDocument: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    partner: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    settlement: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    payment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    availabilityBlock: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

jest.mock('../../lib/firebase-admin', () => ({
  firebaseAdmin: jest.fn().mockResolvedValue(null),
  getFirebaseAdmin: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../lib/http', () => ({
  ...jest.requireActual('../../lib/http'),
  internalFetch: jest.fn().mockResolvedValue({}),
  serviceUrls: jest.fn().mockReturnValue({
    catalog: 'http://localhost:4001',
    booking: 'http://localhost:4000',
    socket: 'http://localhost:4002',
  }),
}));

jest.mock('../../lib/zoho', () => ({ sendEmail: jest.fn().mockResolvedValue(true) }));
jest.mock('../../lib/cloudinary', () => ({ uploadToCloudinary: jest.fn() }));
jest.mock('../../lib/kyc', () => ({ checkKyc: jest.fn() }));
jest.mock('../../lib/leads', () => ({ createLead: jest.fn() }));
jest.mock('../../lib/loyalty-referral', () => ({ applyReferral: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import request from 'supertest';
import { HealthController } from '../../modules/health/health.controller';
import { BookingController } from '../../modules/booking/booking.controller';
import { BookingEngine } from '../../modules/booking/booking.service';
import { NotifyController } from '../../modules/notification/notify.controller';
import { NotifyEngine } from '../../modules/notification/notify.service';
import { IdentityService } from '../../modules/identity/identity.service';
import { AuthMiddleware } from '../../auth.middleware';
import { ConfigModule } from '@nestjs/config';

const INTERNAL_TOKEN = 'dev-internal';

describe('Internal Endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Set env vars for middleware
    process.env.INTERNAL_TOKEN = INTERNAL_TOKEN;
    process.env.DEV_AUTH_BYPASS = 'true';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [HealthController, BookingController, NotifyController],
      providers: [AuthMiddleware, BookingEngine, NotifyEngine, IdentityService],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the AuthMiddleware
    const authMiddleware = moduleFixture.get(AuthMiddleware);
    (app as any).use((req: any, res: any, next: any) => authMiddleware.use(req, res, next));

    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('GET /health', () => {
    it('responds with ok', async () => {
      const res = await request(app.getHttpServer()).get('/health').expect(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('POST /internal/holds/expire', () => {
    it('returns 401 without internal token', async () => {
      await request(app.getHttpServer())
        .post('/internal/holds/expire')
        .expect(401);
    });

    it('succeeds with correct internal token', async () => {
      await request(app.getHttpServer())
        .post('/internal/holds/expire')
        .set('x-internal-token', INTERNAL_TOKEN)
        .expect((res) => {
          expect([200, 201]).toContain(res.status);
        });
    });
  });

  describe('POST /internal/bookings/mark-no-show', () => {
    it('returns 401 without internal token', async () => {
      await request(app.getHttpServer())
        .post('/internal/bookings/mark-no-show')
        .expect(401);
    });

    it('succeeds with correct internal token', async () => {
      await request(app.getHttpServer())
        .post('/internal/bookings/mark-no-show')
        .set('x-internal-token', INTERNAL_TOKEN)
        .expect((res) => {
          expect([200, 201]).toContain(res.status);
        });
    });
  });

  describe('POST /internal/notify/retry', () => {
    it('returns 401 without internal token', async () => {
      await request(app.getHttpServer())
        .post('/internal/notify/retry')
        .expect(401);
    });

    it('succeeds with correct internal token', async () => {
      await request(app.getHttpServer())
        .post('/internal/notify/retry')
        .set('x-internal-token', INTERNAL_TOKEN)
        .expect((res) => {
          expect([200, 201]).toContain(res.status);
        });
    });
  });
});
