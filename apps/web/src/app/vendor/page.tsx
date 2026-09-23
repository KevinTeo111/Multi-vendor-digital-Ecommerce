'use client';

import Link from 'next/link';
import { BoxIcon, ChartIcon, ClockIcon, WalletIcon } from '@/components/icons';
import { Alert, Badge, Card, LinkButton, Loading, PageHeader, Stat, Table, Td } from '@/components/ui';
import { formatBps, formatDate, formatMoney } from '@/lib/format';
import type { Balance, OrderItem, Paginated, VendorMe } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

type Sales = Paginated<OrderItem> & { totals: { grossCents: number; netCents: number } };

export default function VendorOverview() {
  const me = useFetch<VendorMe>('/vendors/me');
  const balance = useFetch<Balance>('/vendor/finance/balance');
  const sales = useFetch<Sales>('/vendor/sales', { pageSize: 5 });

  if (me.loading || !me.data) return <Loading />;
  const v = me.data;
  const sub = v.subscription;

  return (
    <div className="space-y-6">
      <PageHeader
        title={v.storeName}
        description="Here is what is happening in your store."
        actions={
          <>
            <LinkButton href={`/store/${v.slug}`} variant="secondary">
              View storefront
            </LinkButton>
            <LinkButton href="/vendor/products/new">+ New product</LinkButton>
          </>
        }
      />

      {!sub && (
        <Alert tone="warning">
          You do not have an active plan. <Link href="/vendor/subscription" className="font-semibold underline">Choose a plan</Link> to publish products and withdraw earnings.
        </Alert>
      )}
      {v.status === 'SUSPENDED' && <Alert tone="error">Your store is suspended. Contact support for details.</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total Sales" value={sales.data?.total ?? 0} hint={`Net earned ${formatMoney(sales.data?.totals.netCents ?? 0)}`} icon={<ChartIcon size={18} />} />
        <Stat label="Available Balance" value={formatMoney(balance.data?.availableCents ?? 0)} hint="Ready to withdraw" icon={<WalletIcon size={18} />} />
        <Stat label="Pending Balance" value={formatMoney(balance.data?.pendingCents ?? 0)} hint="Clears after the hold period" icon={<ClockIcon size={18} />} />
        <Stat label="Active Products" value={`${v.usage.listedProducts}${v.usage.maxProducts !== null ? ` / ${v.usage.maxProducts}` : ''}`} hint="Approved + pending review" icon={<BoxIcon size={18} />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card title="Recent Orders" actions={<Link href="/vendor/sales" className="text-sm font-medium text-brand-600 hover:underline">View all</Link>} padded={false}>
          {sales.data && sales.data.items.length > 0 ? (
            <div className="px-5 pb-2">
              <Table headers={['Order', 'Product', 'Date', 'Net']}>
                {sales.data.items.map((s) => (
                  <tr key={s.id}>
                    <Td className="font-mono text-xs">{s.order?.orderNumber}</Td>
                    <Td className="max-w-[240px] truncate">{s.productTitle}</Td>
                    <Td className="text-xs text-slate-500">{formatDate(s.order?.paidAt)}</Td>
                    <Td className="font-semibold">{formatMoney(s.vendorNetCents)}</Td>
                  </tr>
                ))}
              </Table>
            </div>
          ) : (
            <p className="p-5 text-sm text-slate-500">No sales yet. Once your products are approved and sell, orders show up here.</p>
          )}
        </Card>

        <Card title="Current Plan" actions={<Link href="/vendor/subscription" className="text-sm font-medium text-brand-600 hover:underline">Manage</Link>}>
          {sub ? (
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Plan</dt>
                <dd className="flex items-center gap-2 font-semibold">
                  {sub.plan.name} <Badge status={sub.status} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Commission</dt>
                <dd className="font-semibold">{formatBps(sub.plan.commissionRateBps)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Product limit</dt>
                <dd className="font-semibold">{sub.plan.maxProducts ?? 'Unlimited'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Withdrawals</dt>
                <dd className="font-semibold">{sub.plan.withdrawalsPerWeek} / week</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">{sub.status === 'CANCELED' ? 'Access until' : 'Renews'}</dt>
                <dd className="font-semibold">{formatDate(sub.currentPeriodEnd)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-500">No plan selected.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
