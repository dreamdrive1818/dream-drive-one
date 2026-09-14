// Tests for indianFyLabel — a pure function with no DB dependency

jest.mock('../../../lib/prisma', () => ({
  prisma: {
    invoiceSeries: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}));

import { indianFyLabel } from '../../../lib/invoice-series';

describe('indianFyLabel', () => {
  it('May 2026 returns FY2627', () => {
    expect(indianFyLabel(new Date('2026-05-15T08:00:00+05:30'))).toBe('FY2627');
  });

  it('March 2026 returns FY2526 (before new FY)', () => {
    expect(indianFyLabel(new Date('2026-03-31T08:00:00+05:30'))).toBe('FY2526');
  });

  it('April 1 2026 returns FY2627 (new FY starts in April)', () => {
    expect(indianFyLabel(new Date('2026-04-01T08:00:00+05:30'))).toBe('FY2627');
  });

  it('January 2027 returns FY2627', () => {
    expect(indianFyLabel(new Date('2027-01-10T08:00:00+05:30'))).toBe('FY2627');
  });

  it('December 2026 returns FY2627', () => {
    expect(indianFyLabel(new Date('2026-12-25T08:00:00+05:30'))).toBe('FY2627');
  });

  it('April 2025 returns FY2526', () => {
    expect(indianFyLabel(new Date('2025-04-01T08:00:00+05:30'))).toBe('FY2526');
  });

  it('March 2025 returns FY2425', () => {
    expect(indianFyLabel(new Date('2025-03-15T08:00:00+05:30'))).toBe('FY2425');
  });
});
