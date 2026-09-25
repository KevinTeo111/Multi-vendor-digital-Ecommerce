'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  LinkButton,
  Loading,
  PageHeader,
  Pagination,
  Select,
  Table,
  Td,
} from '@/components/ui';
import { useLocale } from '@/i18n/client';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { useRealtimeEvent } from '@/lib/realtime';
import type { Paginated, VendorProduct } from '@/lib/types';
import { useAction, useFetch } from '@/lib/use-fetch';

const STATUSES = ['', 'DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'UNPUBLISHED', 'BLOCKED'];

export default function VendorProductsPage() {
  const { t, status: statusLabel } = useLocale();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const list = useFetch<Paginated<VendorProduct>>('/vendor/products', {
    status: status || undefined,
    page,
    pageSize: 20,
  });
  const action = useAction();

  // Admin decisions arrive live: patch the row in place, no reload needed.
  useRealtimeEvent('product.status', (p) => {
    list.setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((item) =>
              item.id === p.productId
                ? {
                    ...item,
                    status: p.status as VendorProduct['status'],
                    rejectionReason: (p.reason as string | null) ?? null,
                  }
                : item,
            ),
          }
        : prev,
    );
  });

  const act = async (id: string, verb: 'submit' | 'unpublish' | 'delete') => {
    if (verb === 'delete' && !confirm(t('vendor.deleteConfirm'))) return;
    const ok = await action.run(() =>
      verb === 'delete'
        ? api(`/vendor/products/${id}`, { method: 'DELETE' })
        : api(`/vendor/products/${id}/${verb}`, { method: 'POST' }),
    );
    if (ok !== undefined) list.reload();
  };

  return (
    <div>
      <PageHeader
        title={t('vendor.productsTitle')}
        actions={
          <LinkButton href="/vendor/products/new" arrow>
            {t('vendor.newProductButton')}
          </LinkButton>
        }
      />
      {action.error && (
        <div className="mb-4">
          <Alert tone="error">{action.error}</Alert>
        </div>
      )}
      <Card
        actions={
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-auto"
            aria-label={t('common.status')}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s ? statusLabel(s) : t('common.allStatuses')}
              </option>
            ))}
          </Select>
        }
      >
        {list.loading && !list.data ? (
          <Loading />
        ) : !list.data || list.data.items.length === 0 ? (
          <EmptyState
            title={t('vendor.noProducts')}
            description={t('vendor.noProductsText')}
            action={
              <LinkButton href="/vendor/products/new" arrow>
                {t('vendor.newProductButton')}
              </LinkButton>
            }
          />
        ) : (
          <>
            <Table
              headers={[
                t('vendor.product'),
                t('vendor.price'),
                t('common.status'),
                t('store.sales'),
                t('vendor.updated'),
                t('common.actions'),
              ]}
            >
              {list.data.items.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <Link
                      href={`/vendor/products/${p.id}`}
                      className="font-medium text-navy-900 hover:text-brand-600"
                    >
                      {p.title}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {p.category.name} · {t('vendor.filesCount', { count: p.fileCount ?? 0 })}
                    </div>
                    {p.status === 'REJECTED' && p.rejectionReason && (
                      <div className="mt-1 text-xs text-rose-600">
                        {t('vendor.rejectedReason', { reason: p.rejectionReason })}
                      </div>
                    )}
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
                          {p.status === 'UNPUBLISHED' ? t('vendor.republish') : t('vendor.submit')}
                        </Button>
                      )}
                      {p.status === 'APPROVED' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => act(p.id, 'unpublish')}
                          loading={action.busy}
                        >
                          {t('vendor.unpublish')}
                        </Button>
                      )}
                      {p.salesCount === 0 && p.status !== 'BLOCKED' && (
                        <Button size="sm" variant="ghost" onClick={() => act(p.id, 'delete')}>
                          {t('common.delete')}
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination
              page={list.data.page}
              totalPages={list.data.totalPages}
              onChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
