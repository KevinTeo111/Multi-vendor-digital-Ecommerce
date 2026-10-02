import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { env, primaryWebUrl } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { slugify, slugWithSuffix } from '../../common/utils/slug';
import type { AuthUser, JwtPayload } from '../../common/types/auth-user';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../mail/notifications.service';
import { UsersService, publicUserSelect } from '../users/users.service';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto';
import {
  RESET_TOKEN_TTL_SECONDS,
  type ResetTokenPayload,
  passwordFingerprint,
  resetTokenSecret,
} from './password-reset';

const BCRYPT_ROUNDS = 12;
const INVALID_RESET = 'This reset link is invalid or has expired. Please request a new one.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const role: Role = dto.role === 'VENDOR' ? Role.VENDOR : Role.BUYER;

    if (role === Role.VENDOR && !dto.storeName) {
      throw new BadRequestException('storeName is required for vendor registration');
    }
    if (await this.users.findByEmail(email)) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, passwordHash, name: dto.name.trim(), role },
      });

      if (role === Role.VENDOR) {
        const storeName = dto.storeName!.trim();
        const baseSlug = slugify(storeName) || 'store';
        const taken = await tx.vendor.findUnique({ where: { slug: baseSlug } });
        await tx.vendor.create({
          data: {
            userId: created.id,
            storeName,
            slug: taken ? slugWithSuffix(storeName) : baseSlug,
          },
        });
      }

      await this.audit.log(
        {
          actorId: created.id,
          action: 'auth.register',
          entityType: 'User',
          entityId: created.id,
          metadata: { role },
        },
        tx,
      );

      return tx.user.findUniqueOrThrow({ where: { id: created.id }, select: publicUserSelect });
    });

    const tokens = await this.issueTokens(user.id, user.role);
    return { user, ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    const valid = user && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!valid) throw new UnauthorizedException('Invalid email or password');
    if (user.status !== UserStatus.ACTIVE) throw new UnauthorizedException('Account is blocked');

    const tokens = await this.issueTokens(user.id, user.role);
    const publicUser = await this.users.findPublicById(user.id);
    return { user: publicUser, ...tokens };
  }

  /** Rotates a refresh token: the presented token is revoked and a new pair is issued. */
  async refresh(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(refreshToken, { secret: env.JWT_REFRESH_SECRET });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid refresh token');

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt < new Date() ||
      stored.userId !== payload.sub
    ) {
      throw new UnauthorizedException('Refresh token is expired or revoked');
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException();

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(user.id, user.role);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  me(user: AuthUser) {
    return this.users.findPublicById(user.id);
  }

  // ---- Passwords -----------------------------------------------------------

  /** Answers the same way for every e-mail, so the endpoint cannot reveal who is registered. */
  async requestPasswordReset(email: string) {
    const user = await this.users.findByEmail(email);
    if (user && user.status === UserStatus.ACTIVE) {
      const { url, expiresAt } = await this.createResetLink(user);
      // Not awaited: the answer must take the same time whether or not the e-mail is registered.
      this.notifications.passwordReset({ email: user.email, name: user.name }, url, expiresAt);
      await this.audit.log({
        actorId: user.id,
        action: 'auth.password_reset_requested',
        entityType: 'User',
        entityId: user.id,
      });
    }
    return { success: true };
  }

  /** Support path for admins (and the only delivery channel until e-mail is configured). */
  async adminCreateResetLink(userId: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === Role.ADMIN)
      throw new ForbiddenException('Admin passwords cannot be reset from the panel');
    if (user.status !== UserStatus.ACTIVE)
      throw new BadRequestException('Unblock the user before resetting the password');
    const link = await this.createResetLink(user);
    await this.audit.log({
      actorId,
      action: 'user.password_reset_link',
      entityType: 'User',
      entityId: user.id,
    });
    return link;
  }

  async resetPassword(token: string, password: string) {
    let payload: ResetTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<ResetTokenPayload>(token, {
        secret: resetTokenSecret(),
      });
    } catch {
      throw new BadRequestException(INVALID_RESET);
    }
    if (payload.type !== 'password_reset') throw new BadRequestException(INVALID_RESET);

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    // A changed password changes the fingerprint, which makes every earlier link single-use.
    if (
      !user ||
      user.status !== UserStatus.ACTIVE ||
      passwordFingerprint(user.passwordHash) !== payload.pwf
    ) {
      throw new BadRequestException(INVALID_RESET);
    }
    await this.setPassword(user.id, password, user.id, 'auth.password_reset');
    return { success: true };
  }

  /** Signs the user out of every other session and returns a fresh pair for this one. */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash)))
      throw new BadRequestException('Current password is incorrect');
    if (dto.currentPassword === dto.newPassword)
      throw new BadRequestException('The new password must be different from the current one');

    await this.setPassword(user.id, dto.newPassword, user.id, 'auth.password_change');
    return this.issueTokens(user.id, user.role);
  }

  private async createResetLink(user: { id: string; passwordHash: string }) {
    const payload: ResetTokenPayload = {
      sub: user.id,
      type: 'password_reset',
      pwf: passwordFingerprint(user.passwordHash),
    };
    const token = await this.jwt.signAsync(payload, {
      secret: resetTokenSecret(),
      expiresIn: RESET_TOKEN_TTL_SECONDS,
    });
    return {
      url: `${primaryWebUrl}/reset-password?token=${encodeURIComponent(token)}`,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_SECONDS * 1000),
    };
  }

  /** New hash and every refresh token revoked, in one transaction, audited. */
  private async setPassword(userId: string, password: string, actorId: string, action: string) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.log({ actorId, action, entityType: 'User', entityId: userId }, tx);
    });
  }

  private async issueTokens(userId: string, role: Role) {
    const accessPayload: JwtPayload = { sub: userId, role, type: 'access' };
    const refreshPayload: JwtPayload & { jti: string } = {
      sub: userId,
      role,
      type: 'refresh',
      jti: randomBytes(16).toString('hex'),
    };

    const accessToken = await this.jwt.signAsync(accessPayload);
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: env.JWT_REFRESH_SECRET,
      expiresIn: env.JWT_REFRESH_TTL as never,
    });

    const decoded = this.jwt.decode<{ exp: number }>(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
