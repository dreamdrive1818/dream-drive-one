// E2E-style tests for core booking flow logic (using mocked Prisma)
// Tests BookingEngine methods directly without starting a full HTTP server

jest.mock('../../lib/prisma', () => ({
  prisma: {
    quote: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    booking: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    carModel: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    bookingStatusHistory: {
      create: jest.fn().mockResolvedValue({}),
    },
    offerRedemption: {
      create: jest.fn().mockResolvedValue({}),
    },
    commissionRule: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    payment: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    refund: {
      create: jest.fn().mockResolvedValue({}),
    },
    offer: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    branch: {
      findUnique: jest.fn().mockResolvedValue({ id: 'branch-1', cityId: 'city-1' }),
    },
    availabilityBlock: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    notification: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

jest.mock('../../lib/http', () => ({
  ...jest.requireActual('../../lib/http'),
  internalFetch: jest.fn().mockResolvedValue({ vehicleId: 'vehicle-1', blockId: 'block-1' }),
  serviceUrls: jest.fn().mockReturnValue({
    catalog: 'http://localhost:4001',
    socket: 'http://localhost:4002',
  }),
}));

jest.mock('../../lib/firebase-admin', () => ({
  firebaseAdmin: jest.fn().mockResolvedValue(null),
  getFirebaseAdmin: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../lib/zoho', () => ({ sendEmail: jest.fn().mockResolvedValue(true) }));

import { prisma } from '../../lib/prisma';
import { BookingEngine } from '../../modules/booking/booking.service';

const mockPrisma = prisma as any;

describe('BookingEngine (booking flow)', () => {
  let engine: BookingEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new BookingEngine();
  });

  describe('get(id)', () => {
    it('fetches booking by id', async () => {
      const mockBooking = {
        id: 'booking-1',
        publicId: 'DD123',
        status: 'AWAITING_PAYMENT',
        userId: 'user-1',
        rentalType: 'SELF_DRIVE',
      };
      mockPrisma.booking.findFirst.mockResolvedValue(mockBooking);

      const result = await engine.get('booking-1');
      expect(result).toEqual(mockBooking);
      expect(mockPrisma.booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { OR: [{ id: 'booking-1' }, { publicId: 'booking-1' }] } })
      );
    });

    it('returns null when booking not found', async () => {
      mockPrisma.booking.findFirst.mockResolvedValue(null);
      const result = await engine.get('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('expireHolds()', () => {
    it('returns a result object with expired count', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([]);
      const result = await engine.expireHolds();
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('returns zero expired when no holds', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([]);
      const result = await engine.expireHolds();
      expect((result as any).expired).toBe(0);
    });
  });

  describe('markNoShows()', () => {
    it('returns a result object with marked count', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([]);
      const result = await engine.markNoShows();
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('returns zero marked when no no-shows', async () => {
      mockPrisma.booking.findMany.mockResolvedValue([]);
      const result = await engine.markNoShows();
      expect((result as any).marked).toBe(0);
    });
  });

  describe('mine(userId)', () => {
    it('returns bookings for a user', async () => {
      const userBookings = [
        { id: 'b1', userId: 'user-1', carModelId: 'car-1', status: 'CONFIRMED' },
        { id: 'b2', userId: 'user-1', carModelId: 'car-1', status: 'COMPLETED' },
      ];
      mockPrisma.booking.findMany.mockResolvedValue(userBookings);
      mockPrisma.carModel.findMany.mockResolvedValue([
        { id: 'car-1', name: 'Test Car', slug: 'test-car', images: [] },
      ]);

      const result = await engine.mine('user-1');
      expect(result.length).toBe(2);
      expect(result[0].userId).toBe('user-1');
    });
  });
});
