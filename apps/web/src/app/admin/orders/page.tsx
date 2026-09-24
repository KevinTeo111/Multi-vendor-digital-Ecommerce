'use client';

import { useState } from 'react';
import { Badge, Card, EmptyState, Input, Loading, PageHeader, Pagination, Select, Table, Td } from '@/components/ui';
import { useLocale } from '@/i18n/client';
import { formatDate, formatMoney } from '@/lib/format';
import type { Order, Paginated } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

export default function AdminOrdersPage() {
  const { t, status: statusLabel } = useLocale();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const list = useFetch<Paginated<Order>>('/admin/orders', { status: status || undefined, search: search || undefined, page, pageSize: 25 });

  return (
    <div>
      <PageHeader title={t('admin.ordersTitle')} />
      <Card
        actions={
          <div className="flex gap-2">
            <Input placeholder={t('admin.searchOrder')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-56" />
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-auto" aria-label={t('common.status')}>
              {['', 'PAID', 'PENDING', 'FAILED', 'CANCELED', 'REFUNDED'].map((s) => (
                <option key={s} value={s}>
                  {s ? statusLabel(s) : t('common.allStatuses')}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        {list.loading && !list.data ? (
          <Loading />
        ) : !list.data || list.data.items.length === 0 ? (
          <EmptyState title={t('admin.noOrders')} />
        ) : (
          <>
            <Table headers={[t('orders.order'), t('common.date'), t('admin.buyer'), t('orders.items'), t('orders.total'), t('vendor.commission'), t('common.status')]}>
              {list.data.items.map((o) => (
                <tr key={o.id}>
                  <Td className="font-mono text-xs">{o.orderNumber}</Td>
                  <Td className="text-xs">{formatDate(o.createdAt, true)}</Td>
                  <Td>
                    {o.buyer?.name}
                    <div className="text-xs text-slate-500">{o.buyer?.email}</div>
                  </Td>
                  <Td>
                    {o.items.map((i) => (
                      <div key={i.id} className="text-xs">
                        {i.productTitle} <span className="text-slate-500">· {i.vendor.storeName}</span>
                      </div>
                    ))}
                  </Td>
                  <Td>{formatMoney(o.totalCents, o.currency)}</Td>
                  <Td>{formatMoney(o.items.reduce((s, i) => s + i.commissionCents, 0), o.currency)}</Td>
                  <Td>
                    <Badge status={o.status} />
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination page={list.data.page} totalPages={list.data.totalPages} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
