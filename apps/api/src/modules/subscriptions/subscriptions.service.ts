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
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { randomUUID } from 'node:crypto';
import { PAYMENT_GATEWAY, PaymentGateway, SubscriptionResult } from '../payments/gateway/payment-gateway.interface';
import { PlansService } from '../plans/plans.service';

export type SubscriptionWithPlan = Subscription & { plan: Plan };

const ENTITLING_STATUSES: SubscriptionStatus[] = [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED];

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
    private readonly audit: AuditService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  /**
   * The subscription that currently entitles the vendor to sell, or null.
   * ACTIVE always entitles; CANCELED entitles until the paid period ends.
   */
  async getEntitling(vendorId: string, tx: Prisma.TransactionClient = this.prisma): Promise<SubscriptionWithPlan | null> {
    const now = new Date();
    const sub = await tx.subscription.findFirst({
      where: {
        vendorId,
        status: { in: ENTITLING_STATUSES },
        OR: [{ status: SubscriptionStatus.ACTIVE }, { currentPeriodEnd: { gt: now } }],
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    return sub;
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
    return { current, history };
  }

  /**
   * Subscribes the vendor to a plan. Switching plans cancels the previous subscription
   * immediately (no proration in the MVP) and starts the new one.
   */
  async subscribe(vendorId: string, planId: string, cardToken?: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    if (vendor.status === VendorStatus.SUSPENDED) throw new ForbiddenException('Vendor account is suspended');

    const plan = await this.plans.getById(planId);
    if (!plan.isActive) throw new BadRequestException('This plan is no longer available');

    const existing = await this.getEntitling(vendorId);
    if (existing && existing.planId === planId && existing.status === SubscriptionStatus.ACTIVE) {
      throw new ConflictException('You are already subscribed to this plan');
    }

    // Free plans never touch the gateway: they are activated locally for one billing period
    // and renewed by the vendor re-subscribing (or by a scheduled job in a later iteration).
    const result: SubscriptionResult =
      plan.priceCents === 0
        ? this.freePlanResult(plan.interval)
        : await this.gateway.createSubscription({
            vendorId,
            planId: plan.id,
            gatewayPlanId: plan.gatewayPlanId,
            planName: plan.name,
            priceCents: plan.priceCents,
            currency: plan.currency,
            interval: plan.interval,
            customer: { id: vendor.user.id, name: vendor.user.name, email: vendor.user.email },
            cardToken,
          });

    const subscription = await this.prisma.$transaction(async (tx) => {
      if (existing && existing.status === SubscriptionStatus.ACTIVE) {
        await this.cancelAtGateway(existing.gatewaySubscriptionId);
        await tx.subscription.update({
          where: { id: existing.id },
          data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date(), currentPeriodEnd: new Date() },
        });
      }

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

      if (created.status === SubscriptionStatus.ACTIVE && vendor.status === VendorStatus.PENDING) {
        await tx.vendor.update({ where: { id: vendorId }, data: { status: VendorStatus.ACTIVE } });
      }

      await this.audit.log(
        {
          actorId: vendor.user.id,
          action: 'subscription.create',
          entityType: 'Subscription',
          entityId: created.id,
          metadata: { planId: plan.id, status: created.status },
        },
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
    await this.audit.log({
      actorId,
      action: 'subscription.cancel',
      entityType: 'Subscription',
      entityId: current.id,
    });
    return updated;
  }

  // ---- Gateway event handlers (called by the webhook controller) ----------

  async markActive(gatewaySubscriptionId: string, periodStart?: Date, periodEnd?: Date) {
    const sub = await this.prisma.subscription.findUnique({ where: { gatewaySubscriptionId } });
    if (!sub) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: periodStart ?? sub.currentPeriodStart ?? new Date(),
          currentPeriodEnd: periodEnd ?? sub.currentPeriodEnd,
        },
      });
      await tx.vendor.updateMany({
        where: { id: sub.vendorId, status: VendorStatus.PENDING },
        data: { status: VendorStatus.ACTIVE },
      });
    });
  }

  async markPastDue(gatewaySubscriptionId: string) {
    await this.prisma.subscription.updateMany({
      where: { gatewaySubscriptionId, status: SubscriptionStatus.ACTIVE },
      data: { status: SubscriptionStatus.PAST_DUE },
    });
  }

  async markCanceled(gatewaySubscriptionId: string) {
    await this.prisma.subscription.updateMany({
      where: { gatewaySubscriptionId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.PENDING] } },
      data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
    });
  }

  async listForAdmin(vendorId?: string) {
    return this.prisma.subscription.findMany({
      where: { vendorId },
      include: {
        plan: { select: { id: true, name: true } },
        vendor: { select: { id: true, storeName: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  private freePlanResult(interval: 'MONTH' | 'YEAR'): SubscriptionResult {
    const start = new Date();
    const end = new Date(start);
    if (interval === 'YEAR') end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);
    return { gatewaySubscriptionId: `free_${randomUUID()}`, status: 'active', currentPeriodStart: start, currentPeriodEnd: end };
  }

  private async cancelAtGateway(gatewaySubscriptionId: string | null) {
    if (!gatewaySubscriptionId || gatewaySubscriptionId.startsWith('free_')) return;
    try {
      await this.gateway.cancelSubscription(gatewaySubscriptionId);
    } catch (err) {
      // Local state is the source of truth for entitlement; a gateway hiccup must not block the user.
      this.logger.error(`Gateway cancel failed for ${gatewaySubscriptionId}: ${(err as Error).message}`);
    }
  }
}
