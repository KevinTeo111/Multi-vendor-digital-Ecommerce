'use client';

import Link from 'next/link';
import { Stars } from '@/components/stars';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  FilterBar,
  Loading,
  PageHeader,
  Pagination,
  Select,
} from '@/components/ui';
import { useT } from '@/i18n/client';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Review } from '@/lib/types';
import { useAction, usePagedList } from '@/lib/use-fetch';

export default function AdminReviewsPage() {
  const t = useT();
  const list = usePagedList<Review>('/admin/reviews', { hidden: '' });
  const action = useAction();

  const setHidden = async (r: Review, hidden: boolean) => {
    const ok = await action.run(() =>
      api(`/admin/reviews/${r.id}`, { method: 'PATCH', body: { hidden } }),
    );
    if (ok !== undefined) list.reload();
  };

  return (
    <div>
      <PageHeader title={t('reviews.title')} description={t('reviews.adminDescription')} />
      {action.error && <Alert tone="error">{action.error}</Alert>}
      <Card
        actions={
          <FilterBar>
            <Select
              value={list.filters.hidden}
              onChange={(e) => list.setFilter('hidden', e.target.value)}
              className="sm:w-auto"
              aria-label={t('reviews.filterAll')}
            >
              <option value="">{t('reviews.filterAll')}</option>
              <option value="false">{t('reviews.filterVisible')}</option>
              <option value="true">{t('reviews.filterHidden')}</option>
            </Select>
          </FilterBar>
        }
      >
        {!list.data ? (
          <Loading />
        ) : list.data.items.length === 0 ? (
          <EmptyState title={t('reviews.none')} />
        ) : (
          <ul className="-mx-5 divide-y divide-slate-100">
            {list.data.items.map((r) => (
              <li
                key={r.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars value={r.rating} />
                    {r.product && (
                      <Link
                        href={`/products/${r.product.slug}`}
                        className="text-sm font-semibold text-navy-900 hover:text-brand-600"
                      >
                        {r.product.title}
                      </Link>
                    )}
                    {r.hidden && <Badge status="CANCELED">{t('reviews.hidden')}</Badge>}
                  </div>
                  <div className="text-xs text-slate-500">
                    {r.buyer.name}
                    {r.buyer.email ? ` · ${r.buyer.email}` : ''} · {formatDate(r.createdAt)}
                    {r.product?.vendor ? ` · ${r.product.vendor.storeName}` : ''}
                  </div>
                  {r.comment && (
                    <p className="whitespace-pre-line text-sm text-slate-700">{r.comment}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={r.hidden ? 'secondary' : 'danger'}
                  onClick={() => setHidden(r, !r.hidden)}
                  loading={action.busy}
                >
                  {r.hidden ? t('reviews.unhide') : t('reviews.hide')}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {list.data && (
          <Pagination
            page={list.data.page}
            totalPages={list.data.totalPages}
            onChange={list.setPage}
          />
        )}
      </Card>
    </div>
  );
}
