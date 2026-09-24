'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DownloadButton } from '@/components/download-button';
import { PageContainer } from '@/components/page-container';
import { RequireRole } from '@/components/require-role';
import { Alert, Badge, Card, Loading, PageHeader } from '@/components/ui';
import { useT } from '@/i18n/client';
import { formatDate, formatMoney } from '@/lib/format';
import { useRealtimeEvent } from '@/lib/realtime';
import type { Order } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

function OrderView() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const order = useFetch<Order>(`/orders/${id}`);
  useRealtimeEvent('order.paid', (p) => {
    if (p.orderId === id) order.reload();
  });

  if (order.error) return <Alert tone="error">{order.error}</Alert>;
  if (!order.data) return <Loading />;
  const o = order.data;

  return (
    <div>
      <PageHeader title={t('orders.orderTitle', { number: o.orderNumber })} description={t('orders.placed', { date: formatDate(o.createdAt, true) })} actions={<Badge status={o.status} />} />

      {o.status === 'PENDING' && <Alert tone="info">{t('orders.pending')}</Alert>}
      {o.status === 'FAILED' && <Alert tone="error">{o.failureReason ? t('orders.failedReason', { reason: o.failureReason }) : t('orders.failed')}</Alert>}
      {o.status === 'PAID' && <Alert tone="success">{t('orders.confirmed')}</Alert>}

      <Card className="mt-4">
        <ul className="divide-y divide-slate-100">
          {o.items.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <Link href={`/products/${item.product.slug}`} className="font-medium text-navy-900 hover:text-brand-600">
                  {item.productTitle}
                </Link>
                <div className="text-xs text-slate-500">
                  {t('product.by')} {item.vendor.storeName}
                  {item.product.version ? ` · v${item.product.version}` : ''}
                </div>
              </div>
              <span className="font-semibold">{formatMoney(item.priceCents, o.currency)}</span>
              {o.status === 'PAID' && <DownloadButton orderItemId={item.id} />}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end border-t border-slate-200 pt-3 text-sm">
          <span>
            {t('orders.total')} <strong>{formatMoney(o.totalCents, o.currency)}</strong>
          </span>
        </div>
      </Card>
    </div>
  );
}

export default function OrderPage() {
  return (
    <RequireRole roles={['BUYER', 'VENDOR', 'ADMIN']}>
      <PageContainer>
        <OrderView />
      </PageContainer>
    </RequireRole>
  );
}
