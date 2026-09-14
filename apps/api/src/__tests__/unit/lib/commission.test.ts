// Pure-function tests for commission.ts
// These functions don't need a real DB

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    booking: { findUnique: jest.fn(), update: jest.fn() },
    commissionRule: { findMany: jest.fn() },
  },
}));

import {
  computeCommissionPaise,
  pickCommissionRule,
  parseBank,
  hasPayoutBank,
} from '../../../lib/commission';

describe('computeCommissionPaise', () => {
  it('computes 20% commission (2000 bps) on 500000 paise', () => {
    expect(computeCommissionPaise(500000, 2000, 0)).toBe(100000);
  });

  it('computes 10% commission + flat', () => {
    // 500000 * 1000/10000 = 50000, + 5000 flat = 55000
    expect(computeCommissionPaise(500000, 1000, 5000)).toBe(55000);
  });

  it('returns 0 for 0% and 0 flat', () => {
    expect(computeCommissionPaise(500000, 0, 0)).toBe(0);
  });

  it('returns 0 for zero amount', () => {
    expect(computeCommissionPaise(0, 2000, 0)).toBe(0);
  });

  it('never returns negative', () => {
    expect(computeCommissionPaise(100, 0, -10000)).toBeGreaterThanOrEqual(0);
  });

  it('computes flat-only commission', () => {
    expect(computeCommissionPaise(100000, 0, 2500)).toBe(2500);
  });

  it('handles 100% commission (10000 bps)', () => {
    expect(computeCommissionPaise(100000, 10000, 0)).toBe(100000);
  });
});

describe('pickCommissionRule', () => {
  const makeRule = (rentalType: string | null, percentBps = 1000, flatPaise = 0) => ({
    id: 'r1',
    partnerId: 'p1',
    rentalType,
    percentBps,
    flatPaise,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  it('returns exact rental type match', () => {
    const rules = [makeRule('AIRPORT', 500), makeRule('SELF_DRIVE', 1000)];
    const result = pickCommissionRule(rules as any, 'AIRPORT' as any);
    expect(result?.percentBps).toBe(500);
  });

  it('falls back to null rentalType rule', () => {
    const rules = [makeRule(null, 800), makeRule('SELF_DRIVE', 1000)];
    const result = pickCommissionRule(rules as any, 'AIRPORT' as any);
    expect(result?.percentBps).toBe(800);
  });

  it('returns specific match before null-rentalType fallback', () => {
    const rules = [makeRule(null, 800), makeRule('AIRPORT', 500)];
    const result = pickCommissionRule(rules as any, 'AIRPORT' as any);
    expect(result?.percentBps).toBe(500);
  });

  it('returns null when rules array is empty', () => {
    expect(pickCommissionRule([], 'SELF_DRIVE' as any)).toBeNull();
  });

  it('returns null when no match and no fallback', () => {
    const rules = [makeRule('SELF_DRIVE', 1000)];
    const result = pickCommissionRule(rules as any, 'AIRPORT' as any);
    expect(result).toBeNull();
  });
});

describe('parseBank', () => {
  it('extracts accountName, accountNumber, and uppercased IFSC', () => {
    const raw = { accountName: 'John Doe', accountNumber: '1234567890', ifsc: 'sbin0001234' };
    const result = parseBank(raw);
    expect(result.accountName).toBe('John Doe');
    expect(result.accountNumber).toBe('1234567890');
    expect(result.ifsc).toBe('SBIN0001234');
  });

  it('returns empty object for null', () => {
    expect(parseBank(null)).toEqual({});
  });

  it('returns empty object for non-object', () => {
    expect(parseBank('string')).toEqual({});
    expect(parseBank(42)).toEqual({});
    expect(parseBank([])).toEqual({});
  });

  it('returns undefined for missing fields', () => {
    const result = parseBank({ accountName: 'John' });
    expect(result.accountNumber).toBeUndefined();
    expect(result.ifsc).toBeUndefined();
  });

  it('trims whitespace from values', () => {
    const result = parseBank({ accountName: '  Jane  ', accountNumber: '  9876  ', ifsc: '  hdfc0000001  ' });
    expect(result.accountName).toBe('Jane');
    expect(result.ifsc).toBe('HDFC0000001');
  });
});

describe('hasPayoutBank', () => {
  it('returns true when all required fields are present', () => {
    const raw = { accountName: 'Jane', accountNumber: '123', ifsc: 'HDFC0001234' };
    expect(hasPayoutBank(raw)).toBe(true);
  });

  it('returns false when IFSC is missing', () => {
    const raw = { accountName: 'Jane', accountNumber: '123' };
    expect(hasPayoutBank(raw)).toBe(false);
  });

  it('returns false when accountNumber is missing', () => {
    const raw = { accountName: 'Jane', ifsc: 'HDFC0001234' };
    expect(hasPayoutBank(raw)).toBe(false);
  });

  it('returns false for null input', () => {
    expect(hasPayoutBank(null)).toBe(false);
  });

  it('returns false for empty object', () => {
    expect(hasPayoutBank({})).toBe(false);
  });
});
