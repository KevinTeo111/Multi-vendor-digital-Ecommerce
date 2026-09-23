import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus, SubscriptionStatus, VendorStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { ListVendorsQuery, UpdateVendorProfileDto } from './dto/vendor.dto';

const vendorPublicSelect = {
  id: true,
  storeName: true,
  slug: true,
  description: true,
  logoKey: true,
  status: true,
  createdAt: true,
} satisfies Prisma.VendorSelect;

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Vendor's own profile plus current subscription and quota usage. */
  async getMe(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        subscriptions: {
          where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.PENDING] } },
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            products: {
              where: { status: { in: [ProductStatus.APPROVED, ProductStatus.PENDING_REVIEW] } },
            },
          },
        },
      },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const { subscriptions, _count, ...rest } = vendor;
    const subscription = subscriptions[0] ?? null;
    return {
      ...rest,
      subscription,
      usage: {
        listedProducts: _count.products,
        maxProducts: subscription?.plan.maxProducts ?? null,
      },
    };
  }

  async updateMe(vendorId: string, dto: UpdateVendorProfileDto) {
    return this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        storeName: dto.storeName?.trim(),
        slug: dto.slug,
        description: dto.description,
        payoutDetails: dto.payoutDetails as Prisma.InputJsonValue | undefined,
      },
    });
  }

  /** Public storefront header; only active vendors are visible. */
  async getPublicBySlug(slug: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { slug, status: VendorStatus.ACTIVE },
      select: {
        ...vendorPublicSelect,
        _count: { select: { products: { where: { status: ProductStatus.APPROVED } } } },
      },
    });
    if (!vendor) throw new NotFoundException('Store not found');
    const { _count, ...rest } = vendor;
    return { ...rest, productCount: _count.products };
  }

  async listForAdmin(query: ListVendorsQuery) {
    const where: Prisma.VendorWhereInput = {
      status: query.status,
      ...(query.search
        ? {
            OR: [
              { storeName: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
              { user: { email: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vendor.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
        include: {
          user: { select: { id: true, email: true, name: true, status: true } },
          subscriptions: {
            where: { status: SubscriptionStatus.ACTIVE },
            include: { plan: { select: { id: true, name: true } } },
            take: 1,
          },
          _count: { select: { products: true } },
        },
      }),
      this.prisma.vendor.count({ where }),
    ]);

    return paginate(
      items.map(({ subscriptions, _count, ...v }) => ({
        ...v,
        activePlan: subscriptions[0]?.plan ?? null,
        productCount: _count.products,
      })),
      total,
      query,
    );
  }

  async getForAdmin(id: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true, status: true, createdAt: true } },
        subscriptions: { include: { plan: true }, orderBy: { createdAt: 'desc' } },
        _count: { select: { products: true, withdrawals: true, orderItems: true } },
      },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async setStatus(id: string, status: VendorStatus) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id } });
    if (!vendor) throw new NotFoundException('Vendor not found');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.vendor.update({ where: { id }, data: { status } });
      if (status === VendorStatus.SUSPENDED) {
        // Suspended vendors' products go offline immediately.
        await tx.product.updateMany({
          where: { vendorId: id, status: ProductStatus.APPROVED },
          data: { status: ProductStatus.BLOCKED },
        });
      }
      return updated;
    });
  }
}
