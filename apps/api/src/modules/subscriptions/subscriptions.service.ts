import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Plan, Prisma, Subscription, SubscriptionStatus, VendorStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PAYMENT_GATEWAY, PaymentGateway, SubscriptionResult } from '../payments/gateway/payment-gateway.interface';
import { PlansService } from '../plans/plans.service';
import { RealtimeService } from '../realtime/realtime.service';

export type SubscriptionWithPlan = Subscription & { plan: Plan };

const ENTITLING_STATUSES: SubscriptionStatus[] = [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED];

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  /**
   * The subscription that currently entitles the vendor to sell, or null.
   * ACTIVE always entitles; CANCELED entitles until the paid period ends.
   */
  async getEntitling(vendorId: string, tx: Prisma.TransactionClient = this.prisma): Promise<SubscriptionWithPlan | null> {
    return tx.subscription.findFirst({
      where: {
        vendorId,
        status: { in: ENTITLING_STATUSES },
        OR: [{ status: SubscriptionStatus.ACTIVE }, { currentPeriodEnd: { gt: new Date() } }],
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Throws unless the vendor is active and has an entitling subscription. */
  async requireEntitled(vendorId: string, tx: Prisma.TransactionClient = this.prisma): Promise<SubscriptionWithPlan> {
    const vendor = await tx.vendor.findUnique({ where: { id: vendorId }, select: { status: true } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    if (vendor.status === VendorStatus.SUSPENDED) throw new ForbiddenException('Vendor account is suspended');

    const sub = await this.getEntitling(vendorId, tx);
    if (!sub) throw new ForbiddenException('An active plan subscription is required');
    return sub;
  }

  async getCurrent(vendorId: string) {
    const [current, history] = await Promise.all([
      this.getEntitling(vendorId),
      this.prisma.subscription.findMany({
        where: { vendorId },
        include: { plan: { select: { id: true, name: true, priceCents: true, interval: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);
    // A checkout that was started but never completed shows as pending so the UI can explain it.
    const pending = current ? null : await this.prisma.subscription.findFirst({ where: { vendorId, status: SubscriptionStatus.PENDING }, include: { plan: true }, orderBy: { createdAt: 'desc' } });
    return { current, pending, history };
  }

  /**
   * Subscribes the vendor to a plan.
   * Free plans activate locally. Paid plans go through the gateway: with Stripe the vendor is redirected
   * to a hosted checkout and the subscription becomes ACTIVE when the webhook confirms payment.
   * Switching plans cancels the previous subscription when the new one activates (no proration in the MVP).
   */
  async subscribe(vendorId: string, planId: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId }, include: { user: { select: { id: true, name: true, email: true } } } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    if (vendor.status === VendorStatus.SUSPENDED) throw new ForbiddenException('Vendor account is suspended');

    let plan = await this.plans.getById(planId);
    if (!plan.isActive) throw new BadRequestException('This plan is no longer available');

    const existing = await this.getEntitling(vendorId);
    if (existing && existing.planId === planId && existing.status === SubscriptionStatus.ACTIVE) {
      throw new ConflictException('You are already subscribed to this plan');
    }

    let result: SubscriptionResult;
    if (plan.priceCents === 0) {
      result = this.freePlanResult(plan.interval);
    } else {
      if (!plan.gatewayPlanId) {
        const { gatewayPlanId } = await this.gateway.syncPlan(plan);
        plan = await this.prisma.plan.update({ where: { id: plan.id }, data: { gatewayPlanId } });
      }
      result = await this.gateway.createSubscription({
        vendorId,
        plan,
        customer: { id: vendor.user.id, name: vendor.user.name, email: vendor.user.email },
        successUrl: `${env.WEB_URL.split(',')[0].trim()}/vendor/subscription?status=success`,
        cancelUrl: `${env.WEB_URL.split(',')[0].trim()}/vendor/subscription?status=canceled`,
      });
    }

    const subscription = await this.prisma.$transaction(async (tx) => {
      // Abandoned checkouts for this vendor are superseded by the new attempt.
      await tx.subscription.deleteMany({ where: { vendorId, status: SubscriptionStatus.PENDING } });

      const created = await tx.subscription.create({
        data: {
          vendorId,
          planId: plan.id,
          status: result.status === 'active' ? SubscriptionStatus.ACTIVE : SubscriptionStatus.PENDING,
          gatewaySubscriptionId: result.gatewaySubscriptionId,
          currentPeriodStart: result.currentPeriodStart ?? null,
          currentPeriodEnd: result.currentPeriodEnd ?? null,
        },
        include: { plan: true },
      });

      if (created.status === SubscriptionStatus.ACTIVE) {
        await this.replacePrevious(tx, vendorId, created.id);
      }

      await this.audit.log(
        { actorId: vendor.user.id, action: 'subscription.create', entityType: 'Subscription', entityId: created.id, metadata: { planId: plan.id, status: created.status } },
        tx,
      );
      return created;
    });

    return { subscription, checkoutUrl: result.checkoutUrl ?? null };
  }

  /** Cancels at the gateway; the vendor keeps access until the current period ends. */
  async cancel(vendorId: string, actorId: string) {
    const current = await this.getEntitling(vendorId);
    if (!current || current.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException('There is no active subscription to cancel');
    }

    await this.cancelAtGateway(current.gatewaySubscriptionId);
    const updated = await this.prisma.subscription.update({
      where: { id: current.id },
      data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
      include: { plan: true },
    });
    await this.audit.log({ actorId, action: 'subscription.cancel', entityType: 'Subscription', entityId: current.id });
    return updated;
  }

  // ---- Gateway event handlers (called by the webhook service) ---------------

  /** Activates (first payment) or renews. `newGatewayId` replaces a provisional checkout id with the final subscription id. */
  async markActive(gatewaySubscriptionId: string, periodStart?: Date, periodEnd?: Date, newGatewayId?: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { gatewaySubscriptionId: { in: [gatewaySubscriptionId, ...(newGatewayId ? [newGatewayId] : [])] } },
    });
    if (!sub) {
      this.logger.warn(`Subscription webhook for unknown id ${gatewaySubscriptionId}`);
      return;
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          gatewaySubscriptionId: newGatewayId ?? sub.gatewaySubscriptionId,
          currentPeriodStart: periodStart ?? sub.currentPeriodStart ?? new Date(),
          currentPeriodEnd: periodEnd ?? sub.currentPeriodEnd,
          canceledAt: null,
        },
      });
      await this.replacePrevious(tx, sub.vendorId, sub.id);
    });
    this.realtime.toVendor(sub.vendorId, 'subscription.status', { subscriptionId: sub.id, status: 'ACTIVE' });
  }

  async markPastDue(gatewaySubscriptionId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { gatewaySubscriptionId } });
    if (!sub || sub.status !== SubscriptionStatus.ACTIVE) return;
    await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: SubscriptionStatus.PAST_DUE } });
    this.realtime.toVendor(sub.vendorId, 'subscription.status', { subscriptionId: sub.id, status: 'PAST_DUE' });
  }

  async markCanceled(gatewaySubscriptionId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { gatewaySubscriptionId } });
    if (!sub) return;
    const open: SubscriptionStatus[] = [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.PENDING];
    if (!open.includes(sub.status)) return;
    await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() } });
    this.realtime.toVendor(sub.vendorId, 'subscription.status', { subscriptionId: sub.id, status: 'CANCELED' });
  }

  async listForAdmin(vendorId?: string) {
    return this.prisma.subscription.findMany({
      where: { vendorId },
      include: { plan: { select: { id: true, name: true } }, vendor: { select: { id: true, storeName: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // ---- helpers ------------------------------------------------------------

  /** Marks the vendor active and closes any other live subscription once `keepId` is confirmed active. */
  private async replacePrevious(tx: Prisma.TransactionClient, vendorId: string, keepId: string) {
    const others = await tx.subscription.findMany({
      where: { vendorId, id: { not: keepId }, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] } },
    });
    for (const other of others) {
      await this.cancelAtGateway(other.gatewaySubscriptionId);
      await tx.subscription.update({ where: { id: other.id }, data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date(), currentPeriodEnd: new Date() } });
    }
    await tx.vendor.updateMany({ where: { id: vendorId, status: VendorStatus.PENDING }, data: { status: VendorStatus.ACTIVE } });
  }

  private freePlanResult(interval: 'MONTH' | 'YEAR'): SubscriptionResult {
    const start = new Date();
    const end = new Date(start);
    if (interval === 'YEAR') end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);
    return { gatewaySubscriptionId: `free_${randomUUID()}`, status: 'active', currentPeriodStart: start, currentPeriodEnd: end };
  }

  private async cancelAtGateway(gatewaySubscriptionId: string | null) {
    if (!gatewaySubscriptionId || gatewaySubscriptionId.startsWith('free_') || gatewaySubscriptionId.startsWith('mock_')) return;
    try {
      await this.gateway.cancelSubscription(gatewaySubscriptionId);
    } catch (err) {
      // Local state is the source of truth for entitlement; a gateway hiccup must not block the user.
      this.logger.error(`Gateway cancel failed for ${gatewaySubscriptionId}: ${(err as Error).message}`);
    }
  }
}
