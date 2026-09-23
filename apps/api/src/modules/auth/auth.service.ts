import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { slugify, slugWithSuffix } from '../../common/utils/slug';
import type { AuthUser, JwtPayload } from '../../common/types/auth-user';
import { AuditService } from '../audit/audit.service';
import { UsersService, publicUserSelect } from '../users/users.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly audit: AuditService,
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
        { actorId: created.id, action: 'auth.register', entityType: 'User', entityId: created.id, metadata: { role } },
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
    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.userId !== payload.sub) {
      throw new UnauthorizedException('Refresh token is expired or revoked');
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || user.status !== UserStatus.ACTIVE) throw new UnauthorizedException();

    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
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
