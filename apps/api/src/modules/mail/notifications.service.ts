import { Inject, Injectable, Logger } from '@nestjs/common';
import { ProductStatus, WithdrawalStatus } from '@prisma/client';
import { env, primaryWebUrl } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { MAILER, type MailRecipient, type Mailer } from './mailer';
import {
  orderPaidMail,
  orderRefundedMail,
  passwordResetMail,
  productStatusMail,
  render,
  withdrawalStatusMail,
  type MailContent,
} from './templates';

const ORDER_MAIL_SELECT = {
  id: true,
  orderNumber: true,
  currency: true,
  totalCents: true,
  discountCents: true,
  couponCode: true,
  buyer: { select: { email: true, name: true } },
  items: {
    select: { productTitle: true, priceCents: true, licenseType: true, purchaseCode: true },
  },
} as const;

/**
 * The automatic e-mails. Domain services call one method after their change is committed;
 * sending happens in the background and never throws, so a mail failure cannot undo or delay a
 * payment, a review decision or a withdrawal. Failures are logged.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  passwordReset(to: MailRecipient, resetUrl: string, expiresAt: Date) {
    this.dispatch('password-reset', async () => ({
      to,
      content: passwordResetMail(to.name, resetUrl, expiresAt),
    }));
  }

  /** Buyer: payment confirmed, with the items, purchase codes and the download link. */
  orderPaid(orderId: string) {
    this.dispatch('order-paid', async () => {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: ORDER_MAIL_SELECT,
      });
      if (!order) return null;
      return {
        to: order.buyer,
        content: orderPaidMail(order.buyer.name, order, `${primaryWebUrl}/library`),
      };
    });
  }

  /** Buyer: the order was refunded by the platform. */
  orderRefunded(orderId: string) {
    this.dispatch('order-refunded', async () => {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: ORDER_MAIL_SELECT,
      });
      if (!order) return null;
      return {
        to: order.buyer,
        content: orderRefundedMail(order.buyer.name, order, `${primaryWebUrl}/orders/${order.id}`),
      };
    });
  }

  /** Seller: the admin approved, rejected or blocked a product. Other statuses send nothing. */
  productStatus(productId: string) {
    this.dispatch('product-status', async () => {
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          rejectionReason: true,
          vendor: { select: { user: { select: { email: true, name: true } } } },
        },
      });
      if (!product) return null;
      const { status } = product;
      if (
        status !== ProductStatus.APPROVED &&
        status !== ProductStatus.REJECTED &&
        status !== ProductStatus.BLOCKED
      )
        return null;
      const url =
        status === ProductStatus.APPROVED
          ? `${primaryWebUrl}/products/${product.slug}`
          : `${primaryWebUrl}/vendor/products/${product.id}`;
      const to = product.vendor.user;
      return {
        to,
        content: productStatusMail(
          to.name,
          { title: product.title, status, reason: product.rejectionReason },
          url,
        ),
      };
    });
  }

  /** Seller: a withdrawal was approved, paid, rejected or its payment failed. */
  withdrawalStatus(withdrawalId: string) {
    this.dispatch('withdrawal-status', async () => {
      const w = await this.prisma.withdrawal.findUnique({
        where: { id: withdrawalId },
        select: {
          status: true,
          amountCents: true,
          rejectionReason: true,
          gatewayTransferId: true,
          vendor: { select: { user: { select: { email: true, name: true } } } },
        },
      });
      if (!w || w.status === WithdrawalStatus.REQUESTED) return null;
      const to = w.vendor.user;
      return {
        to,
        content: withdrawalStatusMail(
          to.name,
          {
            status: w.status,
            amountCents: w.amountCents,
            reason: w.rejectionReason,
            // Manual payouts store the admin's payment reference as "manual:<reference>".
            paymentReference: w.gatewayTransferId?.startsWith('manual:')
              ? w.gatewayTransferId.slice('manual:'.length)
              : null,
          },
          `${primaryWebUrl}/vendor/finance`,
        ),
      };
    });
  }

  private dispatch(
    tag: string,
    build: () => Promise<{ to: MailRecipient; content: MailContent } | null>,
  ) {
    void (async () => {
      const message = await build();
      if (!message) return;
      await this.mailer.send({
        to: message.to,
        tag,
        ...render(message.content, env.MAIL_FROM_NAME),
      });
    })().catch((err: Error) => this.logger.error(`"${tag}" e-mail failed: ${err.message}`));
  }
}
