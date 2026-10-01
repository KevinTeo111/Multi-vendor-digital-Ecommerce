'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import {
  FilterBar,
  Alert,
  Badge,
  Button,
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
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { AdminVendor } from '@/lib/types';
import { useAction, usePagedList } from '@/lib/use-fetch';

function VendorsView() {
  const { t, status: statusLabel } = useLocale();
  const params = useSearchParams();
  const list = usePagedList<AdminVendor>('/admin/vendors', {
    status: '',
    search: params.get('search') ?? '',
  });
  const action = useAction();

  const setVendorStatus = async (id: string, next: string) => {
    if (next === 'SUSPENDED' && !confirm(t('admin.suspendConfirm'))) return;
    const ok = await action.run(() =>
      api(`/admin/vendors/${id}/status`, { method: 'PATCH', body: { status: next } }),
    );
    if (ok !== undefined) list.reload();
  };

  return (
    <div>
      <PageHeader title={t('admin.sellersTitle')} />
      {action.error && (
        <div className="mb-4">
          <Alert tone="error">{action.error}</Alert>
        </div>
      )}
      <Card
        actions={
          <FilterBar>
            <Input
              placeholder={t('admin.searchSeller')}
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
              {['', 'ACTIVE', 'PENDING', 'SUSPENDED'].map((s) => (
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
          <EmptyState title={t('admin.noSellers')} />
        ) : (
          <>
            <Table
              headers={[
                t('admin.store'),
                t('admin.owner'),
                t('admin.plan'),
                t('admin.products'),
                t('common.status'),
                t('admin.joined'),
                t('common.actions'),
              ]}
            >
              {list.data.items.map((v) => (
                <tr key={v.id}>
                  <Td>
                    <Link
                      href={`/store/${v.slug}`}
                      className="font-medium text-navy-900 hover:text-brand-600"
                    >
                      {v.storeName}
                    </Link>
                    <div className="text-xs text-slate-500">/{v.slug}</div>
                  </Td>
                  <Td>
                    {v.user.name}
                    <div className="text-xs text-slate-500">{v.user.email}</div>
                  </Td>
                  <Td>
                    {v.activePlan?.name ?? (
                      <span className="text-slate-400">{t('common.none')}</span>
                    )}
                  </Td>
                  <Td>{v.productCount}</Td>
                  <Td>
                    <Badge status={v.status} />
                  </Td>
                  <Td className="text-xs">{formatDate(v.createdAt)}</Td>
                  <Td>
                    {v.status !== 'SUSPENDED' ? (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setVendorStatus(v.id, 'SUSPENDED')}
                        loading={action.busy}
                      >
                        {t('admin.suspend')}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setVendorStatus(v.id, 'ACTIVE')}
                        loading={action.busy}
                      >
                        {t('admin.reactivate')}
                      </Button>
                    )}
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

export default function AdminVendorsPage() {
  return (
    <Suspense>
      <VendorsView />
    </Suspense>
  );
}
