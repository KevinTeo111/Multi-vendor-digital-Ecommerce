import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  LedgerEntryStatus,
  LedgerEntryType,
  OrderStatus,
  PaymentMethod,
  ProductStatus,
  VendorStatus,
} from '@prisma/client';
import { SETTING_KEYS, splitSale } from '@marketplace/shared';
import { randomBytes } from 'node:crypto';
import { primaryWebUrl } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CartService } from '../cart/cart.service';
import { PAYMENT_GATEWAY, PaymentGateway } from '../payments/gateway/payment-gateway.interface';
import { RealtimeService } from '../realtime/realtime.service';
import { SettingsService } from '../settings/settings.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { OrdersService } from './orders.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Owns the money side of an order: creating it from the cart with commission snapshots,
 * starting payment at the gateway, and the idempotent PENDING -> PAID / FAILED transitions
 * that both the checkout call and the provider webhooks go through.
 */
@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly settings: SettingsService,
    private readonly subscriptions: SubscriptionsService,
    private readonly orders: OrdersService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  /**
   * Turns the cart into a PENDING order, then starts payment. With the mock gateway the order is
   * paid immediately; with a hosted checkout the buyer is redirected and the webhook flips it to PAID.
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
      if (products.length !== cart.items.length)
        throw new BadRequestException(
          'Some items are no longer available; please review your cart',
        );

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
          orderNumber: generateOrderNumber(),
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
        items: order.items.map((i) => ({
          description: i.productTitle,
          amountCents: i.priceCents,
          quantity: 1,
        })),
        successUrl: `${primaryWebUrl}/orders/${order.id}?status=success`,
        cancelUrl: `${primaryWebUrl}/cart?status=canceled`,
      });
    } catch (err) {
      this.logger.error(
        `Gateway checkout failed for order ${order.orderNumber}: ${(err as Error).message}`,
      );
      await this.markFailed(order.id, 'Payment provider error');
      throw new BadRequestException('Could not start payment; please try again');
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: { gatewayOrderId: checkout.gatewayOrderId },
    });
    if (checkout.status === 'paid')
      await this.markPaid(order.id, { paymentMethod: PaymentMethod.MOCK });
    else if (checkout.status === 'failed') await this.markFailed(order.id, 'Payment declined');

    return {
      order: await this.orders.getForBuyer(buyerId, order.id),
      checkoutUrl: checkout.checkoutUrl ?? null,
    };
  }

  // ---- State transitions (idempotent) ----------------------------------------

  async markPaid(orderId: string, info: { chargeId?: string; paymentMethod?: PaymentMethod }) {
    const holdDays = await this.settings.get(SETTING_KEYS.PENDING_HOLD_DAYS);
    const availableAt = new Date(Date.now() + holdDays * DAY_MS);

    const paid = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === OrderStatus.PAID) return null; // duplicate webhook
      if (order.status !== OrderStatus.PENDING)
        this.logger.warn(`Order ${order.orderNumber} received payment while ${order.status}`);

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
        await tx.product.update({
          where: { id: item.productId },
          data: { salesCount: { increment: 1 } },
        });
      }

      // Remove purchased products from the buyer's cart.
      const cart = await tx.cart.findUnique({ where: { userId: order.buyerId } });
      if (cart)
        await tx.cartItem.deleteMany({
          where: { cartId: cart.id, productId: { in: order.items.map((i) => i.productId) } },
        });

      await this.audit.log(
        {
          actorId: order.buyerId,
          action: 'order.paid',
          entityType: 'Order',
          entityId: orderId,
          metadata: { totalCents: order.totalCents },
        },
        tx,
      );
      return order;
    });

    if (!paid) return;
    this.realtime.toUser(paid.buyerId, 'order.paid', {
      orderId: paid.id,
      orderNumber: paid.orderNumber,
    });
    for (const item of paid.items) {
      this.realtime.toVendor(item.vendorId, 'sale.new', {
        orderItemId: item.id,
        orderNumber: paid.orderNumber,
        productTitle: item.productTitle,
        vendorNetCents: item.vendorNetCents,
      });
    }
  }

  async markFailed(orderId: string, reason: string) {
    await this.prisma.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING },
      data: { status: OrderStatus.FAILED, failureReason: reason },
    });
  }

  async markPaidByGatewayId(
    gatewayOrderId: string,
    info: { chargeId?: string; paymentMethod?: string },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { gatewayOrderId },
      select: { id: true },
    });
    if (!order) {
      this.logger.warn(`Webhook for unknown gateway order ${gatewayOrderId}`);
      return;
    }
    await this.markPaid(order.id, {
      chargeId: info.chargeId,
      paymentMethod: toPaymentMethod(info.paymentMethod),
    });
  }

  async markFailedByGatewayId(gatewayOrderId: string, reason?: string) {
    const order = await this.prisma.order.findUnique({
      where: { gatewayOrderId },
      select: { id: true },
    });
    if (order) await this.markFailed(order.id, reason ?? 'Payment failed');
  }
}

export function generateOrderNumber(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `ORD-${date}-${randomBytes(3).toString('hex').toUpperCase()}`;
}

const PAYMENT_METHOD_BY_NAME: Record<string, PaymentMethod> = {
  card: PaymentMethod.CREDIT_CARD,
  credit_card: PaymentMethod.CREDIT_CARD,
  pix: PaymentMethod.PIX,
  boleto: PaymentMethod.BOLETO,
};

export function toPaymentMethod(raw?: string): PaymentMethod | undefined {
  return raw ? PAYMENT_METHOD_BY_NAME[raw.toLowerCase()] : undefined;
}
