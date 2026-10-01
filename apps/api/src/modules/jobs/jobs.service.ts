import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { OrderStatus, SubscriptionStatus } from '@prisma/client';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { CheckoutService } from '../orders/checkout.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

const MINUTE = 60 * 1000;
const PENDING_SETTLE_INTERVAL_MS = 30 * MINUTE;
const SUBSCRIPTION_INTERVAL_MS = 60 * MINUTE;
/** Leave fresh checkouts alone: the buyer may still be on the provider's page. */
const PENDING_MIN_AGE_MS = 15 * MINUTE;
/** Provider calls per run stay bounded; the oldest records go first. */
const BATCH = 50;

/**
 * Housekeeping that must not depend on someone opening a page. Runs in-process on timers, the
 * same way the ledger releases held earnings: one Render instance needs no Redis queue, and every
 * job is safe to run twice (each one goes through the same idempotent transitions as webhooks).
 */
@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private readonly timers: NodeJS.Timeout[] = [];
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly checkout: CheckoutService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  onModuleInit() {
    if (!env.JOBS_ENABLED) {
      this.logger.log('Background jobs disabled (JOBS_ENABLED=false)');
      return;
    }
    this.every(PENDING_SETTLE_INTERVAL_MS, 'settle-pending-orders', () =>
      this.settlePendingOrders(),
    );
    this.every(SUBSCRIPTION_INTERVAL_MS, 'subscriptions', async () => {
      await this.reconcilePendingSubscriptions();
      await this.expireLapsedSubscriptions();
    });
  }

  onModuleDestroy() {
    this.timers.forEach(clearInterval);
  }

  /**
   * Asks the provider about PENDING orders older than a few minutes: paid ones become PAID (a lost
   * webhook), refused ones FAILED, and untouched ones past the checkout window expire.
   */
  async settlePendingOrders(now = Date.now()) {
    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.PENDING,
        gatewayOrderId: { not: null },
        createdAt: { lte: new Date(now - PENDING_MIN_AGE_MS) },
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
      select: { id: true },
    });
    for (const order of orders) await this.checkout.reconcile(order.id);
    return orders.length;
  }

  /** Same safety net for seller plans whose activation webhook may have been lost. */
  async reconcilePendingSubscriptions(now = Date.now()) {
    const pending = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.PENDING,
        gatewaySubscriptionId: { not: null },
        createdAt: { lte: new Date(now - PENDING_MIN_AGE_MS) },
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH,
      select: { vendorId: true },
    });
    const vendors = [...new Set(pending.map((s) => s.vendorId))];
    for (const vendorId of vendors) await this.subscriptions.reconcilePending(vendorId);
    return vendors.length;
  }

  /**
   * A canceled plan keeps selling rights until its paid period ends (entitlement is computed on
   * read). Afterwards it is marked EXPIRED so lists and reports show the real state.
   */
  async expireLapsedSubscriptions(now = new Date()) {
    const result = await this.prisma.subscription.updateMany({
      where: { status: SubscriptionStatus.CANCELED, currentPeriodEnd: { lte: now } },
      data: { status: SubscriptionStatus.EXPIRED },
    });
    if (result.count > 0) this.logger.log(`Expired ${result.count} lapsed subscriptions`);
    return result.count;
  }

  /** Runs a job on an interval, never overlapping itself, never crashing the process. */
  private every(intervalMs: number, name: string, job: () => Promise<unknown>) {
    const run = async () => {
      if (this.running.has(name)) return;
      this.running.add(name);
      try {
        await job();
      } catch (err) {
        this.logger.error(`Job ${name} failed: ${(err as Error).message}`);
      } finally {
        this.running.delete(name);
      }
    };
    const timer = setInterval(() => void run(), intervalMs);
    timer.unref();
    this.timers.push(timer);
  }
}
