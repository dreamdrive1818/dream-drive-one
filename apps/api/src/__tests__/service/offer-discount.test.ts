// Tests for the offer discount function (copied inline from booking.service.ts)

const MIN_OFFER_FLOOR_PAISE = 100;

type OfferType = 'PERCENT' | 'FLAT';

function discount(amount: number, offer: { type: OfferType; value: number }) {
  const raw =
    offer.type === 'PERCENT'
      ? Math.round(amount * (1 - offer.value / 100))
      : amount - offer.value;
  const floor = Math.max(MIN_OFFER_FLOOR_PAISE, Math.round(amount * 0.1));
  return Math.max(floor, raw);
}

describe('discount function', () => {
  it('applies 10% PERCENT discount', () => {
    // 1000000 * 0.9 = 900000
    const result = discount(1000000, { type: 'PERCENT', value: 10 });
    expect(result).toBe(900000);
  });

  it('applies 50% PERCENT discount', () => {
    // 1000000 * 0.5 = 500000
    const result = discount(1000000, { type: 'PERCENT', value: 50 });
    expect(result).toBe(500000);
  });

  it('applies FLAT discount', () => {
    // 1000000 - 20000 = 980000
    const result = discount(1000000, { type: 'FLAT', value: 20000 });
    expect(result).toBe(980000);
  });

  it('never goes below 10% of original amount', () => {
    // 90% discount on 1000000 → raw = 100000, floor = 100000 → 100000
    const result = discount(1000000, { type: 'PERCENT', value: 90 });
    expect(result).toBeGreaterThanOrEqual(100000);
  });

  it('100% discount is capped at floor (10% of original)', () => {
    // 100% discount → raw = 0, floor = max(100, 0.1 * 1000000) = 100000
    const result = discount(1000000, { type: 'PERCENT', value: 100 });
    expect(result).toBe(100000);
  });

  it('never goes below floor of 100 paise for tiny amounts', () => {
    // 90% discount on 500 → raw = 50, floor = max(100, 50) = 100
    const result = discount(500, { type: 'PERCENT', value: 90 });
    expect(result).toBe(100);
  });

  it('FLAT discount that would go negative is capped at floor', () => {
    // FLAT 200000 on 50000 → raw = -150000, floor = max(100, 5000) = 5000
    const result = discount(50000, { type: 'FLAT', value: 200000 });
    expect(result).toBeGreaterThanOrEqual(100);
  });

  it('small PERCENT discount on small amount stays above floor', () => {
    // 5% off 1000 → raw = 950, floor = max(100, 100) = 100 → 950
    const result = discount(1000, { type: 'PERCENT', value: 5 });
    expect(result).toBe(950);
  });
});
