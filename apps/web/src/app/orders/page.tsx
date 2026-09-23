'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RequireRole } from '@/components/require-role';
import { Badge, Card, EmptyState, LinkButton, Loading, PageHeader, Pagination, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import type { Order, Paginated } from '@/lib/types';

function OrdersList() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Order> | null>(null);

  useEffect(() => {
    api<Paginated<Order>>('/orders', { query: { page, pageSize: 20 } }).then(setData);
  }, [page]);

  if (!data) return <Loading />;

  return (
    <div>
      <PageHeader title="Your orders" actions={<LinkButton href="/library" variant="secondary">My downloads</LinkButton>} />
      {data.items.length === 0 ? (
        <EmptyState title="No orders yet" action={<LinkButton href="/products">Browse products</LinkButton>} />
      ) : (
        <Card>
          <Table headers={['Order', 'Date', 'Items', 'Total', 'Status', '']}>
            {data.items.map((o) => (
              <tr key={o.id}>
                <Td className="font-mono text-xs">{o.orderNumber}</Td>
                <Td>{formatDate(o.createdAt, true)}</Td>
                <Td>{o.items.length}</Td>
                <Td>{formatMoney(o.totalCents, o.currency)}</Td>
                <Td>
                  <Badge status={o.status} />
                </Td>
                <Td>
                  <Link href={`/orders/${o.id}`} className="text-indigo-600 hover:underline">
                    View
                  </Link>
                </Td>
              </tr>
            ))}
          </Table>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </Card>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <RequireRole roles={['BUYER', 'VENDOR', 'ADMIN']}>
      <OrdersList />
    </RequireRole>
  );
}
