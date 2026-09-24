'use client';

import Link from 'next/link';
import { BoxIcon, ChartIcon, StoreIcon, WalletIcon } from '@/components/icons';
import { Badge, Card, ListRow, Loading, PageHeader, Stat } from '@/components/ui';
import { useT } from '@/i18n/client';
import { formatDate, formatMoney } from '@/lib/format';
import { useRealtimeEvent } from '@/lib/realtime';
import type { FinanceSummary, Paginated, VendorProduct, Withdrawal } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

export default function AdminOverview() {
  const t = useT();
  const summary = useFetch<FinanceSummary>('/admin/finance/summary');
  const pendingProducts = useFetch<Paginated<VendorProduct>>('/admin/products', { status: 'PENDING_REVIEW', pageSize: 6 });
  const pendingWithdrawals = useFetch<Paginated<Withdrawal>>('/admin/finance/withdrawals', { status: 'REQUESTED', pageSize: 6 });

  useRealtimeEvent('product.submitted', () => pendingProducts.reload());
  useRealtimeEvent('withdrawal.requested', () => pendingWithdrawals.reload());

  if (!summary.data) return <Loading />;
  const s = summary.data;
  const paidOut = s.withdrawals.find((w) => w.status === 'PAID');

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.overviewTitle')} description={t('admin.overviewDescription')} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t('admin.totalRevenue')} value={formatMoney(s.grossSalesCents)} hint={t('admin.itemsSold', { count: s.paidItems })} icon={<ChartIcon size={18} />} />
        <Stat label={t('admin.commissionEarned')} value={formatMoney(s.commissionCents)} hint={t('admin.platformShare')} icon={<WalletIcon size={18} />} />
        <Stat label={t('admin.owedToSellers')} value={formatMoney(s.vendorPendingCents + s.vendorAvailableCents)} hint={t('admin.availableNow', { amount: formatMoney(s.vendorAvailableCents) })} icon={<StoreIcon size={18} />} />
        <Stat label={t('admin.paidOut')} value={formatMoney(paidOut?.amountCents ?? 0)} hint={t('admin.withdrawalsCount', { count: paidOut?.count ?? 0 })} icon={<BoxIcon size={18} />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={t('admin.awaitingReview')} subtitle={t('admin.inQueue', { count: pendingProducts.data?.total ?? 0 })} actions={<Link href="/admin/products" className="text-sm font-semibold text-brand-600 hover:underline">{t('admin.openQueue')}</Link>} padded={false}>
          <div className="px-5 pb-2">
            {pendingProducts.data?.items.map((p) => (
              <ListRow key={p.id} href={`/admin/products/${p.id}`} meta={formatDate(p.submittedAt)} tag={p.vendor?.storeName} title={p.title} trailing={<Badge status={p.status} />} />
            ))}
            {pendingProducts.data?.items.length === 0 && <p className="py-4 text-sm text-slate-500">{t('admin.queueEmpty')}</p>}
          </div>
        </Card>

        <Card title={t('admin.withdrawalRequests')} subtitle={t('admin.waiting', { count: pendingWithdrawals.data?.total ?? 0 })} actions={<Link href="/admin/withdrawals" className="text-sm font-semibold text-brand-600 hover:underline">{t('admin.process')}</Link>} padded={false}>
          <div className="px-5 pb-2">
            {pendingWithdrawals.data?.items.map((w) => (
              <ListRow key={w.id} href="/admin/withdrawals" meta={formatDate(w.requestedAt)} title={w.vendor?.storeName ?? ''} trailing={<span className="font-semibold text-navy-900">{formatMoney(w.amountCents)}</span>} />
            ))}
            {pendingWithdrawals.data?.items.length === 0 && <p className="py-4 text-sm text-slate-500">{t('admin.nothingPending')}</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
