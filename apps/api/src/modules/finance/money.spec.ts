import { calculateCommissionCents, splitSale } from '@marketplace/shared';

describe('commission math', () => {
  it('computes a whole-percent commission exactly', () => {
    expect(calculateCommissionCents(10_000, 2_000)).toBe(2_000); // 20% of R$100
  });

  it('rounds half-up to whole cents', () => {
    // 1 cent * 5000 bps = 0.5 cent -> rounds to 1
    expect(calculateCommissionCents(1, 5_000)).toBe(1);
    // 3 cents * 3333 bps = 0.9999 -> 1
    expect(calculateCommissionCents(3, 3_333)).toBe(1);
    // 999 cents * 1000 bps = 99.9 -> 100
    expect(calculateCommissionCents(999, 1_000)).toBe(100);
  });

  it('handles 0% and 100%', () => {
    expect(calculateCommissionCents(4_990, 0)).toBe(0);
    expect(calculateCommissionCents(4_990, 10_000)).toBe(4_990);
  });

  it('never lets commission + net differ from gross', () => {
    for (const gross of [1, 7, 99, 1_234, 99_999]) {
      for (const bps of [0, 1, 333, 1_500, 2_000, 9_999, 10_000]) {
        const { commissionCents, vendorNetCents } = splitSale(gross, bps);
        expect(commissionCents + vendorNetCents).toBe(gross);
        expect(commissionCents).toBeGreaterThanOrEqual(0);
        expect(vendorNetCents).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('rejects non-integer or out-of-range input', () => {
    expect(() => calculateCommissionCents(10.5, 1_000)).toThrow();
    expect(() => calculateCommissionCents(-1, 1_000)).toThrow();
    expect(() => calculateCommissionCents(100, 10_001)).toThrow();
    expect(() => calculateCommissionCents(100, -1)).toThrow();
  });
});
