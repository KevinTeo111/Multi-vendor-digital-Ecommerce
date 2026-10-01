/**
 * Live price preview for the seller form. Mirrors listPriceCents / calculateCommissionCents in
 * packages/shared, which Vercel does not build; the API recomputes and stores the real values.
 */
const BPS = 10_000;

/** Listed price with the provider fee built in: ceil(seller price / (1 - fee)). */
export function listPriceCents(baseCents: number, feeBps: number): number {
  const keep = BPS - feeBps;
  return Math.floor((baseCents * BPS + keep - 1) / keep);
}

/** What the seller keeps from their own price after the platform commission. */
export function sellerNetCents(baseCents: number, commissionBps: number): number {
  return baseCents - Math.floor((baseCents * commissionBps + BPS / 2) / BPS);
}
