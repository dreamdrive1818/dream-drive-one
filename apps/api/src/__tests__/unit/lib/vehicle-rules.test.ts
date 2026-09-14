// Pure-function tests for vehicle-rules.ts
// No DB/prisma needed for these pure functions

import {
  normalizeRegistration,
  normalizeDocKind,
  normalizeDriverDocKind,
  parseExpiry,
  insuranceCovers,
  dlCovers,
  normalizeDriverPhone,
  bookingInScope,
} from '../../../lib/vehicle-rules';

// Stub out prisma so the module can be loaded without a DB connection
jest.mock('../../../lib/prisma', () => ({
  prisma: {},
}));

describe('normalizeRegistration', () => {
  it('uppercases the input', () => {
    expect(normalizeRegistration('mh12ab1234')).toBe('MH12AB1234');
  });

  it('strips internal spaces', () => {
    expect(normalizeRegistration('MH 12 AB 1234')).toBe('MH12AB1234');
  });

  it('trims leading/trailing whitespace', () => {
    expect(normalizeRegistration('  KA01MH2020  ')).toBe('KA01MH2020');
  });

  it('handles empty string', () => {
    expect(normalizeRegistration('')).toBe('');
  });
});

describe('normalizeDocKind', () => {
  it('converts RC_BOOK to RC', () => {
    expect(normalizeDocKind('RC_BOOK')).toBe('RC');
  });

  it('converts REGISTRATION to RC', () => {
    expect(normalizeDocKind('registration')).toBe('RC');
  });

  it('converts INS to INSURANCE', () => {
    expect(normalizeDocKind('INS')).toBe('INSURANCE');
  });

  it('converts POLLUTION to PUC', () => {
    expect(normalizeDocKind('POLLUTION')).toBe('PUC');
  });

  it('passes through already-normalized kind', () => {
    expect(normalizeDocKind('FITNESS')).toBe('FITNESS');
  });
});

describe('normalizeDriverDocKind', () => {
  it('converts LICENCE to DL', () => {
    expect(normalizeDriverDocKind('LICENCE')).toBe('DL');
  });

  it('converts DRIVING_LICENSE to DL', () => {
    expect(normalizeDriverDocKind('DRIVING_LICENSE')).toBe('DL');
  });

  it('converts BADGE_NUMBER to BADGE', () => {
    expect(normalizeDriverDocKind('BADGE_NUMBER')).toBe('BADGE');
  });

  it('converts AADHAAR to ID', () => {
    expect(normalizeDriverDocKind('AADHAAR')).toBe('ID');
  });

  it('passes through POLICE_VERIFICATION', () => {
    expect(normalizeDriverDocKind('PV')).toBe('POLICE_VERIFICATION');
  });
});

describe('parseExpiry', () => {
  it('returns null for null input', () => {
    expect(parseExpiry(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseExpiry('')).toBeNull();
  });

  it('passes through a Date object', () => {
    const d = new Date('2025-12-31T00:00:00.000Z');
    expect(parseExpiry(d)).toBe(d);
  });

  it('parses YYYY-MM-DD and sets end of day UTC', () => {
    const result = parseExpiry('2025-06-15');
    expect(result).not.toBeNull();
    expect(result!.getUTCHours()).toBe(23);
    expect(result!.getUTCMinutes()).toBe(59);
    expect(result!.getUTCSeconds()).toBe(59);
  });

  it('parses a full ISO string', () => {
    const iso = '2025-10-01T10:30:00Z';
    const result = parseExpiry(iso);
    expect(result).not.toBeNull();
    expect(result!.toISOString()).toBe(new Date(iso).toISOString());
  });

  it('throws BadRequestException for invalid date', () => {
    expect(() => parseExpiry('not-a-date')).toThrow();
  });
});

describe('insuranceCovers', () => {
  const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365); // 1 year from now
  const past = new Date(Date.now() - 1000);

  it('returns true when valid INSURANCE doc covers the date', () => {
    const docs = [{ kind: 'INSURANCE', expiresAt: future }];
    expect(insuranceCovers(docs, new Date())).toBe(true);
  });

  it('returns false when INSURANCE doc is expired', () => {
    const docs = [{ kind: 'INSURANCE', expiresAt: past }];
    expect(insuranceCovers(docs, new Date())).toBe(false);
  });

  it('returns false when no INSURANCE doc exists', () => {
    const docs = [{ kind: 'RC', expiresAt: future }];
    expect(insuranceCovers(docs, new Date())).toBe(false);
  });

  it('normalizes INS kind to INSURANCE', () => {
    const docs = [{ kind: 'INS', expiresAt: future }];
    expect(insuranceCovers(docs, new Date())).toBe(true);
  });
});

