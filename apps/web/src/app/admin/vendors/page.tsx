'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Input, Loading, PageHeader, Pagination, Select, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { AdminVendor, Paginated } from '@/lib/types';
import { useAction, useFetch } from '@/lib/use-fetch';

function VendorsView() {
  const params = useSearchParams();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [page, setPage] = useState(1);
  const list = useFetch<Paginated<AdminVendor>>('/admin/vendors', { status: status || undefined, search: search || undefined, page, pageSize: 25 });
  const action = useAction();

  const setVendorStatus = async (id: string, next: string) => {
    if (next === 'SUSPENDED' && !confirm('Suspend this vendor? Their products go offline immediately.')) return;
    const ok = await action.run(() => api(`/admin/vendors/${id}/status`, { method: 'PATCH', body: { status: next } }));
    if (ok !== undefined) list.reload();
  };

  return (
    <div>
      <PageHeader title="Vendors" />
      {action.error && (
        <div className="mb-4">
          <Alert tone="error">{action.error}</Alert>
        </div>
      )}
      <Card
        actions={
          <div className="flex gap-2">
            <Input placeholder="Store, slug or email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-48" />
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-auto" aria-label="Status">
              {['', 'ACTIVE', 'PENDING', 'SUSPENDED'].map((s) => (
                <option key={s} value={s}>
                  {s || 'All statuses'}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        {list.loading && !list.data ? (
          <Loading />
        ) : !list.data || list.data.items.length === 0 ? (
          <EmptyState title="No vendors" />
        ) : (
          <>
            <Table headers={['Store', 'Owner', 'Plan', 'Products', 'Status', 'Joined', 'Actions']}>
              {list.data.items.map((v) => (
                <tr key={v.id}>
                  <Td>
                    <Link href={`/store/${v.slug}`} className="font-medium hover:underline">
                      {v.storeName}
                    </Link>
                    <div className="text-xs text-slate-500">/{v.slug}</div>
                  </Td>
                  <Td>
                    {v.user.name}
                    <div className="text-xs text-slate-500">{v.user.email}</div>
                  </Td>
                  <Td>{v.activePlan?.name ?? <span className="text-slate-400">none</span>}</Td>
                  <Td>{v.productCount}</Td>
                  <Td>
                    <Badge status={v.status} />
                  </Td>
                  <Td className="text-xs">{formatDate(v.createdAt)}</Td>
                  <Td>
                    {v.status !== 'SUSPENDED' ? (
                      <Button size="sm" variant="danger" onClick={() => setVendorStatus(v.id, 'SUSPENDED')} loading={action.busy}>
                        Suspend
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => setVendorStatus(v.id, 'ACTIVE')} loading={action.busy}>
                        Reactivate
                      </Button>
                    )}
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

export default function AdminVendorsPage() {
  return (
    <Suspense>
      <VendorsView />
    </Suspense>
  );
}
