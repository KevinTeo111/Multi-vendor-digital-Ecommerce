import { applyCoupon, MIN_CHARGE_CENTS, type CouponTerms, type SaleLine } from './coupon-math';

const line = (productId: string, vendorId: string, price: number): SaleLine => {
  // 5% fee reserve, 20% commission on the rest, the seller keeps the remainder.
  const fee = Math.round(price * 0.05);
  const commission = Math.round((price - fee) * 0.2);
  return {
    productId,
    vendorId,
    priceCents: price,
    gatewayFeeCents: fee,
    commissionCents: commission,
    vendorNetCents: price - fee - commission,
  };
};
const terms = (t: Partial<CouponTerms>): CouponTerms => ({
  type: 'PERCENT',
  value: 1_000,
  vendorId: null,
  productId: null,
  minOrderCents: null,
  sellerFunded: false,
  ...t,
});
const invariant = (lines: Array<SaleLine & { discountCents: number }>) =>
  lines.every(
    (l) =>
      l.priceCents - l.discountCents === l.gatewayFeeCents + l.commissionCents + l.vendorNetCents,
  );

describe('applyCoupon', () => {
  const cart = [line('p1', 'v1', 10_000), line('p2', 'v2', 5_000)];

  it('applies a platform percentage to every line and takes it from the commission', () => {
    const out = applyCoupon(cart, terms({ value: 1_000 }));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.discountCents).toBe(1_500);
    expect(out.lines.map((l) => l.discountCents)).toEqual([1_000, 500]);
    expect(out.lines[0].vendorNetCents).toBe(cart[0].vendorNetCents); // seller untouched
    expect(out.lines[0].commissionCents).toBe(cart[0].commissionCents - 1_000);
    expect(invariant(out.lines)).toBe(true);
  });

  it('scopes to one seller or one product', () => {
    const bySeller = applyCoupon(cart, terms({ vendorId: 'v2', value: 2_000 }));
    expect(bySeller.ok && bySeller.lines.map((l) => l.discountCents)).toEqual([0, 1_000]);
    const byProduct = applyCoupon(cart, terms({ productId: 'p1', type: 'FIXED', value: 700 }));
    expect(byProduct.ok && byProduct.lines.map((l) => l.discountCents)).toEqual([700, 0]);
    expect(applyCoupon(cart, terms({ productId: 'other' }))).toEqual({
      ok: false,
      reason: 'not_applicable',
    });
  });

  it('spreads a fixed amount exactly, in proportion to price', () => {
    const out = applyCoupon(
      [line('a', 'v', 3_333), line('b', 'v', 3_333), line('c', 'v', 3_334)],
      terms({ type: 'FIXED', value: 1_000 }),
    );
    expect(out.ok && out.discountCents).toBe(1_000);
    expect(out.ok && out.lines.reduce((s, l) => s + l.discountCents, 0)).toBe(1_000);
  });

  it('takes a seller coupon from the seller, never below zero', () => {
    const out = applyCoupon(cart, terms({ vendorId: 'v1', sellerFunded: true, value: 10_000 }));
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.lines[0].vendorNetCents).toBe(0);
    expect(out.lines[0].discountCents).toBe(cart[0].vendorNetCents);
    expect(out.lines[0].commissionCents).toBe(cart[0].commissionCents); // platform untouched
    expect(invariant(out.lines)).toBe(true);
  });

  it('never brings the order below the minimum charge', () => {
    const out = applyCoupon([line('p', 'v', 2_000)], terms({ value: 10_000 }));
    expect(out.ok && 2_000 - out.discountCents).toBe(MIN_CHARGE_CENTS);
    expect(applyCoupon([line('p', 'v', MIN_CHARGE_CENTS)], terms({}))).toEqual({
      ok: false,
      reason: 'not_applicable',
    });
  });

  it('enforces the minimum order value on the whole cart', () => {
    expect(applyCoupon(cart, terms({ minOrderCents: 20_000 }))).toEqual({
      ok: false,
      reason: 'min_order',
    });
    expect(applyCoupon(cart, terms({ minOrderCents: 15_000 })).ok).toBe(true);
  });
});
