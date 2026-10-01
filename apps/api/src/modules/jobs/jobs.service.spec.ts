process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-0123456789abcdef0123456789';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-0123456789abcdef0123456789';

import { OrderStatus, SubscriptionStatus } from '@prisma/client';
import { JobsService } from './jobs.service';

const NOW = Date.parse('2026-10-01T12:00:00Z');
const MIN = 60 * 1000;

function setup() {
  const prisma = {
    order: { findMany: jest.fn(async () => [{ id: 'o1' }, { id: 'o2' }]) },
    subscription: {
      findMany: jest.fn(async () => [{ vendorId: 'v1' }, { vendorId: 'v1' }, { vendorId: 'v2' }]),
      updateMany: jest.fn(async () => ({ count: 3 })),
    },
  };
  const checkout = { reconcile: jest.fn(async () => undefined) };
  const subscriptions = { reconcilePending: jest.fn(async () => undefined) };
  const jobs = new JobsService(prisma as never, checkout as never, subscriptions as never);
  return { jobs, prisma, checkout, subscriptions };
}

describe('JobsService', () => {
  it('settles only pending gateway orders older than 15 minutes, oldest first, in batches', async () => {
    const { jobs, prisma, checkout } = setup();
    await expect(jobs.settlePendingOrders(NOW)).resolves.toBe(2);
    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: OrderStatus.PENDING,
          gatewayOrderId: { not: null },
          createdAt: { lte: new Date(NOW - 15 * MIN) },
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      }),
    );
    expect(checkout.reconcile.mock.calls).toEqual([['o1'], ['o2']]);
  });

  it('reconciles each vendor with a stale pending subscription once', async () => {
    const { jobs, subscriptions } = setup();
    await expect(jobs.reconcilePendingSubscriptions(NOW)).resolves.toBe(2);
    expect(subscriptions.reconcilePending.mock.calls).toEqual([['v1'], ['v2']]);
  });

  it('expires only canceled plans whose paid period has ended', async () => {
    const { jobs, prisma } = setup();
    const now = new Date(NOW);
    await expect(jobs.expireLapsedSubscriptions(now)).resolves.toBe(3);
    expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
      where: { status: SubscriptionStatus.CANCELED, currentPeriodEnd: { lte: now } },
      data: { status: SubscriptionStatus.EXPIRED },
    });
  });

  it('starts no timers when disabled', async () => {
    jest.resetModules();
    process.env.JOBS_ENABLED = 'false';
    const { JobsService: Fresh } = await import('./jobs.service');
    const spy = jest.spyOn(global, 'setInterval');
    new Fresh({} as never, {} as never, {} as never).onModuleInit();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    delete process.env.JOBS_ENABLED;
  });
});
