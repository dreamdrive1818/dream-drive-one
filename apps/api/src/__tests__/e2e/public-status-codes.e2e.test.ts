jest.mock('../../lib/prisma', () => ({
  prisma: {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  },
}));
jest.mock('../../lib/firebase-admin', () => ({
  firebaseAdmin: jest.fn().mockResolvedValue(null),
  getFirebaseAdmin: jest.fn().mockResolvedValue(null),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import { HealthController } from '../../modules/health/health.controller';
import { CmsController } from '../../modules/platform/cms.controller';
import { CmsService } from '../../modules/platform/cms.service';
import { CatalogController } from '../../modules/catalog/catalog.controller';
import { CatalogService } from '../../modules/catalog/catalog.service';
import { FleetController } from '../../modules/fleet/fleet.controller';
import { FleetEngine } from '../../modules/fleet/fleet.service';
import { BookingController } from '../../modules/booking/booking.controller';
import { BookingEngine } from '../../modules/booking/booking.service';
import { IdentityController } from '../../modules/identity/identity.controller';
import { IdentityService } from '../../modules/identity/identity.service';
import { NotifyEngine } from '../../modules/notification/notify.service';

describe('Public API status codes (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [
        HealthController,
        CmsController,
        CatalogController,
        FleetController,
        BookingController,
        IdentityController,
      ],
      providers: [
        {
          provide: CmsService,
          useValue: {
            publicConfig: jest.fn().mockResolvedValue({ siteName: 'Dream Drive' }),
            home: jest.fn().mockResolvedValue({ page: null, blogs: [] }),
            blogs: jest.fn().mockResolvedValue([]),
            testimonials: jest.fn().mockResolvedValue([]),
            publicPages: jest.fn().mockResolvedValue([]),
            banners: jest.fn().mockResolvedValue([]),
            categories: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: CatalogService,
          useValue: {
            publicConfig: jest.fn().mockResolvedValue({ bufferHours: 3 }),
            search: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: FleetEngine,
          useValue: {
            cities: jest.fn().mockResolvedValue([]),
            listAirports: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: BookingEngine,
          useValue: {
            listPackages: jest.fn().mockResolvedValue([]),
            getPackage: jest.fn().mockRejectedValue(new NotFoundException('Package not found')),
            listCityPairs: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: IdentityService,
          useValue: {
            issueOtp: jest.fn().mockResolvedValue('123456'),
            verifyOtp: jest.fn().mockResolvedValue({ ok: true, token: 't' }),
          },
        },
        {
          provide: NotifyEngine,
          useValue: {
            send: jest.fn().mockResolvedValue({ ok: true }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  const publicGets = [
    '/health',
    '/v1/public/home',
    '/v1/public/blogs',
    '/v1/public/packages',
    '/v1/public/search',
    '/v1/public/airports',
    '/v1/public/config',
    '/v1/public/testimonials',
    '/v1/public/cities',
    '/v1/public/catalog-config',
    '/v1/public/pages',
    '/v1/public/banners',
    '/v1/public/blog-categories',
    '/v1/public/city-pairs',
  ];

  it.each(publicGets)('%s returns 200', async (path) => {
    const res = await request(app.getHttpServer()).get(path);
    expect(res.status).toBe(200);
  });

  it('GET /v1/public/packages/missing returns 404', async () => {
    await request(app.getHttpServer()).get('/v1/public/packages/missing').expect(404);
  });

  it('POST /v1/auth/otp/send returns 400 without email', async () => {
    await request(app.getHttpServer()).post('/v1/auth/otp/send').send({}).expect(400);
  });

  it('POST /v1/auth/otp/send returns 2xx and ok when email is present', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/otp/send')
      .send({ email: 'qa@dreamdrive.test' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.ok).toBe(true);
    expect(res.body.emailSent).toBe(true);
  });

  it('POST /v1/auth/otp/verify returns 400 without code', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({ email: 'qa@dreamdrive.test' })
      .expect(400);
  });
});
