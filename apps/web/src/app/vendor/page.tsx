'use client';

import Link from 'next/link';
import { BoxIcon, ChartIcon, ClockIcon, WalletIcon } from '@/components/icons';
import { Alert, Badge, Card, LinkButton, ListRow, Loading, PageHeader, Stat } from '@/components/ui';
import { useT } from '@/i18n/client';
import { formatBps, formatDate, formatMoney } from '@/lib/format';
import { useRealtimeEvent } from '@/lib/realtime';
import type { Balance, OrderItem, Paginated, VendorMe } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

type Sales = Paginated<OrderItem> & { totals: { grossCents: number; netCents: number } };

export default function VendorOverview() {
  const t = useT();
  const me = useFetch<VendorMe>('/vendors/me');
  const balance = useFetch<Balance>('/vendor/finance/balance');
  const sales = useFetch<Sales>('/vendor/sales', { pageSize: 5 });

  useRealtimeEvent('sale.new', () => {
    sales.reload();
    balance.reload();
  });
  useRealtimeEvent('product.status', () => me.reload());
  useRealtimeEvent('withdrawal.status', () => balance.reload());

  if (me.loading || !me.data) return <Loading />;
  const v = me.data;
  const sub = v.subscription;

  return (
    <div className="space-y-6">
      <PageHeader
        title={v.storeName}
        description={t('vendor.overviewDescription')}
        actions={
          <>
            <LinkButton href={`/store/${v.slug}`} variant="secondary">
              {t('vendor.viewStorefront')}
            </LinkButton>
            <LinkButton href="/vendor/products/new" arrow>
              {t('vendor.newProduct')}
            </LinkButton>
          </>
        }
      />

      {!sub && (
        <Alert tone="warning">
          {t('vendor.noPlanWarning')}{' '}
          <Link href="/vendor/subscription" className="font-semibold underline">
            {t('vendor.choosePlan')}
          </Link>{' '}
          {t('vendor.noPlanWarningTail')}
        </Alert>
      )}
      {v.status === 'SUSPENDED' && <Alert tone="error">{t('vendor.suspended')}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t('vendor.totalSales')} value={sales.data?.total ?? 0} hint={t('vendor.netEarned', { amount: formatMoney(sales.data?.totals.netCents ?? 0) })} icon={<ChartIcon size={18} />} />
        <Stat label={t('vendor.availableBalance')} value={formatMoney(balance.data?.availableCents ?? 0)} hint={t('vendor.readyToWithdraw')} icon={<WalletIcon size={18} />} />
        <Stat label={t('vendor.pendingBalance')} value={formatMoney(balance.data?.pendingCents ?? 0)} hint={t('vendor.clearsAfterHold')} icon={<ClockIcon size={18} />} />
        <Stat label={t('vendor.activeProducts')} value={`${v.usage.listedProducts}${v.usage.maxProducts !== null ? ` / ${v.usage.maxProducts}` : ''}`} hint={t('vendor.approvedPending')} icon={<BoxIcon size={18} />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card title={t('vendor.recentOrders')} actions={<Link href="/vendor/sales" className="text-sm font-semibold text-brand-600 hover:underline">{t('common.viewAll')}</Link>} padded={false}>
          {sales.data && sales.data.items.length > 0 ? (
            <div className="px-5 pb-2">
              {sales.data.items.map((s) => (
                <ListRow key={s.id} href={`/vendor/sales/${s.id}`} meta={formatDate(s.order?.paidAt)} tag={<span className="font-mono">{s.order?.orderNumber}</span>} title={s.productTitle} trailing={<span className="font-semibold text-navy-900">{formatMoney(s.vendorNetCents)}</span>} />
              ))}
            </div>
          ) : (
            <p className="p-5 text-sm text-slate-500">{t('vendor.noSalesYet')}</p>
          )}
        </Card>

        <Card title={t('vendor.currentPlan')} actions={<Link href="/vendor/subscription" className="text-sm font-semibold text-brand-600 hover:underline">{t('vendor.manage')}</Link>}>
          {sub ? (
            <dl className="space-y-3 text-sm">
              <Row label={t('vendor.plan')}>
                <span className="flex items-center gap-2 font-semibold">
                  {sub.plan.name} <Badge status={sub.status} />
                </span>
              </Row>
              <Row label={t('vendor.commission')}>{formatBps(sub.plan.commissionRateBps)}</Row>
              <Row label={t('vendor.productLimit')}>{sub.plan.maxProducts ?? t('common.unlimited')}</Row>
              <Row label={t('vendor.withdrawals')}>
                {sub.plan.withdrawalsPerWeek} {t('vendor.perWeek')}
              </Row>
              <Row label={sub.status === 'CANCELED' ? t('vendor.accessUntil') : t('vendor.renews')}>{formatDate(sub.currentPeriodEnd)}</Row>
            </dl>
          ) : (
            <p className="text-sm text-slate-500">{t('vendor.noPlanSelected')}</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-navy-900">{children}</dd>
    </div>
  );
}
