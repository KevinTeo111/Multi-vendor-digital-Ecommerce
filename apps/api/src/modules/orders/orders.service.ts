import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  LedgerEntryStatus,
  LedgerEntryType,
  OrderStatus,
  PaymentMethod,
  Prisma,
  ProductStatus,
  VendorStatus,
} from '@prisma/client';
import { SETTING_KEYS, splitSale } from '@marketplace/shared';
import { randomBytes } from 'node:crypto';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { AuditService } from '../audit/audit.service';
import { CartService } from '../cart/cart.service';
import { PAYMENT_GATEWAY, PaymentGateway } from '../payments/gateway/payment-gateway.interface';
import { RealtimeService } from '../realtime/realtime.service';
import { SettingsService } from '../settings/settings.service';
import { StorageService } from '../storage/storage.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AdminOrdersQuery, BuyerOrdersQuery, VendorSalesQuery } from './dto/order.dto';

const orderItemInclude = {
  product: { select: { id: true, slug: true, thumbnailKey: true, version: true } },
  vendor: { select: { id: true, storeName: true, slug: true } },
} satisfies Prisma.OrderItemInclude;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  // =========================================================================
  // Checkout
  // =========================================================================

  /**
   * Turns the cart into a PENDING order with commission snapshots, then starts payment.
   * With the mock gateway the order is paid immediately; with a real gateway the
   * webhook flips it to PAID.
   */
  async checkout(buyerId: string) {
    const buyer = await this.prisma.user.findUniqueOrThrow({
      where: { id: buyerId },
      select: { id: true, name: true, email: true },
    });
    const cart = await this.cart.get(buyerId);
    if (cart.items.length === 0) throw new BadRequestException('Your cart is empty');

    const [defaultCommissionBps, currency] = await Promise.all([
      this.settings.get(SETTING_KEYS.DEFAULT_COMMISSION_BPS),
      this.settings.get(SETTING_KEYS.SITE_CURRENCY),
    ]);

    const order = await this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: {
          id: { in: cart.items.map((i) => i.product.id) },
          status: ProductStatus.APPROVED,
          vendor: { status: VendorStatus.ACTIVE },
        },
        select: { id: true, title: true, priceCents: true, vendorId: true },
      });
      if (products.length !== cart.items.length) {
        throw new BadRequestException('Some items are no longer available; please review your cart');
      }

      // Commission rate comes from each vendor's plan at this moment and is frozen on the item.
      const rateByVendor = new Map<string, { rateBps: number; planId: string | null }>();
      for (const vendorId of new Set(products.map((p) => p.vendorId))) {
        const sub = await this.subscriptions.getEntitling(vendorId, tx);
        rateByVendor.set(vendorId, {
          rateBps: sub?.plan.commissionRateBps ?? defaultCommissionBps,
          planId: sub?.planId ?? null,
        });
      }

      const items = products.map((p) => {
        const { rateBps, planId } = rateByVendor.get(p.vendorId)!;
        const { commissionCents, vendorNetCents } = splitSale(p.priceCents, rateBps);
        return {
          productId: p.id,
          vendorId: p.vendorId,
          planId,
          productTitle: p.title,
          priceCents: p.priceCents,
          commissionRateBps: rateBps,
          commissionCents,
          vendorNetCents,
        };
      });
      const subtotalCents = items.reduce((s, i) => s + i.priceCents, 0);

      return tx.order.create({
        data: {
          orderNumber: this.generateOrderNumber(),
          buyerId,
          status: OrderStatus.PENDING,
          subtotalCents,
          totalCents: subtotalCents,
          currency,
          items: { create: items },
        },
        include: { items: true },
      });
    });

    let checkout;
    try {
      checkout = await this.gateway.createCheckout({
        orderId: order.id,
        orderNumber: order.orderNumber,
        amountCents: order.totalCents,
        currency: order.currency,
        customer: buyer,
        items: order.items.map((i) => ({ description: i.productTitle, amountCents: i.priceCents, quantity: 1 })),
        successUrl: `${env.WEB_URL}/orders/${order.id}?status=success`,
        cancelUrl: `${env.WEB_URL}/orders/${order.id}?status=canceled`,
      });
    } catch (err) {
      this.logger.error(`Gateway checkout failed for order ${order.orderNumber}: ${(err as Error).message}`);
      await this.markFailed(order.id, 'Payment provider error');
      throw new BadRequestException('Could not start payment; please try again');
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: { gatewayOrderId: checkout.gatewayOrderId },
    });

    if (checkout.status === 'paid') {
      await this.markPaid(order.id, { paymentMethod: PaymentMethod.MOCK });
    } else if (checkout.status === 'failed') {
      await this.markFailed(order.id, 'Payment declined');
    }

    return { order: await this.getForBuyer(buyerId, order.id), checkoutUrl: checkout.checkoutUrl ?? null };
  }

  // =========================================================================
  // State transitions (idempotent; used by checkout and webhooks)
  // =========================================================================

  async markPaid(orderId: string, info: { chargeId?: string; paymentMethod?: PaymentMethod }) {
    const holdDays = await this.settings.get(SETTING_KEYS.PENDING_HOLD_DAYS);
    const availableAt = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000);

    const paid = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === OrderStatus.PAID) return null; // duplicate webhook
      if (order.status !== OrderStatus.PENDING) {
        this.logger.warn(`Order ${order.orderNumber} received payment while ${order.status}`);
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PAID,
          paidAt: new Date(),
          gatewayChargeId: info.chargeId,
          paymentMethod: info.paymentMethod,
          failureReason: null,
        },
      });

      for (const item of order.items) {
        await tx.ledgerEntry.create({
          data: {
            vendorId: item.vendorId,
            type: LedgerEntryType.SALE_CREDIT,
            status: holdDays === 0 ? LedgerEntryStatus.AVAILABLE : LedgerEntryStatus.PENDING,
            amountCents: item.vendorNetCents,
            availableAt,
            orderItemId: item.id,
            description: `Sale: ${item.productTitle}`,
          },
        });
        await tx.product.update({ where: { id: item.productId }, data: { salesCount: { increment: 1 } } });
      }

      // Remove purchased products from the buyer's cart.
      const cart = await tx.cart.findUnique({ where: { userId: order.buyerId } });
      if (cart) {
        await tx.cartItem.deleteMany({
          where: { cartId: cart.id, productId: { in: order.items.map((i) => i.productId) } },
        });
      }

      await this.audit.log(
        { actorId: order.buyerId, action: 'order.paid', entityType: 'Order', entityId: orderId, metadata: { totalCents: order.totalCents } },
        tx,
      );
      return order;
    });

    if (paid) {
      this.realtime.toUser(paid.buyerId, 'order.paid', { orderId: paid.id, orderNumber: paid.orderNumber });
      for (const item of paid.items) {
        this.realtime.toVendor(item.vendorId, 'sale.new', {
          orderItemId: item.id,
          orderNumber: paid.orderNumber,
          productTitle: item.productTitle,
          vendorNetCents: item.vendorNetCents,
        });
      }
    }
  }

  async markFailed(orderId: string, reason: string) {
    await this.prisma.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING },
      data: { status: OrderStatus.FAILED, failureReason: reason },
    });
  }

  async markPaidByGatewayId(gatewayOrderId: string, info: { chargeId?: string; paymentMethod?: string }) {
    const order = await this.prisma.order.findUnique({ where: { gatewayOrderId }, select: { id: true } });
    if (!order) {
      this.logger.warn(`Webhook for unknown gateway order ${gatewayOrderId}`);
      return;
    }
    await this.markPaid(order.id, { chargeId: info.chargeId, paymentMethod: this.toPaymentMethod(info.paymentMethod) });
  }

  async markFailedByGatewayId(gatewayOrderId: string, reason?: string) {
    const order = await this.prisma.order.findUnique({ where: { gatewayOrderId }, select: { id: true } });
    if (order) await this.markFailed(order.id, reason ?? 'Payment failed');
  }

  // =========================================================================
  // Buyer
  // =========================================================================

  async listForBuyer(buyerId: string, query: BuyerOrdersQuery) {
    const where: Prisma.OrderWhereInput = { buyerId, status: query.status };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
        include: { items: { include: orderItemInclude } },
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(await Promise.all(items.map((o) => this.decorateOrder(o))), total, query);
  }

  async getForBuyer(buyerId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, buyerId },
      include: { items: { include: { ...orderItemInclude, _count: { select: { downloads: true } } } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.decorateOrder(order);
  }

  /** Every product the buyer has paid for, for a "My downloads" page. */
  async libraryForBuyer(buyerId: string) {
    const items = await this.prisma.orderItem.findMany({
      where: { order: { buyerId, status: OrderStatus.PAID } },
      orderBy: { createdAt: 'desc' },
      include: {
        ...orderItemInclude,
        order: { select: { id: true, orderNumber: true, paidAt: true } },
        product: { select: { id: true, slug: true, thumbnailKey: true, version: true, files: { select: { id: true, fileName: true, sizeBytes: true, isMain: true } } } },
      },
    });
    return Promise.all(
      items.map(async ({ product, ...item }) => ({
        ...item,
        product: { ...product, thumbnailUrl: await this.storage.createMediaUrl(product.thumbnailKey) },
      })),
    );
  }

  /** Issues a short-lived signed URL for one file of a paid order item and logs the download. */
  async downloadUrl(buyerId: string, orderItemId: string, fileId: string | undefined, meta: { ip?: string; userAgent?: string }) {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: { select: { buyerId: true, status: true } }, product: { select: { files: true } } },
    });
    if (!item || item.order.buyerId !== buyerId) throw new NotFoundException('Order item not found');
    if (item.order.status !== OrderStatus.PAID) throw new ForbiddenException('This order has not been paid');

    const file = fileId
      ? item.product.files.find((f) => f.id === fileId)
      : (item.product.files.find((f) => f.isMain) ?? item.product.files[0]);
    if (!file) throw new NotFoundException('No downloadable file is attached to this product');

    const [url] = await Promise.all([
      this.storage.createDownloadUrl(file.storageKey, file.fileName),
      this.prisma.download.create({
        data: { orderItemId, userId: buyerId, ipAddress: meta.ip, userAgent: meta.userAgent?.slice(0, 500) },
      }),
    ]);
    return { url, fileName: file.fileName, sizeBytes: file.sizeBytes, expiresInSeconds: env.DOWNLOAD_URL_TTL_SECONDS };
  }

  // =========================================================================
  // Vendor sales
  // =========================================================================

  async listSalesForVendor(vendorId: string, query: VendorSalesQuery) {
    const where: Prisma.OrderItemWhereInput = { vendorId, order: { status: OrderStatus.PAID } };
    const [items, total, totals] = await this.prisma.$transaction([
      this.prisma.orderItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
        include: {
          order: { select: { id: true, orderNumber: true, paidAt: true, buyer: { select: { name: true } } } },
          product: { select: { id: true, slug: true } },
        },
      }),
      this.prisma.orderItem.count({ where }),
      this.prisma.orderItem.aggregate({ where, _sum: { priceCents: true, commissionCents: true, vendorNetCents: true } }),
    ]);
    return {
      ...paginate(items, total, query),
      totals: {
        grossCents: totals._sum.priceCents ?? 0,
        commissionCents: totals._sum.commissionCents ?? 0,
        netCents: totals._sum.vendorNetCents ?? 0,
      },
    };
  }

  /** One sale as the vendor sees it: item, order, buyer name, payout status, downloads. */
  async getSaleForVendor(vendorId: string, orderItemId: string) {
    const item = await this.prisma.orderItem.findFirst({
      where: { id: orderItemId, vendorId, order: { status: OrderStatus.PAID } },
      include: {
        order: { select: { id: true, orderNumber: true, paidAt: true, paymentMethod: true, currency: true, buyer: { select: { name: true } } } },
        product: { select: { id: true, slug: true, title: true, thumbnailKey: true, version: true } },
        plan: { select: { id: true, name: true } },
        ledgerEntries: { select: { id: true, type: true, status: true, amountCents: true, availableAt: true } },
        _count: { select: { downloads: true } },
      },
    });
    if (!item) throw new NotFoundException('Sale not found');
    const { product, _count, ...rest } = item;
    return {
      ...rest,
      downloads: _count.downloads,
      product: { ...product, thumbnailUrl: await this.storage.createMediaUrl(product.thumbnailKey) },
    };
  }

  // =========================================================================
  // Admin
  // =========================================================================

  async listForAdmin(query: AdminOrdersQuery) {
    const where: Prisma.OrderWhereInput = {
      status: query.status,
      buyerId: query.buyerId,
      ...(query.vendorId ? { items: { some: { vendorId: query.vendorId } } } : {}),
      ...(query.search
        ? {
            OR: [
              { orderNumber: { contains: query.search, mode: 'insensitive' } },
              { buyer: { email: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
        include: {
          buyer: { select: { id: true, name: true, email: true } },
          items: { include: orderItemInclude },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginate(items, total, query);
  }

  async getForAdmin(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { id: true, name: true, email: true } },
        items: { include: { ...orderItemInclude, ledgerEntries: true, _count: { select: { downloads: true } } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  private async decorateOrder<T extends { items: Array<{ product: { thumbnailKey: string | null } }> }>(order: T) {
    const items = await Promise.all(
      order.items.map(async ({ product, ...item }) => {
        const { thumbnailKey, ...p } = product;
        return { ...item, product: { ...p, thumbnailUrl: await this.storage.createMediaUrl(thumbnailKey) } };
      }),
    );
    return { ...order, items };
  }

  private generateOrderNumber() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `ORD-${date}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  private toPaymentMethod(raw?: string): PaymentMethod | undefined {
    switch (raw?.toLowerCase()) {
      case 'credit_card':
        return PaymentMethod.CREDIT_CARD;
      case 'pix':
        return PaymentMethod.PIX;
      case 'boleto':
        return PaymentMethod.BOLETO;
      default:
        return undefined;
    }
  }
}
