import {
  calculateCommissionCents,
  listPriceCents,
  splitSale,
  splitSaleWithFee,
} from '@marketplace/shared';

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

describe('fee-inclusive pricing', () => {
  it('builds the provider fee into the listed price, rounding up to the cent', () => {
    expect(listPriceCents(2_500, 500)).toBe(2_632); // R$25,00 / 0.95 = 26,3157… → 26,32
    expect(listPriceCents(10_000, 499)).toBe(10_526); // 100 / 0.9501 = 105,2520… → 105,26
    expect(listPriceCents(0, 499)).toBe(0); // free stays free
  });

  it('leaves prices untouched while the fee is 0', () => {
    expect(listPriceCents(4_990, 0)).toBe(4_990);
  });

  it('always leaves at least the seller price after the fee is taken', () => {
    for (const fee of [99, 199, 349, 499, 799, 2_000])
      for (const base of [1, 99, 1_000, 2_500, 9_999, 123_457]) {
        const list = listPriceCents(base, fee);
        const feeCharged = Math.round((list * fee) / 10_000);
        expect(list - feeCharged).toBeGreaterThanOrEqual(base - 1); // provider rounding: ±1 cent
      }
  });

  it('refuses fees above 20% and malformed values', () => {
    expect(() => listPriceCents(1_000, 2_001)).toThrow();
    expect(() => listPriceCents(1_000, -1)).toThrow();
    expect(() => listPriceCents(10.5, 100)).toThrow();
  });

  it('splits a sale so fee reserve + commission + seller net = what the buyer paid', () => {
    const price = listPriceCents(2_500, 500);
    const split = splitSaleWithFee(price, 2_500, 2_000);
    expect(split).toEqual({ gatewayFeeCents: 132, commissionCents: 500, vendorNetCents: 2_000 });
    expect(split.gatewayFeeCents + split.commissionCents + split.vendorNetCents).toBe(price);
  });

  it('matches the old split exactly when there is no fee', () => {
    expect(splitSaleWithFee(4_990, 4_990, 2_000)).toEqual({
      gatewayFeeCents: 0,
      ...splitSale(4_990, 2_000),
    });
  });

  it('refuses a seller price above the listed price', () => {
    expect(() => splitSaleWithFee(1_000, 1_001, 2_000)).toThrow();
  });
});
