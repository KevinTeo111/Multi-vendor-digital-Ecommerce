'use client';

import { useState } from 'react';
import { Card, EmptyState, ListRow, Loading, PageHeader, Pagination, Stat } from '@/components/ui';
import { useT } from '@/i18n/client';
import { formatDate, formatMoney } from '@/lib/format';
import { useRealtimeEvent } from '@/lib/realtime';
import type { OrderItem, Paginated } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

type Sales = Paginated<OrderItem> & {
  totals: { grossCents: number; commissionCents: number; netCents: number };
};

export default function VendorSalesPage() {
  const t = useT();
  const [page, setPage] = useState(1);
  const sales = useFetch<Sales>('/vendor/sales', { page, pageSize: 25 });
  useRealtimeEvent('sale.new', () => sales.reload());

  if (!sales.data) return <Loading />;
  const { totals } = sales.data;

  return (
    <div className="space-y-6">
      <PageHeader title={t('vendor.salesTitle')} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t('vendor.gross')} value={formatMoney(totals.grossCents)} />
        <Stat label={t('vendor.platformCommission')} value={formatMoney(totals.commissionCents)} />
        <Stat label={t('vendor.yourNet')} value={formatMoney(totals.netCents)} />
      </div>
      <Card padded={false}>
        {sales.data.items.length === 0 ? (
          <div className="p-5">
            <EmptyState title={t('vendor.noSalesYet')} />
          </div>
        ) : (
          <div className="px-5 pb-4">
            {sales.data.items.map((s) => (
              <ListRow
                key={s.id}
                href={`/vendor/sales/${s.id}`}
                meta={formatDate(s.order?.paidAt, true)}
                tag={<span className="font-mono">{s.order?.orderNumber}</span>}
                title={
                  <>
                    {s.productTitle}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      · {s.order?.buyer?.name}
                    </span>
                  </>
                }
                trailing={
                  <span className="text-right">
                    <span className="block font-semibold text-navy-900">
                      {formatMoney(s.vendorNetCents)}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {t('vendor.gross')} {formatMoney(s.priceCents)}
                    </span>
                  </span>
                }
              />
            ))}
            <Pagination
              page={sales.data.page}
              totalPages={sales.data.totalPages}
              onChange={setPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
