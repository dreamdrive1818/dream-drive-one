// Service test for freezeBookingCommission using mocked prisma

jest.mock('../../lib/prisma', () => ({
  prisma: {
    booking: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    commissionRule: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '../../lib/prisma';
import { freezeBookingCommission } from '../../lib/commission';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('freezeBookingCommission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: update resolves successfully
    (mockPrisma.booking.update as jest.Mock).mockResolvedValue({});
  });

  it('returns null when booking is not found', async () => {
    (mockPrisma.booking.findUnique as jest.Mock).mockResolvedValue(null);
    const result = await freezeBookingCommission('non-existent-id');
    expect(result).toBeNull();
  });

  it('returns null partnerId when vehicle has no partner', async () => {
    (mockPrisma.booking.findUnique as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      rentalType: 'SELF_DRIVE',
      commissionPercentBps: null,
      commissionFlatPaise: null,
      vehicle: { partnerId: null },
    });

    const result = await freezeBookingCommission('booking-1');
    expect(result).toEqual({ partnerId: null, percentBps: null, flatPaise: null });
    // Should NOT call commissionRule.findMany
    expect(mockPrisma.commissionRule.findMany).not.toHaveBeenCalled();
  });

  it('clears existing commission when vehicle has no partner', async () => {
    (mockPrisma.booking.findUnique as jest.Mock).mockResolvedValue({
      id: 'booking-1',
      rentalType: 'SELF_DRIVE',
      commissionPercentBps: 1000, // previously set
      commissionFlatPaise: 5000,
      vehicle: { partnerId: null },
    });

    await freezeBookingCommission('booking-1');
    expect(mockPrisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { commissionPercentBps: null, commissionFlatPaise: null },
      })
    );
  });

  it('computes and saves commission when partner rules exist', async () => {
    (mockPrisma.booking.findUnique as jest.Mock).mockResolvedValue({
      id: 'booking-2',
      rentalType: 'SELF_DRIVE',
      commissionPercentBps: null,
      commissionFlatPaise: null,
      vehicle: { partnerId: 'partner-1' },
    });
    (mockPrisma.commissionRule.findMany as jest.Mock).mockResolvedValue([
      { rentalType: 'SELF_DRIVE', percentBps: 1500, flatPaise: 2000 },
    ]);
    (mockPrisma.booking.update as jest.Mock).mockResolvedValue({});

    const result = await freezeBookingCommission('booking-2');

    expect(result).toEqual({ partnerId: 'partner-1', percentBps: 1500, flatPaise: 2000 });
    expect(mockPrisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { commissionPercentBps: 1500, commissionFlatPaise: 2000 },
      })
    );
  });

  it('uses zero commission when no matching rule exists', async () => {
    (mockPrisma.booking.findUnique as jest.Mock).mockResolvedValue({
      id: 'booking-3',
      rentalType: 'AIRPORT',
      commissionPercentBps: null,
      commissionFlatPaise: null,
      vehicle: { partnerId: 'partner-2' },
    });
    (mockPrisma.commissionRule.findMany as jest.Mock).mockResolvedValue([]); // no rules

    const result = await freezeBookingCommission('booking-3');
    // pickCommissionRule returns null for empty rules, so percentBps and flatPaise default to 0
    expect(result?.percentBps).toBe(0);
    expect(result?.flatPaise).toBe(0);
  });
});
