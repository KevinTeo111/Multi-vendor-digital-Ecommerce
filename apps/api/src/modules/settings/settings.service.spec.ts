import { BadRequestException } from '@nestjs/common';
import { SETTING_KEYS } from '@marketplace/shared';
import { SettingsService } from './settings.service';
import type { PrismaService } from '../../prisma/prisma.service';

/** In-memory stand-in for the Setting table. */
function fakePrisma(initial: Record<string, unknown> = {}) {
  const rows = new Map(Object.entries(initial));
  const setting = {
    findMany: jest.fn(async () => [...rows.entries()].map(([key, value]) => ({ key, value }))),
    upsert: jest.fn(
      async ({ where, create }: { where: { key: string }; create: { value: unknown } }) => {
        rows.set(where.key, create.value);
        return { key: where.key, value: create.value };
      },
    ),
  };
  return {
    setting,
    $transaction: jest.fn(async (ops: unknown[]) => Promise.all(ops)),
  } as unknown as PrismaService;
}

describe('SettingsService', () => {
  it('falls back to defaults for keys that are not stored', async () => {
    const service = new SettingsService(fakePrisma());
    expect(await service.get(SETTING_KEYS.MIN_WITHDRAWAL_CENTS)).toBe(10_000);
    expect(await service.get(SETTING_KEYS.PAYOUT_MODE)).toBe('manual');
  });

  it('returns stored values and ignores unknown rows', async () => {
    const service = new SettingsService(
      fakePrisma({ [SETTING_KEYS.MIN_WITHDRAWAL_CENTS]: 500, 'legacy.key': 1 }),
    );
    expect(await service.get(SETTING_KEYS.MIN_WITHDRAWAL_CENTS)).toBe(500);
    expect(await service.getAll()).not.toHaveProperty('legacy.key');
  });

  it('validates types and ranges before saving', async () => {
    const service = new SettingsService(fakePrisma());
    await expect(service.update({ 'nope.key': 1 })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update({ [SETTING_KEYS.PENDING_HOLD_DAYS]: -1 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.update({ [SETTING_KEYS.DEFAULT_COMMISSION_BPS]: 10_001 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update({ [SETTING_KEYS.PAYOUT_MODE]: 'paypal' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.update({ [SETTING_KEYS.ALLOWED_FILE_EXTENSIONS]: 'zip' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('persists valid updates and refreshes the cache', async () => {
    const service = new SettingsService(fakePrisma());
    await service.get(SETTING_KEYS.SITE_NAME); // warm the cache
    const all = await service.update({
      [SETTING_KEYS.SITE_NAME]: 'Loja',
      [SETTING_KEYS.PAYOUT_MODE]: 'gateway',
    });
    expect(all[SETTING_KEYS.SITE_NAME]).toBe('Loja');
    expect(await service.get(SETTING_KEYS.PAYOUT_MODE)).toBe('gateway');
  });
});
