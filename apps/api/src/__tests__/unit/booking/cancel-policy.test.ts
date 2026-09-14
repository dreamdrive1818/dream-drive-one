// Tests for the cancel policy logic extracted from booking.service.ts

type PolicyBand = { hours: number; refundPct: number };

const CANCEL_POLICY: Record<string, PolicyBand[]> = {
  SELF_DRIVE: [
    { hours: 48, refundPct: 100 },
    { hours: 24, refundPct: 50 },
    { hours: 0, refundPct: 0 },
  ],
  WITH_DRIVER_LOCAL: [
    { hours: 24, refundPct: 100 },
    { hours: 6, refundPct: 50 },
    { hours: 0, refundPct: 0 },
  ],
  WITH_DRIVER_INTERCITY: [
    { hours: 48, refundPct: 100 },
    { hours: 12, refundPct: 50 },
    { hours: 0, refundPct: 0 },
  ],
  AIRPORT: [
    { hours: 12, refundPct: 100 },
    { hours: 3, refundPct: 50 },
    { hours: 0, refundPct: 0 },
  ],
};

function cancelPolicy(rentalType: string, startsAt: Date, cancelledAt: Date = new Date()) {
  const hoursBefore = (startsAt.getTime() - cancelledAt.getTime()) / 3_600_000;
  const bands = CANCEL_POLICY[rentalType] ?? CANCEL_POLICY.SELF_DRIVE;
  const band = bands.find((b) => hoursBefore >= b.hours) ?? bands[bands.length - 1];
  return { hoursBefore, refundPct: band.refundPct };
}

function hoursFromNow(hours: number, base: Date = new Date()): Date {
  return new Date(base.getTime() + hours * 3_600_000);
}

describe('SELF_DRIVE cancel policy', () => {
  it('72h before start → 100% refund', () => {
    const base = new Date();
    const startsAt = hoursFromNow(72, base);
    const { refundPct } = cancelPolicy('SELF_DRIVE', startsAt, base);
    expect(refundPct).toBe(100);
  });

  it('exactly 48h before start → 100% refund (boundary)', () => {
    const base = new Date();
    const startsAt = hoursFromNow(48, base);
    const { refundPct } = cancelPolicy('SELF_DRIVE', startsAt, base);
    expect(refundPct).toBe(100);
  });

  it('30h before start → 50% refund', () => {
    const base = new Date();
    const startsAt = hoursFromNow(30, base);
    const { refundPct } = cancelPolicy('SELF_DRIVE', startsAt, base);
    expect(refundPct).toBe(50);
  });

  it('exactly 24h before start → 50% refund (boundary)', () => {
    const base = new Date();
    const startsAt = hoursFromNow(24, base);
    const { refundPct } = cancelPolicy('SELF_DRIVE', startsAt, base);
    expect(refundPct).toBe(50);
  });

  it('2h before start → 0% refund', () => {
    const base = new Date();
    const startsAt = hoursFromNow(2, base);
    const { refundPct } = cancelPolicy('SELF_DRIVE', startsAt, base);
    expect(refundPct).toBe(0);
  });

  it('after trip start → 0% refund (negative hours)', () => {
    const base = new Date();
    const startsAt = hoursFromNow(-5, base); // already started
    const { refundPct } = cancelPolicy('SELF_DRIVE', startsAt, base);
    expect(refundPct).toBe(0);
  });
});

describe('AIRPORT cancel policy', () => {
  it('15h before start → 100% refund', () => {
    const base = new Date();
    const startsAt = hoursFromNow(15, base);
    const { refundPct } = cancelPolicy('AIRPORT', startsAt, base);
    expect(refundPct).toBe(100);
  });

  it('exactly 12h before start → 100% refund (boundary)', () => {
    const base = new Date();
    const startsAt = hoursFromNow(12, base);
    const { refundPct } = cancelPolicy('AIRPORT', startsAt, base);
    expect(refundPct).toBe(100);
  });

  it('5h before start → 50% refund', () => {
    const base = new Date();
    const startsAt = hoursFromNow(5, base);
    const { refundPct } = cancelPolicy('AIRPORT', startsAt, base);
    expect(refundPct).toBe(50);
  });

  it('exactly 3h before start → 50% refund (boundary)', () => {
    const base = new Date();
    const startsAt = hoursFromNow(3, base);
    const { refundPct } = cancelPolicy('AIRPORT', startsAt, base);
    expect(refundPct).toBe(50);
  });

  it('1h before start → 0% refund', () => {
    const base = new Date();
    const startsAt = hoursFromNow(1, base);
    const { refundPct } = cancelPolicy('AIRPORT', startsAt, base);
    expect(refundPct).toBe(0);
  });
});

describe('refund amount calculation', () => {
  it('50% refund on 500000 paise = 250000 paise returned', () => {
    const totalPaid = 500000;
    const refundPct = 50;
    const refundPaise = Math.round((totalPaid * refundPct) / 100);
    expect(refundPaise).toBe(250000);
  });

  it('100% refund returns full amount', () => {
    const totalPaid = 750000;
    const refundPct = 100;
    const refundPaise = Math.round((totalPaid * refundPct) / 100);
    expect(refundPaise).toBe(750000);
  });

  it('0% refund returns 0', () => {
    const totalPaid = 500000;
    const refundPct = 0;
    const refundPaise = Math.round((totalPaid * refundPct) / 100);
    expect(refundPaise).toBe(0);
  });
});
