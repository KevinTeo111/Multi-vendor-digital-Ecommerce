import { randomBytes } from 'node:crypto';

/** 64 random bits shown as XXXX-XXXX-XXXX-XXXX; unique per purchased item (DB-enforced). */
export function generatePurchaseCode(): string {
  const hex = randomBytes(8).toString('hex').toUpperCase();
  return hex.match(/.{4}/g)!.join('-');
}

/** Accepts codes typed with spaces, lower case or without dashes. */
export function normalizePurchaseCode(input: string): string {
  const hex = input.toUpperCase().replace(/[^0-9A-F]/g, '');
  return hex.length === 16 ? hex.match(/.{4}/g)!.join('-') : input.trim().toUpperCase();
}
