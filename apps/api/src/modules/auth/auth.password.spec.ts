process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-0123456789abcdef0123456789';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-0123456789abcdef0123456789';

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import type { NotificationsService } from '../mail/notifications.service';

interface FakeUser {
  id: string;
  email: string;
  name: string;
  role: 'BUYER' | 'VENDOR' | 'ADMIN';
  status: 'ACTIVE' | 'BLOCKED';
  passwordHash: string;
}

/** Just enough of Prisma, the users service and the audit log for the password flows. */
async function setup(overrides: Partial<FakeUser> = {}) {
  const user: FakeUser = {
    id: 'u1',
    email: 'ana@example.com',
    name: 'Ana',
    role: 'BUYER',
    status: 'ACTIVE',
    passwordHash: await bcrypt.hash('old-password', 4),
    ...overrides,
  };
  const refreshTokens = [
    { userId: 'u1', revokedAt: null as Date | null },
    { userId: 'u1', revokedAt: null as Date | null },
  ];
  const userTable = {
    findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
      where.id === user.id ? user : null,
    ),
    update: jest.fn(async ({ data }: { data: { passwordHash: string } }) => {
      user.passwordHash = data.passwordHash;
      return user;
    }),
  };
  const refreshTable = {
    updateMany: jest.fn(async () => {
      refreshTokens.forEach((t) => (t.revokedAt ??= new Date()));
      return { count: refreshTokens.length };
    }),
    create: jest.fn(async () => ({})),
  };
  const prisma = {
    user: userTable,
    refreshToken: refreshTable,
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) =>
      fn({ user: userTable, refreshToken: refreshTable }),
    ),
  };
  const users = {
    findByEmail: jest.fn(async (email: string) =>
      email.toLowerCase() === user.email ? user : null,
    ),
  };
  const audit = { log: jest.fn(async () => undefined) };
  const sent: string[] = [];
  const notifications = {
    passwordReset: jest.fn((_to: unknown, url: string) => {
      sent.push(url);
    }),
  } as unknown as NotificationsService;
  const jwt = new JwtService({ secret: process.env.JWT_ACCESS_SECRET, signOptions: {} });
  const service = new AuthService(
    prisma as never,
    jwt,
    users as never,
    audit as never,
    notifications,
  );
  const tokenFrom = (url: string) => decodeURIComponent(url.split('token=')[1]);
  return { service, user, refreshTokens, sent, audit, tokenFrom, jwt };
}

describe('AuthService passwords', () => {
  it('sends a reset link for a registered user and answers identically for unknown e-mails', async () => {
    const { service, sent } = await setup();
    await expect(service.requestPasswordReset('ANA@example.com')).resolves.toEqual({
      success: true,
    });
    await expect(service.requestPasswordReset('nobody@example.com')).resolves.toEqual({
      success: true,
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toContain('/reset-password?token=');
  });

  it('does not send a link to a blocked user', async () => {
    const { service, sent } = await setup({ status: 'BLOCKED' });
    await service.requestPasswordReset('ana@example.com');
    expect(sent).toHaveLength(0);
  });

  it('resets the password once, revokes every session, and refuses the same link again', async () => {
    const { service, user, refreshTokens, sent, tokenFrom } = await setup();
    await service.requestPasswordReset('ana@example.com');
    const token = tokenFrom(sent[0]);

    await expect(service.resetPassword(token, 'brand-new-pass')).resolves.toEqual({
      success: true,
    });
    expect(await bcrypt.compare('brand-new-pass', user.passwordHash)).toBe(true);
    expect(refreshTokens.every((t) => t.revokedAt)).toBe(true);

    await expect(service.resetPassword(token, 'another-pass-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('invalidates an older link once a newer one has been used', async () => {
    const { service, sent, tokenFrom } = await setup();
    await service.requestPasswordReset('ana@example.com');
    await service.requestPasswordReset('ana@example.com');
    await service.resetPassword(tokenFrom(sent[1]), 'brand-new-pass');
    await expect(service.resetPassword(tokenFrom(sent[0]), 'x-pass-12345')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects expired, foreign and malformed tokens', async () => {
    const { service, jwt, user } = await setup();
    const { passwordFingerprint, resetTokenSecret } = await import('./password-reset');
    const expired = await jwt.signAsync(
      { sub: user.id, type: 'password_reset', pwf: passwordFingerprint(user.passwordHash) },
      { secret: resetTokenSecret(), expiresIn: -10 },
    );
    const accessToken = await jwt.signAsync({ sub: user.id, type: 'access' });
    for (const token of [expired, accessToken, 'not-a-jwt-at-all-1234567890']) {
      await expect(service.resetPassword(token, 'brand-new-pass')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
  });

  it('changes the password only with the correct current one and returns new tokens', async () => {
    const { service, user, refreshTokens } = await setup();
    await expect(
      service.changePassword(user.id, {
        currentPassword: 'wrong',
        newPassword: 'brand-new-pass',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.changePassword(user.id, {
        currentPassword: 'old-password',
        newPassword: 'old-password',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    const tokens = await service.changePassword(user.id, {
      currentPassword: 'old-password',
      newPassword: 'brand-new-pass',
    });
    expect(tokens.accessToken).toEqual(expect.any(String));
    expect(tokens.refreshToken).toEqual(expect.any(String));
    expect(await bcrypt.compare('brand-new-pass', user.passwordHash)).toBe(true);
    expect(refreshTokens.every((t) => t.revokedAt)).toBe(true);
  });

  it('lets an admin create a link for buyers and sellers but not for admins', async () => {
    const buyer = await setup();
    const link = await buyer.service.adminCreateResetLink('u1', 'admin-1');
    expect(link.url).toContain('/reset-password?token=');
    expect(link.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(buyer.audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.password_reset_link', actorId: 'admin-1' }),
    );

    const admin = await setup({ role: 'ADMIN' });
    await expect(admin.service.adminCreateResetLink('u1', 'admin-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
