import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  LedgerEntryStatus,
  LedgerEntryType,
  LicenseType,
  OrderStatus,
  PaymentMethod,
  Prisma,
  ProductStatus,
  VendorStatus,
} from '@prisma/client';
import { SETTING_KEYS, splitSaleWithFee } from '@marketplace/shared';
import { randomBytes } from 'node:crypto';
import { primaryWebUrl } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CartService } from '../cart/cart.service';
import { withoutCoupon } from '../coupons/coupon-math';
import { CouponsService } from '../coupons/coupons.service';
import { PAYMENT_GATEWAY, PaymentGateway } from '../payments/gateway/payment-gateway.interface';
import { RealtimeService } from '../realtime/realtime.service';
import { SettingsService } from '../settings/settings.service';
import { removeReviewsForOrderItems } from '../reviews/rating';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { OrdersService } from './orders.service';
import { generatePurchaseCode } from './purchase-code';
import { decideReconciliation } from './reconciliation';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Orders still waiting for the provider; a late payment on a FAILED order is honoured too. */
const PAYABLE_STATUSES: OrderStatus[] = [OrderStatus.PENDING, OrderStatus.FAILED];

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
    private readonly coupons: CouponsService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  /**
   * Turns the cart into a PENDING order, then starts payment. With the mock gateway the order is
   * paid immediately; with a hosted checkout the buyer is redirected and the webhook flips it to PAID.
   */
  async checkout(buyerId: string, couponCode?: string) {
    const buyer = await this.prisma.user.findUniqueOrThrow({
      where: { id: buyerId },
      select: { id: true, name: true, email: true },
    });
    const currency = await this.settings.get(SETTING_KEYS.SITE_CURRENCY);

    const order = await this.prisma.$transaction(async (tx) => {
      const priced = await this.price(buyerId, couponCode, tx, true);
      const order = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          buyerId,
          status: OrderStatus.PENDING,
          subtotalCents: priced.subtotalCents,
          discountCents: priced.discountCents,
          totalCents: priced.totalCents,
          couponCode: priced.coupon?.code ?? null,
          currency,
          items: {
            create: priced.lines.map((line) => ({ ...line, purchaseCode: generatePurchaseCode() })),
          },
        },
        include: { items: true },
      });
      if (priced.coupon)
        await tx.couponRedemption.create({
          data: {
            couponId: priced.coupon.id,
            orderId: order.id,
            buyerId,
            discountCents: priced.discountCents,
          },
        });
      return order;
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
          description:
            i.licenseType === LicenseType.EXTENDED
              ? `${i.productTitle} (Extended licence)`
              : i.productTitle,
          amountCents: i.priceCents - i.discountCents,
          quantity: 1,
        })),
        successUrl: `${primaryWebUrl}/orders/${order.id}?status=success`,
        pendingUrl: `${primaryWebUrl}/orders/${order.id}?status=pending`,
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

  /** What the buyer would pay right now, with an optional coupon. Nothing is written. */
  async preview(buyerId: string, couponCode?: string) {
    const priced = await this.price(buyerId, couponCode, this.prisma, false);
    return {
      subtotalCents: priced.subtotalCents,
      discountCents: priced.discountCents,
      totalCents: priced.totalCents,
      couponCode: priced.coupon?.code ?? null,
      items: priced.lines.map((l) => ({
        productId: l.productId,
        licenseType: l.licenseType,
        priceCents: l.priceCents,
        discountCents: l.discountCents,
      })),
    };
  }

  /**
   * Prices the cart: listed price per chosen licence, the fee / commission / seller split frozen
   * per line, then the coupon (validated, and locked when called from checkout).
   */
  private async price(
    buyerId: string,
    couponCode: string | undefined,
    tx: Prisma.TransactionClient,
    lock: boolean,
  ) {
    const cart = await this.cart.get(buyerId);
    if (cart.items.length === 0) throw new BadRequestException('Your cart is empty');
    const defaultCommissionBps = await this.settings.get(SETTING_KEYS.DEFAULT_COMMISSION_BPS);
    const licenseOf = new Map(cart.items.map((i) => [i.product.id, i.licenseType]));

    const products = await tx.product.findMany({
      where: {
        id: { in: cart.items.map((i) => i.product.id) },
        status: ProductStatus.APPROVED,
        vendor: { status: VendorStatus.ACTIVE },
      },
      select: {
        id: true,
        title: true,
        priceCents: true,
        basePriceCents: true,
        extendedPriceCents: true,
        extendedBasePriceCents: true,
        vendorId: true,
      },
    });
    if (products.length !== cart.items.length)
      throw new BadRequestException('Some items are no longer available; please review your cart');

    // Commission rate comes from each vendor's plan at this moment and is frozen on the item.
    const rateByVendor = new Map<string, { rateBps: number; planId: string | null }>();
    for (const vendorId of new Set(products.map((p) => p.vendorId))) {
      const sub = await this.subscriptions.getEntitling(vendorId, tx);
      rateByVendor.set(vendorId, {
        rateBps: sub?.plan.commissionRateBps ?? defaultCommissionBps,
        planId: sub?.planId ?? null,
      });
    }

    const lines = products.map((p) => {
      const { rateBps, planId } = rateByVendor.get(p.vendorId)!;
      const licenseType = licenseOf.get(p.id) ?? LicenseType.REGULAR;
      const extended = licenseType === LicenseType.EXTENDED;
      if (extended && p.extendedPriceCents === null)
        throw new BadRequestException(
          `The extended licence of "${p.title}" is no longer offered; please review your cart`,
        );
      const priceCents = extended ? p.extendedPriceCents! : p.priceCents;
      const baseCents = extended
        ? (p.extendedBasePriceCents ?? priceCents)
        : (p.basePriceCents ?? p.priceCents);
      // The buyer pays the listed price; the fee reserve covers the provider, the commission is
      // taken from the seller's own price, and the seller keeps the rest.
      const split = splitSaleWithFee(priceCents, baseCents, rateBps);
      return {
        productId: p.id,
        vendorId: p.vendorId,
        planId,
        productTitle: p.title,
        licenseType,
        priceCents,
        commissionRateBps: rateBps,
        ...split,
      };
    });

    const subtotalCents = lines.reduce((s, l) => s + l.priceCents, 0);
    if (!couponCode?.trim()) {
      return {
        lines: withoutCoupon(lines),
        subtotalCents,
        discountCents: 0,
        totalCents: subtotalCents,
        coupon: null,
      };
    }
    const quote = await this.coupons.quote(couponCode, buyerId, lines, tx, lock);
    return {
      lines: quote.outcome.lines,
      subtotalCents,
      discountCents: quote.outcome.discountCents,
      totalCents: subtotalCents - quote.outcome.discountCents,
      coupon: { id: quote.couponId, code: quote.code },
    };
  }

  // ---- State transitions (idempotent) ----------------------------------------

  async markPaid(orderId: string, info: { chargeId?: string; paymentMethod?: PaymentMethod }) {
    const holdDays = await this.settings.get(SETTING_KEYS.PENDING_HOLD_DAYS);
    const availableAt = new Date(Date.now() + holdDays * DAY_MS);

    const paid = await this.prisma.$transaction(async (tx) => {
      // Compare-and-set: exactly one caller (webhook, retry or reconciliation) wins the transition,
      // so ledger entries are never written twice even under concurrent confirmations.
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: { in: PAYABLE_STATUSES } },
        data: {
          status: OrderStatus.PAID,
          paidAt: new Date(),
          gatewayChargeId: info.chargeId,
          paymentMethod: info.paymentMethod,
          failureReason: null,
        },
      });
      if (claimed.count === 0) {
        const exists = await tx.order.findUnique({ where: { id: orderId }, select: { id: true } });
        if (!exists) throw new NotFoundException('Order not found');
        return null; // already PAID (duplicate confirmation) or not payable (canceled / refunded)
      }
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
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

  /**
   * Safety net for lost webhooks: for a PENDING order, asks the provider what happened and applies
   * the answer through the same transitions a webhook would. Never throws; a provider hiccup must
   * not break reading the order.
   */
  async reconcile(orderId: string, buyerId?: string) {
    if (!this.gateway.lookupOrder) return;
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, ...(buyerId ? { buyerId } : {}) },
      select: { id: true, orderNumber: true, status: true, gatewayOrderId: true, createdAt: true },
    });
    if (!order || order.status !== OrderStatus.PENDING || !order.gatewayOrderId) return;

    try {
      const event = await this.gateway.lookupOrder(order.gatewayOrderId);
      const action = decideReconciliation(event, order.createdAt);
      if (action.kind === 'paid') {
        this.logger.log(`Reconciled order ${order.orderNumber}: paid at the provider`);
        await this.markPaid(order.id, {
          chargeId: action.chargeId,
          paymentMethod: toPaymentMethod(action.paymentMethod),
        });
      } else if (action.kind === 'failed') {
        this.logger.log(`Reconciled order ${order.orderNumber}: ${action.reason}`);
        await this.markFailed(order.id, action.reason);
      }
    } catch (err) {
      this.logger.warn(`Reconciliation of ${order.orderNumber} failed: ${(err as Error).message}`);
    }
  }

  // ---- Refunds and chargebacks ------------------------------------------------

  /**
   * Admin refund: Mercado Pago returns the money to the buyer first; only when it accepts is the
   * order reversed here. If the provider refuses, nothing changes on our side.
   */
  async refund(orderId: string, adminId: string, reason: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.PAID)
      throw new BadRequestException('Only paid orders can be refunded');

    const paidThroughProvider = order.paymentMethod !== PaymentMethod.MOCK;
    if (paidThroughProvider) {
      if (!order.gatewayChargeId || !this.gateway.refundPayment)
        throw new BadRequestException('This order has no provider payment to refund');
      try {
        await this.gateway.refundPayment(order.gatewayChargeId);
      } catch (err) {
        this.logger.error(`Refund of ${order.orderNumber} refused: ${(err as Error).message}`);
        throw new BadRequestException(
          'The payment provider did not accept the refund. Check the payment in its dashboard.',
        );
      }
    }
    await this.markRefunded(order.id, { reason, actorId: adminId, chargeback: false });
    return this.orders.getForAdmin(order.id);
  }

  /**
   * PAID → REFUNDED, exactly once (compare-and-set), for refunds and chargebacks alike: every
   * seller credit is reversed with a REFUND_DEBIT, the sale leaves the counters, and download
   * access ends because downloads require a PAID order. A seller who already withdrew the money
   * goes negative; new sales cover it and withdrawals stay blocked until then.
   */
  async markRefunded(
    orderId: string,
    opts: { reason: string; actorId?: string; chargeback: boolean },
  ) {
    const reason = opts.chargeback ? `Chargeback: ${opts.reason}` : opts.reason;
    const refunded = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.PAID },
        data: { status: OrderStatus.REFUNDED, refundedAt: new Date(), refundReason: reason },
      });
      if (claimed.count === 0) return null; // already refunded, or never paid

      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { items: true },
      });
      await removeReviewsForOrderItems(
        tx,
        order.items.map((i) => i.id),
      );
      for (const item of order.items) {
        // Reverse the credit where it sits: a credit still on hold is reversed on hold with the
        // same release date (both mature together and net to zero), so a refund never pushes the
        // available balance negative for money the seller could not withdraw yet.
        const credit = await tx.ledgerEntry.findFirst({
          where: { orderItemId: item.id, type: LedgerEntryType.SALE_CREDIT },
          select: { status: true, availableAt: true },
        });
        const onHold = credit?.status === LedgerEntryStatus.PENDING;
        await tx.ledgerEntry.create({
          data: {
            vendorId: item.vendorId,
            type: LedgerEntryType.REFUND_DEBIT,
            status: onHold ? LedgerEntryStatus.PENDING : LedgerEntryStatus.AVAILABLE,
            amountCents: -item.vendorNetCents,
            availableAt: onHold ? credit.availableAt : new Date(),
            orderItemId: item.id,
            description: `${opts.chargeback ? 'Chargeback' : 'Refund'}: ${item.productTitle}`,
          },
        });
        await tx.product.updateMany({
          where: { id: item.productId, salesCount: { gt: 0 } },
          data: { salesCount: { decrement: 1 } },
        });
      }
      await this.audit.log(
        {
          actorId: opts.actorId ?? null,
          action: opts.chargeback ? 'order.chargeback' : 'order.refunded',
          entityType: 'Order',
          entityId: orderId,
          metadata: { totalCents: order.totalCents, reason },
        },
        tx,
      );
      return order;
    });

    if (!refunded) return;
    this.realtime.toUser(refunded.buyerId, 'order.refunded', {
      orderId: refunded.id,
      orderNumber: refunded.orderNumber,
    });
    for (const item of refunded.items) {
      this.realtime.toVendor(item.vendorId, 'sale.refunded', {
        orderItemId: item.id,
        orderNumber: refunded.orderNumber,
        productTitle: item.productTitle,
        amountCents: item.vendorNetCents,
        chargeback: opts.chargeback,
      });
    }
  }

  /** Refund or chargeback reported by the provider (including ones done in its dashboard). */
  async markRefundedByGatewayId(gatewayOrderId: string, reason: string, chargeback: boolean) {
    const order = await this.prisma.order.findUnique({
      where: { gatewayOrderId },
      select: { id: true },
    });
    if (!order) {
      this.logger.warn(`Refund webhook for unknown gateway order ${gatewayOrderId}`);
      return;
    }
    await this.markRefunded(order.id, { reason, chargeback });
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
  debit_card: PaymentMethod.CREDIT_CARD,
  pix: PaymentMethod.PIX,
  boleto: PaymentMethod.BOLETO,
};

export function toPaymentMethod(raw?: string): PaymentMethod | undefined {
  return raw ? PAYMENT_METHOD_BY_NAME[raw.toLowerCase()] : undefined;
}
