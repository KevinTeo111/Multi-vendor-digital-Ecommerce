import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto, findPage } from '../../common/dto/pagination.dto';

export const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  createdAt: true,
  vendor: { select: { id: true, storeName: true, slug: true, status: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  async findPublicById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: publicUserSelect });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async list(dto: PaginationDto, filters: { role?: Role; status?: UserStatus; search?: string }) {
    const where: Prisma.UserWhereInput = {
      role: filters.role,
      status: filters.status,
      ...(filters.search
        ? {
            OR: [
              { email: { contains: filters.search, mode: 'insensitive' } },
              { name: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return findPage(
      dto,
      () =>
        this.prisma.user.findMany({
          where,
          select: publicUserSelect,
          orderBy: { createdAt: 'desc' },
          skip: dto.skip,
          take: dto.pageSize,
        }),
      () => this.prisma.user.count({ where }),
    );
  }

  async setStatus(id: string, status: UserStatus) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { status },
      select: publicUserSelect,
    });
    if (status === UserStatus.BLOCKED) {
      // Blocking a user invalidates all their sessions.
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return user;
  }
}
