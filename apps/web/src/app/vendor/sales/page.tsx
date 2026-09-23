'use client';

import { useState } from 'react';
import { Card, EmptyState, Loading, PageHeader, Pagination, Stat, Table, Td } from '@/components/ui';
import { formatBps, formatDate, formatMoney } from '@/lib/format';
import type { OrderItem, Paginated } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

type Sales = Paginated<OrderItem> & { totals: { grossCents: number; commissionCents: number; netCents: number } };

export default function VendorSalesPage() {
  const [page, setPage] = useState(1);
  const sales = useFetch<Sales>('/vendor/sales', { page, pageSize: 25 });

  if (!sales.data) return <Loading />;
  const { totals } = sales.data;

  return (
    <div className="space-y-6">
      <PageHeader title="Sales" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Gross" value={formatMoney(totals.grossCents)} />
        <Stat label="Platform commission" value={formatMoney(totals.commissionCents)} />
        <Stat label="Your net" value={formatMoney(totals.netCents)} />
      </div>
      <Card>
        {sales.data.items.length === 0 ? (
          <EmptyState title="No sales yet" />
        ) : (
          <>
            <Table headers={['Date', 'Order', 'Product', 'Buyer', 'Price', 'Commission', 'Net']}>
              {sales.data.items.map((s) => (
                <tr key={s.id}>
                  <Td className="text-xs">{formatDate(s.order?.paidAt, true)}</Td>
                  <Td className="font-mono text-xs">{s.order?.orderNumber}</Td>
                  <Td>{s.productTitle}</Td>
                  <Td>{s.order?.buyer?.name}</Td>
                  <Td>{formatMoney(s.priceCents)}</Td>
                  <Td className="text-slate-500">
                    {formatMoney(s.commissionCents)} ({formatBps(s.commissionRateBps)})
                  </Td>
                  <Td className="font-medium">{formatMoney(s.vendorNetCents)}</Td>
                </tr>
              ))}
            </Table>
            <Pagination page={sales.data.page} totalPages={sales.data.totalPages} onChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
