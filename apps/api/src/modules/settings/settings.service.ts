import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  BPS_DENOMINATOR,
  MAX_GATEWAY_FEE_BPS,
  PAYOUT_MODES,
  OPTIONAL_SETTING_KEYS,
  SETTING_DEFAULTS,
  SETTING_KEYS,
  SettingDefaults,
  SettingKey,
} from '@marketplace/shared';
import { PrismaService } from '../../prisma/prisma.service';

const CACHE_TTL_MS = 10_000;

/**
 * Typed access to admin-editable platform settings.
 * Values are stored as JSON in the Setting table; unknown keys fall back to SETTING_DEFAULTS.
 */
@Injectable()
export class SettingsService {
  private cache: { loadedAt: number; values: Partial<SettingDefaults> } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async get<K extends SettingKey>(key: K): Promise<SettingDefaults[K]> {
    const all = await this.getAll();
    return all[key];
  }

  async getAll(): Promise<SettingDefaults> {
    const now = Date.now();
    if (!this.cache || now - this.cache.loadedAt > CACHE_TTL_MS) {
      const rows = await this.prisma.setting.findMany();
      const values: Partial<SettingDefaults> = {};
      for (const row of rows) {
        if (this.isKnownKey(row.key)) {
          (values as Record<string, unknown>)[row.key] = row.value;
        }
      }
      this.cache = { loadedAt: now, values };
    }
    return { ...SETTING_DEFAULTS, ...this.cache.values };
  }

  async getPublic() {
    const all = await this.getAll();
    return {
      siteName: all[SETTING_KEYS.SITE_NAME],
      currency: all[SETTING_KEYS.SITE_CURRENCY],
      minWithdrawalCents: all[SETTING_KEYS.MIN_WITHDRAWAL_CENTS],
      pendingHoldDays: all[SETTING_KEYS.PENDING_HOLD_DAYS],
      maxUploadMb: all[SETTING_KEYS.MAX_UPLOAD_MB],
      allowedFileExtensions: all[SETTING_KEYS.ALLOWED_FILE_EXTENSIONS],
      payoutMode: all[SETTING_KEYS.PAYOUT_MODE],
      gatewayFeeBps: all[SETTING_KEYS.GATEWAY_FEE_BPS],
      legal: {
        companyName: all[SETTING_KEYS.LEGAL_COMPANY_NAME],
        cnpj: all[SETTING_KEYS.LEGAL_CNPJ],
        address: all[SETTING_KEYS.LEGAL_ADDRESS],
        contactEmail: all[SETTING_KEYS.LEGAL_CONTACT_EMAIL],
      },
    };
  }

  async update(patch: Record<string, unknown>): Promise<SettingDefaults> {
    const entries = Object.entries(patch);
    for (const [key, value] of entries) {
      if (!this.isKnownKey(key)) throw new BadRequestException(`Unknown setting: ${key}`);
      this.validateValue(key, value);
    }

    const feeBps = patch[SETTING_KEYS.GATEWAY_FEE_BPS] as number | undefined;
    await this.prisma.$transaction([
      ...entries.map(([key, value]) =>
        this.prisma.setting.upsert({
          where: { key },
          create: { key, value: value as Prisma.InputJsonValue },
          update: { value: value as Prisma.InputJsonValue },
        }),
      ),
      // A new provider fee changes every listed price; the sellers' own prices stay as they are.
      ...(feeBps === undefined ? [] : [this.repriceProducts(feeBps)]),
    ]);
    this.cache = null;
    return this.getAll();
  }

  /**
   * listed = ceil(seller price / (1 - fee)), in integer SQL identical to listPriceCents(). Orders
   * already placed keep their snapshot; carts and new checkouts use the new listed price.
   */
  private repriceProducts(feeBps: number) {
    const keep = BPS_DENOMINATOR - feeBps;
    return this.prisma.$executeRaw`
      UPDATE "Product"
      SET "basePriceCents" = COALESCE("basePriceCents", "priceCents"),
          "priceCents" = (COALESCE("basePriceCents", "priceCents") * ${BPS_DENOMINATOR} + ${keep} - 1) / ${keep},
          "extendedPriceCents" = ("extendedBasePriceCents" * ${BPS_DENOMINATOR} + ${keep} - 1) / ${keep}`;
  }

  private isKnownKey(key: string): key is SettingKey {
    return (Object.values(SETTING_KEYS) as string[]).includes(key);
  }

  private validateValue(key: SettingKey, value: unknown) {
    const expected = SETTING_DEFAULTS[key];
    const fail = (msg: string) => {
      throw new BadRequestException(`Invalid value for ${key}: ${msg}`);
    };

    if (Array.isArray(expected)) {
      if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
        fail('expected an array of strings');
      }
      return;
    }
    if (typeof expected === 'number') {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        fail('expected a non-negative integer');
      }
      if (key === SETTING_KEYS.DEFAULT_COMMISSION_BPS && (value as number) > 10_000) {
        fail('commission cannot exceed 10000 bps (100%)');
      }
      if (key === SETTING_KEYS.GATEWAY_FEE_BPS && (value as number) > MAX_GATEWAY_FEE_BPS) {
        fail(`provider fee cannot exceed ${MAX_GATEWAY_FEE_BPS} bps (20%)`);
      }
      return;
    }
    if (typeof expected === 'string') {
      if (typeof value !== 'string') fail('expected a string');
      if ((value as string).trim().length === 0 && !OPTIONAL_SETTING_KEYS.includes(key))
        fail('expected a non-empty string');
      if (
        key === SETTING_KEYS.PAYOUT_MODE &&
        !(PAYOUT_MODES as readonly string[]).includes(value as string)
      ) {
        fail(`expected one of ${PAYOUT_MODES.join(', ')}`);
      }
      return;
    }
  }
}
