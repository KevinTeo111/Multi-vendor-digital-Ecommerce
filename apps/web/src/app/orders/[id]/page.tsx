'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DownloadButton } from '@/components/download-button';
import { RequireRole } from '@/components/require-role';
import { Alert, Badge, Card, Loading, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import type { Order } from '@/lib/types';

function OrderView() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Order>(`/orders/${id}`).then(setOrder).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!order) return <Loading />;

  return (
    <div>
      <PageHeader title={`Order ${order.orderNumber}`} description={`Placed ${formatDate(order.createdAt, true)}`} actions={<Badge status={order.status} />} />

      {order.status === 'PENDING' && <Alert tone="info">Waiting for payment confirmation. This page updates once the payment provider confirms.</Alert>}
      {order.status === 'FAILED' && <Alert tone="error">Payment failed{order.failureReason ? `: ${order.failureReason}` : ''}. You can try again from your cart.</Alert>}
      {order.status === 'PAID' && <Alert tone="success">Payment confirmed. Your files are ready to download.</Alert>}

      <Card className="mt-4">
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {order.items.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <Link href={`/products/${item.product.slug}`} className="font-medium hover:underline">
                  {item.productTitle}
                </Link>
                <div className="text-xs text-slate-500">
                  by {item.vendor.storeName}
                  {item.product.version ? ` · v${item.product.version}` : ''}
                </div>
              </div>
              <span className="font-semibold">{formatMoney(item.priceCents, order.currency)}</span>
              {order.status === 'PAID' && <DownloadButton orderItemId={item.id} />}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end border-t border-slate-200 pt-3 text-sm dark:border-slate-700">
          <span>
            Total <strong>{formatMoney(order.totalCents, order.currency)}</strong>
          </span>
        </div>
      </Card>
    </div>
  );
}

export default function OrderPage() {
  return (
    <RequireRole roles={['BUYER', 'VENDOR', 'ADMIN']}>
      <OrderView />
    </RequireRole>
  );
}
