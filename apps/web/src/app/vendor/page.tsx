'use client';

import Link from 'next/link';
import { Alert, Badge, Card, LinkButton, Loading, PageHeader, Stat } from '@/components/ui';
import { formatBps, formatDate, formatMoney } from '@/lib/format';
import type { Balance, VendorMe } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

export default function VendorOverview() {
  const me = useFetch<VendorMe>('/vendors/me');
  const balance = useFetch<Balance>('/vendor/finance/balance');
  const sales = useFetch<{ total: number; totals: { grossCents: number; netCents: number } }>('/vendor/sales', { pageSize: 1 });

  if (me.loading || !me.data) return <Loading />;
  const v = me.data;
  const sub = v.subscription;

  return (
    <div className="space-y-6">
      <PageHeader
        title={v.storeName}
        description={`Store status: ${v.status.toLowerCase()}`}
        actions={
          <>
            <LinkButton href={`/store/${v.slug}`} variant="secondary">
              View storefront
            </LinkButton>
            <LinkButton href="/vendor/products/new">New product</LinkButton>
          </>
        }
      />

      {!sub && (
        <Alert tone="warning">
          You do not have an active plan. <Link href="/vendor/subscription" className="underline">Choose a plan</Link> to publish products and withdraw earnings.
        </Alert>
      )}
      {v.status === 'SUSPENDED' && <Alert tone="error">Your store is suspended. Contact support for details.</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Available balance" value={formatMoney(balance.data?.availableCents ?? 0)} hint="Ready to withdraw" />
        <Stat label="Pending balance" value={formatMoney(balance.data?.pendingCents ?? 0)} hint="Clears after the hold period" />
        <Stat label="Total sales" value={sales.data?.total ?? 0} hint={`Net earned ${formatMoney(sales.data?.totals.netCents ?? 0)}`} />
        <Stat label="Listed products" value={`${v.usage.listedProducts}${v.usage.maxProducts !== null ? ` / ${v.usage.maxProducts}` : ''}`} hint="Approved + pending review" />
      </div>

      <Card title="Current plan" actions={<Link href="/vendor/subscription" className="text-sm text-indigo-600 hover:underline">Manage</Link>}>
        {sub ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-slate-500">Plan</dt>
              <dd className="font-medium">
                {sub.plan.name} <Badge status={sub.status} />
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Commission</dt>
              <dd className="font-medium">{formatBps(sub.plan.commissionRateBps)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Withdrawals</dt>
              <dd className="font-medium">{sub.plan.withdrawalsPerWeek} per week</dd>
            </div>
            <div>
              <dt className="text-slate-500">Renews</dt>
              <dd className="font-medium">{formatDate(sub.currentPeriodEnd)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-slate-500">No plan selected.</p>
        )}
      </Card>
    </div>
  );
}
