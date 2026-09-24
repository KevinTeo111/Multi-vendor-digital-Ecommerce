'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowRightIcon } from '@/components/icons';
import { Alert, Badge, Card, Loading, PageHeader } from '@/components/ui';
import { useLocale } from '@/i18n/client';
import { formatBps, formatDate, formatMoney } from '@/lib/format';
import type { VendorSale } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

export default function VendorSaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, status: statusLabel } = useLocale();
  const sale = useFetch<VendorSale>(`/vendor/sales/${id}`);

  if (sale.error) return <Alert tone="error">{sale.error}</Alert>;
  if (!sale.data) return <Loading />;
  const s = sale.data;
  const credit = s.ledgerEntries.find((e) => e.type === 'SALE_CREDIT');

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('vendor.saleTitle', { number: s.order.orderNumber })}
        description={t('vendor.saleDescription')}
        actions={
          <Link href="/vendor/sales" className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy-900 shadow-sm hover:border-brand-500 hover:text-brand-600">
            <ArrowRightIcon size={16} className="rotate-180" /> {t('vendor.backToOrders')}
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card title={t('vendor.product')}>
          <div className="flex gap-4">
            <div className="h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-slate-100">
              {s.product.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.product.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0">
              <Link href={`/products/${s.product.slug}`} className="text-lg font-semibold text-navy-900 hover:text-brand-600">
                {s.productTitle}
              </Link>
              {s.product.version && <div className="text-xs text-slate-500">v{s.product.version}</div>}
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <Row label={t('vendor.buyer')}>{s.order.buyer.name}</Row>
                <Row label={t('vendor.paidAt')}>{formatDate(s.order.paidAt, true)}</Row>
                <Row label={t('vendor.paymentMethod')}>{s.order.paymentMethod ?? t('common.notAvailable')}</Row>
                <Row label={t('vendor.downloads')}>{s.downloads}</Row>
              </dl>
            </div>
          </div>
        </Card>

        <Card title={t('vendor.payout')}>
          <dl className="space-y-3 text-sm">
            <Row label={t('vendor.price')}>
              <span className="font-semibold">{formatMoney(s.priceCents, s.order.currency)}</span>
            </Row>
            <Row label={t('vendor.platformCommission')}>
              <span>
                − {formatMoney(s.commissionCents, s.order.currency)} <span className="text-xs text-slate-500">({formatBps(s.commissionRateBps)})</span>
              </span>
            </Row>
            <div className="border-t border-slate-200 pt-3">
              <Row label={t('vendor.yourNet')}>
                <span className="text-lg font-bold text-navy-900">{formatMoney(s.vendorNetCents, s.order.currency)}</span>
              </Row>
            </div>
            <Row label={t('vendor.planAtSale')}>{s.plan?.name ?? t('common.notAvailable')}</Row>
            <Row label={t('vendor.payout')}>
              {credit ? (
                <span className="flex items-center gap-2">
                  <Badge status={credit.status} />
                  <span className="text-xs text-slate-500">{credit.status === 'AVAILABLE' ? t('vendor.payoutAvailable') : t('vendor.payoutPending', { date: formatDate(credit.availableAt) })}</span>
                </span>
              ) : (
                statusLabel('PENDING')
              )}
            </Row>
          </dl>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-navy-900">{children}</dd>
    </div>
  );
}
