// Shared constants and types used by both the API and the web app.
// Keep this package dependency-free.

export const SETTING_KEYS = {
  SITE_NAME: 'site.name',
  SITE_CURRENCY: 'site.currency',
  MIN_WITHDRAWAL_CENTS: 'finance.min_withdrawal_cents',
  PENDING_HOLD_DAYS: 'finance.pending_hold_days',
  DEFAULT_COMMISSION_BPS: 'finance.default_commission_bps',
  MAX_UPLOAD_MB: 'products.max_upload_mb',
  ALLOWED_FILE_EXTENSIONS: 'products.allowed_file_extensions',
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export interface SettingDefaults {
  [SETTING_KEYS.SITE_NAME]: string;
  [SETTING_KEYS.SITE_CURRENCY]: string;
  [SETTING_KEYS.MIN_WITHDRAWAL_CENTS]: number;
  [SETTING_KEYS.PENDING_HOLD_DAYS]: number;
  [SETTING_KEYS.DEFAULT_COMMISSION_BPS]: number;
  [SETTING_KEYS.MAX_UPLOAD_MB]: number;
  [SETTING_KEYS.ALLOWED_FILE_EXTENSIONS]: string[];
}

export const SETTING_DEFAULTS: SettingDefaults = {
  [SETTING_KEYS.SITE_NAME]: 'Digital Marketplace',
  [SETTING_KEYS.SITE_CURRENCY]: 'BRL',
  [SETTING_KEYS.MIN_WITHDRAWAL_CENTS]: 10_000, // R$ 100,00
  [SETTING_KEYS.PENDING_HOLD_DAYS]: 7,
  [SETTING_KEYS.DEFAULT_COMMISSION_BPS]: 2_000, // 20%
  [SETTING_KEYS.MAX_UPLOAD_MB]: 500,
  [SETTING_KEYS.ALLOWED_FILE_EXTENSIONS]: ['zip', 'rar', '7z', 'pdf', 'epub', 'mp4', 'mp3'],
};

/** 1% = 100 basis points. */
export const BPS_DENOMINATOR = 10_000;

/** Platform commission on a gross amount, rounded half-up to whole cents. */
export function calculateCommissionCents(grossCents: number, rateBps: number): number {
  if (!Number.isInteger(grossCents) || grossCents < 0) {
    throw new Error('grossCents must be a non-negative integer');
  }
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > BPS_DENOMINATOR) {
    throw new Error('rateBps must be an integer between 0 and 10000');
  }
  return Math.floor((grossCents * rateBps + BPS_DENOMINATOR / 2) / BPS_DENOMINATOR);
}

export function splitSale(grossCents: number, rateBps: number) {
  const commissionCents = calculateCommissionCents(grossCents, rateBps);
  return { commissionCents, vendorNetCents: grossCents - commissionCents };
}
