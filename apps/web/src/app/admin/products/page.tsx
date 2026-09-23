'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Card, EmptyState, Input, Loading, PageHeader, Pagination, Select, Table, Td } from '@/components/ui';
import { formatDate, formatMoney } from '@/lib/format';
import type { Paginated, VendorProduct } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

const STATUSES = ['PENDING_REVIEW', '', 'APPROVED', 'REJECTED', 'BLOCKED', 'DRAFT', 'UNPUBLISHED'];

export default function AdminProductsPage() {
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const list = useFetch<Paginated<VendorProduct>>('/admin/products', { status: status || undefined, search: search || undefined, page, pageSize: 25 });

  return (
    <div>
      <PageHeader title="Product review" description="Approve, reject or block listings. Vendors see the rejection reason." />
      <Card
        actions={
          <div className="flex gap-2">
            <Input placeholder="Search title or store" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="w-48" />
            <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-auto" aria-label="Status">
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s ? s.replace('_', ' ') : 'All statuses'}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        {list.loading && !list.data ? (
          <Loading />
        ) : !list.data || list.data.items.length === 0 ? (
          <EmptyState title="No products in this view" />
        ) : (
          <>
            <Table headers={['Product', 'Vendor', 'Price', 'Status', 'Submitted', '']}>
              {list.data.items.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-14 shrink-0 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.thumbnailUrl && <img src={p.thumbnailUrl} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div>
                        <div className="font-medium">{p.title}</div>
                        <div className="text-xs text-slate-500">{p.category.name}</div>
                      </div>
                    </div>
                  </Td>
                  <Td>{p.vendor?.storeName}</Td>
                  <Td>{formatMoney(p.priceCents, p.currency)}</Td>
                  <Td>
                    <Badge status={p.status} />
                  </Td>
                  <Td className="text-xs">{formatDate(p.submittedAt)}</Td>
                  <Td>
                    <Link href={`/admin/products/${p.id}`} className="text-indigo-600 hover:underline">
                      Review
                    </Link>
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
