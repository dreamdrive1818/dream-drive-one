// Tests for CatalogService.pickRule (price rule selection logic)

jest.mock('../../lib/prisma', () => ({
  prisma: {
    carModel: { findMany: jest.fn(), findUnique: jest.fn() },
    catalogSettings: { upsert: jest.fn() },
    booking: { groupBy: jest.fn() },
    availabilityBlock: { findMany: jest.fn() },
    vehicle: { findFirst: jest.fn(), count: jest.fn() },
  },
}));

import { CatalogService } from '../../modules/catalog/catalog.service';

type PriceRow = {
  rentalType: string;
  dailyPaise: number;
  extraKmPaise: number | null;
  depositPaise: number;
  hourlyPaise: number | null;
  startsOn: Date | null;
  endsOn: Date | null;
};

describe('CatalogService.pickRule (price rule selection)', () => {
  const svc = new CatalogService();

  const makeRule = (
    rentalType: string,
    dailyPaise: number,
    startsOn: Date | null = null,
    endsOn: Date | null = null
  ): PriceRow => ({
    rentalType,
    dailyPaise,
    extraKmPaise: null,
    depositPaise: 0,
    hourlyPaise: null,
    startsOn,
    endsOn,
  });

  it('returns exact rental type match', () => {
    const rules = [makeRule('AIRPORT', 200000), makeRule('SELF_DRIVE', 100000)];
    const rule = svc.pickRule(rules as any, 'AIRPORT' as any, null);
    expect(rule?.dailyPaise).toBe(200000);
  });

  it('falls back to SELF_DRIVE when no exact match', () => {
    const rules = [makeRule('SELF_DRIVE', 100000)];
    const rule = svc.pickRule(rules as any, 'AIRPORT' as any, null);
    expect(rule?.dailyPaise).toBe(100000);
    expect(rule?.rentalType).toBe('SELF_DRIVE');
  });

  it('returns null for empty rules', () => {
    const rule = svc.pickRule([], 'SELF_DRIVE' as any, null);
    expect(rule).toBeNull();
  });

  it('prefers seasonal rule when date is in active window', () => {
    const now = new Date();
    const seasonStart = new Date(now.getTime() - 24 * 60 * 60 * 1000); // yesterday
    const seasonEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000); // tomorrow
    const rules = [
      makeRule('SELF_DRIVE', 100000), // base rule
      makeRule('SELF_DRIVE', 150000, seasonStart, seasonEnd), // seasonal rule
    ];
    const rule = svc.pickRule(rules as any, 'SELF_DRIVE' as any, now);
    expect(rule?.dailyPaise).toBe(150000);
  });

  it('prefers narrower seasonal window over wider one', () => {
    const now = new Date();
    const wideStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const wideEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const narrowStart = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const narrowEnd = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
    const rules = [
      makeRule('SELF_DRIVE', 120000, wideStart, wideEnd),
      makeRule('SELF_DRIVE', 160000, narrowStart, narrowEnd),
    ];
    const rule = svc.pickRule(rules as any, 'SELF_DRIVE' as any, now);
    expect(rule?.dailyPaise).toBe(160000);
  });

  it('skips seasonal rule when date is outside its range', () => {
    const now = new Date();
    const pastStart = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const pastEnd = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const rules = [
      makeRule('SELF_DRIVE', 100000), // base
      makeRule('SELF_DRIVE', 150000, pastStart, pastEnd), // expired seasonal
    ];
    const rule = svc.pickRule(rules as any, 'SELF_DRIVE' as any, now);
    expect(rule?.dailyPaise).toBe(100000);
  });

  it('uses any rule as fallback when no SELF_DRIVE rule exists', () => {
    const rules = [makeRule('WITH_DRIVER_LOCAL', 80000)];
    const rule = svc.pickRule(rules as any, 'AIRPORT' as any, null);
    expect(rule?.dailyPaise).toBe(80000);
  });
});
