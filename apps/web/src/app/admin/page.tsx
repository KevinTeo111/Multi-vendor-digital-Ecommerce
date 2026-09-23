'use client';

import Link from 'next/link';
import { Card, Loading, PageHeader, Stat } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import type { FinanceSummary, Paginated, VendorProduct, Withdrawal } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

export default function AdminOverview() {
  const summary = useFetch<FinanceSummary>('/admin/finance/summary');
  const pendingProducts = useFetch<Paginated<VendorProduct>>('/admin/products', { status: 'PENDING_REVIEW', pageSize: 5 });
  const pendingWithdrawals = useFetch<Paginated<Withdrawal>>('/admin/finance/withdrawals', { status: 'REQUESTED', pageSize: 5 });

  if (!summary.data) return <Loading />;
  const s = summary.data;
  const paidOut = s.withdrawals.find((w) => w.status === 'PAID');

  return (
    <div className="space-y-6">
      <PageHeader title="Platform overview" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Gross sales" value={formatMoney(s.grossSalesCents)} hint={`${s.paidItems} items sold`} />
        <Stat label="Commission earned" value={formatMoney(s.commissionCents)} />
        <Stat label="Owed to vendors" value={formatMoney(s.vendorPendingCents + s.vendorAvailableCents)} hint={`${formatMoney(s.vendorAvailableCents)} available`} />
        <Stat label="Paid out" value={formatMoney(paidOut?.amountCents ?? 0)} hint={`${paidOut?.count ?? 0} withdrawals`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Products awaiting review (${pendingProducts.data?.total ?? 0})`} actions={<Link href="/admin/products" className="text-sm text-indigo-600 hover:underline">Review queue</Link>}>
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {pendingProducts.data?.items.map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <Link href={`/admin/products/${p.id}`} className="hover:underline">
                  {p.title}
                </Link>
                <span className="text-slate-500">{p.vendor?.storeName}</span>
              </li>
            ))}
            {pendingProducts.data?.items.length === 0 && <li className="py-2 text-slate-500">Queue is empty.</li>}
          </ul>
        </Card>
        <Card title={`Withdrawals requested (${pendingWithdrawals.data?.total ?? 0})`} actions={<Link href="/admin/withdrawals" className="text-sm text-indigo-600 hover:underline">Process</Link>}>
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {pendingWithdrawals.data?.items.map((w) => (
              <li key={w.id} className="flex justify-between py-2">
                <span>{w.vendor?.storeName}</span>
                <span className="font-medium">{formatMoney(w.amountCents)}</span>
              </li>
            ))}
            {pendingWithdrawals.data?.items.length === 0 && <li className="py-2 text-slate-500">Nothing pending.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
