'use client';

import { useState } from 'react';
import { PageContainer } from '@/components/page-container';
import { RequireRole } from '@/components/require-role';
import { Badge, Card, EmptyState, LinkButton, ListRow, Loading, PageHeader, Pagination } from '@/components/ui';
import { useT } from '@/i18n/client';
import { formatDate, formatMoney } from '@/lib/format';
import { useRealtimeEvent } from '@/lib/realtime';
import type { Order, Paginated } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

function OrdersList() {
  const t = useT();
  const [page, setPage] = useState(1);
  const data = useFetch<Paginated<Order>>('/orders', { page, pageSize: 20 });
  useRealtimeEvent('order.paid', () => data.reload());

  if (!data.data) return <Loading />;

  return (
    <div>
      <PageHeader title={t('orders.title')} actions={<LinkButton href="/library" variant="secondary" arrow>{t('orders.myDownloads')}</LinkButton>} />
      {data.data.items.length === 0 ? (
        <EmptyState title={t('orders.empty')} action={<LinkButton href="/products" arrow>{t('cart.browse')}</LinkButton>} />
      ) : (
        <Card padded={false}>
          <div className="px-5">
            {data.data.items.map((o) => (
              <ListRow
                key={o.id}
                href={`/orders/${o.id}`}
                meta={formatDate(o.createdAt)}
                tag={<span className="font-mono text-xs">{o.orderNumber}</span>}
                title={o.items.map((i) => i.productTitle).join(', ')}
                trailing={
                  <span className="flex items-center gap-3">
                    <span className="font-semibold text-navy-900">{formatMoney(o.totalCents, o.currency)}</span>
                    <Badge status={o.status} />
                  </span>
                }
              />
            ))}
          </div>
          <div className="px-5 pb-4">
            <Pagination page={data.data.page} totalPages={data.data.totalPages} onChange={setPage} />
          </div>
        </Card>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <RequireRole roles={['BUYER', 'VENDOR', 'ADMIN']}>
      <PageContainer>
        <OrdersList />
      </PageContainer>
    </RequireRole>
  );
}
