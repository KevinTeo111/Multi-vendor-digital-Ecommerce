/**
 * Coupon arithmetic, pure so every rule can be unit-tested. Amounts are integer cents.
 *
 * - Scope: a coupon applies to every line, to one seller's lines, or to one product.
 * - Discount: PERCENT (basis points of the eligible lines) or FIXED (cents, at most their total).
 * - Mercado Pago cannot charge zero: the order keeps at least MIN_CHARGE_CENTS and every line
 *   keeps at least 1 cent.
 * - Funding: a platform coupon comes out of the platform commission (it can go below zero, the
 *   platform pays the difference); a seller coupon comes out of that seller's net, never below 0.
 * - After applying: paid = priceCents - discountCents = fee + commission + net, on every line.
 */

export const MIN_CHARGE_CENTS = 100;
const BPS = 10_000;

export interface CouponTerms {
  type: 'PERCENT' | 'FIXED';
  value: number;
  vendorId: string | null;
  productId: string | null;
  minOrderCents: number | null;
  sellerFunded: boolean;
}

export interface SaleLine {
  productId: string;
  vendorId: string;
  priceCents: number;
  gatewayFeeCents: number;
  commissionCents: number;
  vendorNetCents: number;
}

export type CouponRefusal = 'min_order' | 'not_applicable';

export type CouponOutcome<L extends SaleLine> =
  | { ok: true; discountCents: number; lines: Array<L & { discountCents: number }> }
  | { ok: false; reason: CouponRefusal };

export function applyCoupon<L extends SaleLine>(lines: L[], terms: CouponTerms): CouponOutcome<L> {
  const subtotal = lines.reduce((s, l) => s + l.priceCents, 0);
  if (terms.minOrderCents !== null && subtotal < terms.minOrderCents)
    return { ok: false, reason: 'min_order' };

  const eligible = lines
    .map((line, index) => ({ line, index }))
    .filter(
      ({ line }) =>
        line.priceCents > 0 &&
        (terms.productId === null || line.productId === terms.productId) &&
        (terms.vendorId === null || line.vendorId === terms.vendorId),
    );
  const eligibleTotal = eligible.reduce((s, e) => s + e.line.priceCents, 0);
  if (eligibleTotal === 0) return { ok: false, reason: 'not_applicable' };

  const raw =
    terms.type === 'PERCENT'
      ? Math.floor((eligibleTotal * terms.value + BPS / 2) / BPS)
      : Math.min(terms.value, eligibleTotal);
  const target = Math.max(0, Math.min(raw, subtotal - MIN_CHARGE_CENTS));

  // Spread over the eligible lines in proportion to their price (largest remainder, exact cents).
  const shares = eligible.map(({ line, index }) => {
    const exact = (target * line.priceCents) / eligibleTotal;
    return { index, cents: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let left = target - shares.reduce((s, x) => s + x.cents, 0);
  for (const share of [...shares].sort((a, b) => b.remainder - a.remainder)) {
    if (left === 0) break;
    share.cents += 1;
    left -= 1;
  }

  const discounts = new Map<number, number>();
  for (const { index, cents } of shares) {
    const line = lines[index];
    let capped = Math.min(cents, line.priceCents - 1);
    if (terms.sellerFunded) capped = Math.min(capped, line.vendorNetCents);
    if (capped > 0) discounts.set(index, capped);
  }
  const discountCents = [...discounts.values()].reduce((s, d) => s + d, 0);
  if (discountCents === 0) return { ok: false, reason: 'not_applicable' };

  return {
    ok: true,
    discountCents,
    lines: lines.map((line, index) => {
      const d = discounts.get(index) ?? 0;
      return {
        ...line,
        discountCents: d,
        commissionCents: terms.sellerFunded ? line.commissionCents : line.commissionCents - d,
        vendorNetCents: terms.sellerFunded ? line.vendorNetCents - d : line.vendorNetCents,
      };
    }),
  };
}

/** Lines without a coupon, in the same shape. */
export function withoutCoupon<L extends SaleLine>(lines: L[]) {
  return lines.map((line) => ({ ...line, discountCents: 0 }));
}
