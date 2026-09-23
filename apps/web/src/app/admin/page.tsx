'use client';

import Link from 'next/link';
import { BoxIcon, ChartIcon, StoreIcon, WalletIcon } from '@/components/icons';
import { Badge, Card, Loading, PageHeader, Stat } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import type { FinanceSummary, Paginated, VendorProduct, Withdrawal } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

export default function AdminOverview() {
  const summary = useFetch<FinanceSummary>('/admin/finance/summary');
  const pendingProducts = useFetch<Paginated<VendorProduct>>('/admin/products', { status: 'PENDING_REVIEW', pageSize: 6 });
  const pendingWithdrawals = useFetch<Paginated<Withdrawal>>('/admin/finance/withdrawals', { status: 'REQUESTED', pageSize: 6 });

  if (!summary.data) return <Loading />;
  const s = summary.data;
  const paidOut = s.withdrawals.find((w) => w.status === 'PAID');

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Overview" description="Sales, commissions and what needs your attention." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total Revenue" value={formatMoney(s.grossSalesCents)} hint={`${s.paidItems} items sold`} icon={<ChartIcon size={18} />} />
        <Stat label="Commission Earned" value={formatMoney(s.commissionCents)} hint="Platform share of paid sales" icon={<WalletIcon size={18} />} />
        <Stat label="Owed to Sellers" value={formatMoney(s.vendorPendingCents + s.vendorAvailableCents)} hint={`${formatMoney(s.vendorAvailableCents)} available now`} icon={<StoreIcon size={18} />} />
        <Stat label="Paid Out" value={formatMoney(paidOut?.amountCents ?? 0)} hint={`${paidOut?.count ?? 0} withdrawals`} icon={<BoxIcon size={18} />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card
          title="Products Awaiting Review"
          subtitle={`${pendingProducts.data?.total ?? 0} in queue`}
          actions={<Link href="/admin/products" className="text-sm font-medium text-brand-600 hover:underline">Open queue</Link>}
        >
          <ul className="divide-y divide-slate-100 text-sm">
            {pendingProducts.data?.items.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <div className="h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.thumbnailUrl && <img src={p.thumbnailUrl} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/products/${p.id}`} className="block truncate font-medium text-slate-900 hover:text-brand-600">
                    {p.title}
                  </Link>
                  <span className="text-xs text-slate-500">{p.vendor?.storeName}</span>
                </div>
                <Badge status={p.status} />
              </li>
            ))}
            {pendingProducts.data?.items.length === 0 && <li className="py-3 text-slate-500">Queue is empty.</li>}
          </ul>
        </Card>

        <Card
          title="Withdrawal Requests"
          subtitle={`${pendingWithdrawals.data?.total ?? 0} waiting`}
          actions={<Link href="/admin/withdrawals" className="text-sm font-medium text-brand-600 hover:underline">Process</Link>}
        >
          <ul className="divide-y divide-slate-100 text-sm">
            {pendingWithdrawals.data?.items.map((w) => (
              <li key={w.id} className="flex items-center gap-3 py-2.5">
                <span className="bg-brand-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">{w.vendor?.storeName?.[0]}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-slate-900">{w.vendor?.storeName}</span>
                <span className="font-semibold">{formatMoney(w.amountCents)}</span>
              </li>
            ))}
            {pendingWithdrawals.data?.items.length === 0 && <li className="py-3 text-slate-500">Nothing pending.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
