'use client';

import Link from 'next/link';
import {
  FilterBar,
  Badge,
  Card,
  EmptyState,
  Input,
  Loading,
  PageHeader,
  Pagination,
  Select,
  Table,
  Td,
} from '@/components/ui';
import { useLocale } from '@/i18n/client';
import { formatDate, formatMoney } from '@/lib/format';
import { useRealtimeEvent } from '@/lib/realtime';
import type { VendorProduct } from '@/lib/types';
import { usePagedList } from '@/lib/use-fetch';

const STATUSES = ['PENDING_REVIEW', '', 'APPROVED', 'REJECTED', 'BLOCKED', 'DRAFT', 'UNPUBLISHED'];

export default function AdminProductsPage() {
  const { t, status: statusLabel } = useLocale();
  const list = usePagedList<VendorProduct>('/admin/products', {
    status: 'PENDING_REVIEW',
    search: '',
  });
  useRealtimeEvent('product.submitted', () => list.reload());

  return (
    <div>
      <PageHeader title={t('admin.reviewTitle')} description={t('admin.reviewDescription')} />
      <Card
        actions={
          <FilterBar>
            <Input
              placeholder={t('admin.searchTitleStore')}
              value={list.filters.search}
              onChange={(e) => list.setFilter('search', e.target.value)}
              className="sm:w-56"
            />
            <Select
              value={list.filters.status}
              onChange={(e) => list.setFilter('status', e.target.value)}
              className="sm:w-auto"
              aria-label={t('common.status')}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s ? statusLabel(s) : t('common.allStatuses')}
                </option>
              ))}
            </Select>
          </FilterBar>
        }
      >
        {list.loading && !list.data ? (
          <Loading />
        ) : !list.data || list.data.items.length === 0 ? (
          <EmptyState title={t('admin.noProductsView')} />
        ) : (
          <>
            <Table
              headers={[
                t('vendor.product'),
                t('admin.vendor'),
                t('vendor.price'),
                t('common.status'),
                t('admin.submitted'),
                '',
              ]}
            >
              {list.data.items.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-14 shrink-0 overflow-hidden rounded bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {p.thumbnailUrl && (
                          <img src={p.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-navy-900">{p.title}</div>
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
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="font-semibold text-brand-600 hover:underline"
                    >
                      {t('admin.review')}
                    </Link>
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination
              page={list.data.page}
              totalPages={list.data.totalPages}
              onChange={list.setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