describe('dlCovers', () => {
  const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
  const past = new Date(Date.now() - 1000);

  it('returns true when valid DL covers the date', () => {
    const docs = [{ kind: 'DL', expiresAt: future }];
    expect(dlCovers(docs, new Date())).toBe(true);
  });

  it('returns false when DL is expired', () => {
    const docs = [{ kind: 'DL', expiresAt: past }];
    expect(dlCovers(docs, new Date())).toBe(false);
  });

  it('normalizes LICENCE to DL', () => {
    const docs = [{ kind: 'LICENCE', expiresAt: future }];
    expect(dlCovers(docs, new Date())).toBe(true);
  });
});

describe('normalizeDriverPhone', () => {
  it('strips +91 prefix', () => {
    expect(normalizeDriverPhone('+919876543210')).toBe('9876543210');
  });

  it('strips leading 0', () => {
    expect(normalizeDriverPhone('09876543210')).toBe('9876543210');
  });

  it('accepts plain 10-digit number', () => {
    expect(normalizeDriverPhone('9876543210')).toBe('9876543210');
  });

  it('strips country code without plus', () => {
    expect(normalizeDriverPhone('919876543210')).toBe('9876543210');
  });

  it('throws for invalid number (too short)', () => {
    expect(() => normalizeDriverPhone('12345')).toThrow();
  });

  it('throws for number starting with invalid digit', () => {
    expect(() => normalizeDriverPhone('1234567890')).toThrow();
  });
});

describe('bookingInScope', () => {
  const makeUser = (overrides = {}) => ({
    id: 'user-1',
    email: 'admin@test.com',
    roles: ['SUPER_ADMIN'],
    cityId: null,
    branchId: null,
    assignedCityId: null,
    assignedBranchId: null,
    ...overrides,
  });

  it('returns true for super admin with no cityId/branchId', () => {
    const user = makeUser({ roles: ['SUPER_ADMIN'] });
    const booking = { pickupBranchId: 'branch-1', pickupBranch: { cityId: 'city-1' } };
    expect(bookingInScope(user as any, booking)).toBe(true);
  });

  it('returns false for non-super user with no cityId/branchId', () => {
    const user = makeUser({ roles: ['CUSTOMER'] });
    const booking = { pickupBranchId: 'branch-1', pickupBranch: { cityId: 'city-1' } };
    expect(bookingInScope(user as any, booking)).toBe(false);
  });

  it('returns true when branchId matches', () => {
    const user = makeUser({ roles: ['BRANCH_MANAGER'], branchId: 'branch-1' });
    const booking = { pickupBranchId: 'branch-1', pickupBranch: { cityId: 'city-1' } };
    expect(bookingInScope(user as any, booking)).toBe(true);
  });

  it('returns false when branchId does not match', () => {
    const user = makeUser({ roles: ['BRANCH_MANAGER'], branchId: 'branch-2' });
    const booking = { pickupBranchId: 'branch-1', pickupBranch: { cityId: 'city-1' } };
    expect(bookingInScope(user as any, booking)).toBe(false);
  });

  it('returns true when cityId matches booking branch cityId', () => {
    const user = makeUser({ roles: ['CITY_MANAGER'], cityId: 'city-1' });
    const booking = { pickupBranchId: 'branch-1', pickupBranch: { cityId: 'city-1' } };
    expect(bookingInScope(user as any, booking)).toBe(true);
  });

  it('returns false when cityId does not match booking branch cityId', () => {
    const user = makeUser({ roles: ['CITY_MANAGER'], cityId: 'city-2' });
    const booking = { pickupBranchId: 'branch-1', pickupBranch: { cityId: 'city-1' } };
    expect(bookingInScope(user as any, booking)).toBe(false);
  });
});
