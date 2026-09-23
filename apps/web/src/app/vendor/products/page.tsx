'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, LinkButton, Loading, PageHeader, Pagination, Select, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import type { Paginated, VendorProduct } from '@/lib/types';
import { useAction, useFetch } from '@/lib/use-fetch';

const STATUSES = ['', 'DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'UNPUBLISHED', 'BLOCKED'];

export default function VendorProductsPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const list = useFetch<Paginated<VendorProduct>>('/vendor/products', { status: status || undefined, page, pageSize: 20 });
  const action = useAction();

  const act = async (id: string, verb: 'submit' | 'unpublish' | 'delete') => {
    if (verb === 'delete' && !confirm('Delete this product? This cannot be undone.')) return;
    const ok = await action.run(() =>
      verb === 'delete' ? api(`/vendor/products/${id}`, { method: 'DELETE' }) : api(`/vendor/products/${id}/${verb}`, { method: 'POST' }),
    );
    if (ok !== undefined) list.reload();
  };

  return (
    <div>
      <PageHeader title="Products" actions={<LinkButton href="/vendor/products/new">New product</LinkButton>} />
      {action.error && (
        <div className="mb-4">
          <Alert tone="error">{action.error}</Alert>
        </div>
      )}
      <Card
        actions={
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-auto" aria-label="Filter by status">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s ? s.replace('_', ' ') : 'All statuses'}
              </option>
            ))}
          </Select>
        }
      >
        {list.loading && !list.data ? (
          <Loading />
        ) : !list.data || list.data.items.length === 0 ? (
          <EmptyState title="No products" description="Create your first product to get started." action={<LinkButton href="/vendor/products/new">New product</LinkButton>} />
        ) : (
          <>
            <Table headers={['Product', 'Price', 'Status', 'Sales', 'Updated', 'Actions']}>
              {list.data.items.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <Link href={`/vendor/products/${p.id}`} className="font-medium hover:underline">
                      {p.title}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {p.category.name} · {p.fileCount ?? 0} file(s)
                    </div>
                    {p.status === 'REJECTED' && p.rejectionReason && <div className="mt-1 text-xs text-rose-600">Rejected: {p.rejectionReason}</div>}
                  </Td>
                  <Td>{formatMoney(p.priceCents, p.currency)}</Td>
                  <Td>
                    <Badge status={p.status} />
                  </Td>
                  <Td>{p.salesCount}</Td>
                  <Td className="text-xs text-slate-500">{formatDate(p.updatedAt)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {['DRAFT', 'REJECTED', 'UNPUBLISHED'].includes(p.status) && (
                        <Button size="sm" onClick={() => act(p.id, 'submit')} loading={action.busy}>
                          {p.status === 'UNPUBLISHED' ? 'Republish' : 'Submit'}
                        </Button>
                      )}
                      {p.status === 'APPROVED' && (
                        <Button size="sm" variant="secondary" onClick={() => act(p.id, 'unpublish')} loading={action.busy}>
                          Unpublish
                        </Button>
                      )}
                      {p.salesCount === 0 && p.status !== 'BLOCKED' && (
                        <Button size="sm" variant="ghost" onClick={() => act(p.id, 'delete')}>
                          Delete
                        </Button>
                      )}
                    </div>
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
