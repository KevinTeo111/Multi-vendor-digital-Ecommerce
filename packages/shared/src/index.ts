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
  /** "manual": admin pays vendors by PIX/bank and marks the withdrawal paid. "gateway": transfer through the payment provider. */
  PAYOUT_MODE: 'finance.payout_mode',
  /** Payment provider fee (bps) built into listed prices, so buyers pay exactly the listed price and sellers keep their own price minus commission. */
  GATEWAY_FEE_BPS: 'finance.gateway_fee_bps',
  /** Operator identity shown on the legal pages. May be empty until the client provides it. */
  LEGAL_COMPANY_NAME: 'legal.company_name',
  LEGAL_CNPJ: 'legal.cnpj',
  LEGAL_ADDRESS: 'legal.address',
  LEGAL_CONTACT_EMAIL: 'legal.contact_email',
} as const;

/** Settings that may be left empty. */
export const OPTIONAL_SETTING_KEYS: readonly string[] = [
  SETTING_KEYS.LEGAL_COMPANY_NAME,
  SETTING_KEYS.LEGAL_CNPJ,
  SETTING_KEYS.LEGAL_ADDRESS,
  SETTING_KEYS.LEGAL_CONTACT_EMAIL,
];

export const PAYOUT_MODES = ['manual', 'gateway'] as const;
export type PayoutMode = (typeof PAYOUT_MODES)[number];

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export interface SettingDefaults {
  [SETTING_KEYS.SITE_NAME]: string;
  [SETTING_KEYS.SITE_CURRENCY]: string;
  [SETTING_KEYS.MIN_WITHDRAWAL_CENTS]: number;
  [SETTING_KEYS.PENDING_HOLD_DAYS]: number;
  [SETTING_KEYS.DEFAULT_COMMISSION_BPS]: number;
  [SETTING_KEYS.MAX_UPLOAD_MB]: number;
  [SETTING_KEYS.ALLOWED_FILE_EXTENSIONS]: string[];
  [SETTING_KEYS.PAYOUT_MODE]: PayoutMode;
  [SETTING_KEYS.GATEWAY_FEE_BPS]: number;
  [SETTING_KEYS.LEGAL_COMPANY_NAME]: string;
  [SETTING_KEYS.LEGAL_CNPJ]: string;
  [SETTING_KEYS.LEGAL_ADDRESS]: string;
  [SETTING_KEYS.LEGAL_CONTACT_EMAIL]: string;
}

export const SETTING_DEFAULTS: SettingDefaults = {
  [SETTING_KEYS.SITE_NAME]: 'Digital Marketplace',
  [SETTING_KEYS.SITE_CURRENCY]: 'BRL',
  [SETTING_KEYS.MIN_WITHDRAWAL_CENTS]: 10_000, // R$ 100,00
  [SETTING_KEYS.PENDING_HOLD_DAYS]: 7,
  [SETTING_KEYS.DEFAULT_COMMISSION_BPS]: 2_000, // 20%
  [SETTING_KEYS.MAX_UPLOAD_MB]: 500,
  [SETTING_KEYS.ALLOWED_FILE_EXTENSIONS]: ['zip', 'rar', '7z', 'pdf', 'epub', 'mp4', 'mp3'],
  [SETTING_KEYS.PAYOUT_MODE]: 'manual',
  [SETTING_KEYS.GATEWAY_FEE_BPS]: 0, // set to the provider's real rate in Admin → Settings
  [SETTING_KEYS.LEGAL_COMPANY_NAME]: '',
  [SETTING_KEYS.LEGAL_CNPJ]: '',
  [SETTING_KEYS.LEGAL_ADDRESS]: '',
  [SETTING_KEYS.LEGAL_CONTACT_EMAIL]: '',
};

/** Highest provider fee the platform accepts (20%); above that the setting is surely a typo. */
export const MAX_GATEWAY_FEE_BPS = 2_000;

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

/**
 * Listed price for a seller's own price, with the provider fee built in, so that after the fee
 * is taken the seller's price is left: list = ceil(base / (1 - fee)). Integer math only, so the
 * API and the database repricing query produce exactly the same cents.
 */
export function listPriceCents(baseCents: number, feeBps: number): number {
  if (!Number.isInteger(baseCents) || baseCents < 0) {
    throw new Error('baseCents must be a non-negative integer');
  }
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > MAX_GATEWAY_FEE_BPS) {
    throw new Error(`feeBps must be an integer between 0 and ${MAX_GATEWAY_FEE_BPS}`);
  }
  const keep = BPS_DENOMINATOR - feeBps;
  return Math.floor((baseCents * BPS_DENOMINATOR + keep - 1) / keep);
}

/**
 * Splits what the buyer paid: the provider fee reserve is the part above the seller's price,
 * the commission is taken from the seller's price, and the seller keeps the rest.
 * priceCents = gatewayFeeCents + commissionCents + vendorNetCents, always.
 */
export function splitSaleWithFee(priceCents: number, baseCents: number, rateBps: number) {
  if (!Number.isInteger(priceCents) || baseCents > priceCents) {
    throw new Error('priceCents must be an integer not below the seller price');
  }
  const { commissionCents, vendorNetCents } = splitSale(baseCents, rateBps);
  return { gatewayFeeCents: priceCents - baseCents, commissionCents, vendorNetCents };
}
