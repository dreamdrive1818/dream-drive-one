// Tests for CatalogService.sortResults — pure in-memory function

jest.mock('../../lib/prisma', () => ({
  prisma: {
    carModel: { findMany: jest.fn(), findUnique: jest.fn() },
    catalogSettings: { upsert: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    booking: { groupBy: jest.fn() },
    availabilityBlock: { findMany: jest.fn() },
    vehicle: { findFirst: jest.fn(), count: jest.fn() },
  },
}));

import { CatalogService } from '../../modules/catalog/catalog.service';

describe('CatalogService.sortResults', () => {
  const svc = new CatalogService();

  const items = [
    { featured: false, pricePaise: 300000, bookingCount: 5, name: 'C' },
    { featured: true, pricePaise: 200000, bookingCount: 10, name: 'B' },
    { featured: false, pricePaise: 100000, bookingCount: 2, name: 'A' },
  ];

  it('sorts by price ascending (price-asc)', () => {
    const result = svc.sortResults(items, 'price-asc');
    expect(result[0].pricePaise).toBe(100000);
    expect(result[1].pricePaise).toBe(200000);
    expect(result[2].pricePaise).toBe(300000);
  });

  it('sorts by price descending (price-desc)', () => {
    const result = svc.sortResults(items, 'price-desc');
    expect(result[0].pricePaise).toBe(300000);
    expect(result[1].pricePaise).toBe(200000);
    expect(result[2].pricePaise).toBe(100000);
  });

  it('sorts by popularity (bookingCount desc)', () => {
    const result = svc.sortResults(items, 'popularity');
    expect(result[0].bookingCount).toBe(10);
    expect(result[1].bookingCount).toBe(5);
    expect(result[2].bookingCount).toBe(2);
  });

  it('puts featured cars first when no sort is specified', () => {
    const result = svc.sortResults(items, undefined);
    expect(result.map((car) => car.name)).toEqual(['B', 'C', 'A']);
  });

  it('puts available cars before unavailable cars', () => {
    const mixed = [
      { name: 'Unavailable featured', available: false, featured: true, pricePaise: 100000 },
      { name: 'Available', available: true, featured: false, pricePaise: 300000 },
      { name: 'Available featured', available: true, featured: true, pricePaise: 200000 },
    ];
    const result = svc.sortResults(mixed, undefined);
    expect(result.map((car) => car.name)).toEqual([
      'Available featured',
      'Available',
      'Unavailable featured',
    ]);
  });

  it('keeps available cars first when sorting by price', () => {
    const mixed = [
      { name: 'Cheap unavailable', available: false, pricePaise: 100000 },
      { name: 'Costly available', available: true, pricePaise: 300000 },
    ];
    const result = svc.sortResults(mixed, 'price-asc');
    expect(result.map((car) => car.name)).toEqual(['Costly available', 'Cheap unavailable']);
  });

  it('does not mutate the original array', () => {
    const original = [...items];
    svc.sortResults(items, 'price-asc');
    expect(items[0].name).toBe(original[0].name);
  });

  it('returns empty array for empty input', () => {
    const result = svc.sortResults([], 'price-asc');
    expect(result).toEqual([]);
  });
});
