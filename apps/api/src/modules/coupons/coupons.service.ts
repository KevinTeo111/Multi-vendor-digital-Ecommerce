import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CouponType, OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { applyCoupon, type CouponOutcome, type SaleLine } from './coupon-math';
import { CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto';

/** A redemption holds its slot while the order can still be paid, and keeps it once paid. */
const HOLDING_STATUSES: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.PAID];

const REFUSALS: Record<string, string> = {
  not_found: 'This coupon code does not exist.',
  inactive: 'This coupon is no longer active.',
  not_started: 'This coupon is not valid yet.',
  expired: 'This coupon has expired.',
  exhausted: 'This coupon has reached its usage limit.',
  per_buyer: 'You have already used this coupon.',
  min_order: 'Your order does not reach the minimum value for this coupon.',
  not_applicable: 'This coupon does not apply to the items in your cart.',
};

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---- Checkout --------------------------------------------------------------------------------

  /**
   * Validates a code for this buyer and cart and computes the discount. Inside the checkout
   * transaction the coupon row is locked, so two buyers cannot both take its last use.
   */
  async quote<L extends SaleLine>(
    code: string,
    buyerId: string,
    lines: L[],
    tx: Prisma.TransactionClient = this.prisma,
    lock = false,
  ): Promise<{ couponId: string; code: string; outcome: Extract<CouponOutcome<L>, { ok: true }> }> {
    const normalized = code.trim().toUpperCase();
    if (lock) await tx.$queryRaw`SELECT id FROM "Coupon" WHERE code = ${normalized} FOR UPDATE`;
    const coupon = await tx.coupon.findUnique({ where: { code: normalized } });
    if (!coupon) throw this.refuse('not_found');
    if (!coupon.active) throw this.refuse('inactive');
    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) throw this.refuse('not_started');
    if (coupon.endsAt && coupon.endsAt < now) throw this.refuse('expired');

    const [used, usedByBuyer] = await Promise.all([
      coupon.maxRedemptions === null
        ? Promise.resolve(0)
        : tx.couponRedemption.count({
            where: { couponId: coupon.id, order: { status: { in: HOLDING_STATUSES } } },
          }),
      tx.couponRedemption.count({
        where: { couponId: coupon.id, buyerId, order: { status: { in: HOLDING_STATUSES } } },
      }),
    ]);
    if (coupon.maxRedemptions !== null && used >= coupon.maxRedemptions)
      throw this.refuse('exhausted');
    if (usedByBuyer >= coupon.perBuyerLimit) throw this.refuse('per_buyer');

    const outcome = applyCoupon(lines, {
      type: coupon.type,
      value: coupon.value,
      vendorId: coupon.vendorId,
      productId: coupon.productId,
      minOrderCents: coupon.minOrderCents,
      sellerFunded: coupon.ownerVendorId !== null,
    });
    if (!outcome.ok) throw this.refuse(outcome.reason);
    return { couponId: coupon.id, code: coupon.code, outcome };
  }

  private refuse(reason: keyof typeof REFUSALS | string) {
    return new BadRequestException(REFUSALS[reason] ?? 'This coupon cannot be used.');
  }

  // ---- Management (admin: ownerVendorId null; seller: ownerVendorId = seller) -----------------

  list(ownerVendorId: string | null) {
    return this.prisma.coupon.findMany({
      where: { ownerVendorId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, title: true } },
        vendor: { select: { id: true, storeName: true } },
        _count: { select: { redemptions: { where: { order: { status: OrderStatus.PAID } } } } },
      },
    });
  }

  async create(ownerVendorId: string | null, actorId: string, dto: CreateCouponDto) {
    if (dto.type === CouponType.PERCENT && dto.value > 10_000)
      throw new BadRequestException('A percentage cannot exceed 100%');
    if (dto.startsAt && dto.endsAt && new Date(dto.endsAt) <= new Date(dto.startsAt))
      throw new BadRequestException('The end date must be after the start date');

    // Sellers can only discount their own products, funded by themselves.
    const vendorId = ownerVendorId ?? dto.vendorId ?? null;
    if (dto.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
        select: { vendorId: true },
      });
      if (!product || (vendorId && product.vendorId !== vendorId))
        throw new BadRequestException('Product not found for this coupon');
    }
    const code = dto.code.trim().toUpperCase();
    if (await this.prisma.coupon.findUnique({ where: { code } }))
      throw new BadRequestException('This code is already in use');

    const coupon = await this.prisma.coupon.create({
      data: {
        code,
        ownerVendorId,
        vendorId,
        productId: dto.productId ?? null,
        type: dto.type,
        value: dto.value,
        minOrderCents: dto.minOrderCents ?? null,
        maxRedemptions: dto.maxRedemptions ?? null,
        perBuyerLimit: dto.perBuyerLimit ?? 1,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
    });
    await this.audit.log({
      actorId,
      action: 'coupon.create',
      entityType: 'Coupon',
      entityId: coupon.id,
      metadata: { code, type: dto.type, value: dto.value, sellerFunded: ownerVendorId !== null },
    });
    return coupon;
  }

  async update(ownerVendorId: string | null, actorId: string, id: string, dto: UpdateCouponDto) {
    const coupon = await this.prisma.coupon.findFirst({ where: { id, ownerVendorId } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    const updated = await this.prisma.coupon.update({
      where: { id },
      data: {
        active: dto.active,
        endsAt: dto.endsAt === undefined ? undefined : dto.endsAt && new Date(dto.endsAt),
        maxRedemptions: dto.maxRedemptions,
      },
    });
    await this.audit.log({
      actorId,
      action: 'coupon.update',
      entityType: 'Coupon',
      entityId: id,
      metadata: { ...dto },
    });
    return updated;
  }
}
