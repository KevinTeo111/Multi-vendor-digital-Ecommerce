'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Stars } from '@/components/stars';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Loading,
  PageHeader,
  Pagination,
  Textarea,
} from '@/components/ui';
import { useT } from '@/i18n/client';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Review } from '@/lib/types';
import { useAction, usePagedList } from '@/lib/use-fetch';

export default function VendorReviewsPage() {
  const t = useT();
  const list = usePagedList<Review>('/vendor/reviews', {}, 20);
  const action = useAction();
  const [replying, setReplying] = useState<string | null>(null);
  const [reply, setReply] = useState('');

  const save = async (id: string) => {
    const ok = await action.run(() =>
      api(`/vendor/reviews/${id}/reply`, { method: 'POST', body: { reply } }),
    );
    if (ok !== undefined) {
      setReplying(null);
      setReply('');
      list.reload();
    }
  };

  return (
    <div>
      <PageHeader title={t('reviews.title')} description={t('reviews.vendorDescription')} />
      {action.error && <Alert tone="error">{action.error}</Alert>}
      <Card padded={false}>
        {!list.data ? (
          <Loading />
        ) : list.data.items.length === 0 ? (
          <div className="p-5">
            <EmptyState title={t('reviews.none')} />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.data.items.map((r) => (
              <li key={r.id} className="space-y-2 px-5 py-4">
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
                  <span className="text-xs text-slate-500">
                    {r.buyer.name} · {formatDate(r.createdAt)}
                  </span>
                  {r.hidden && <Badge status="CANCELED">{t('reviews.hidden')}</Badge>}
                </div>
                {r.comment && (
                  <p className="whitespace-pre-line text-sm text-slate-700">{r.comment}</p>
                )}
                {replying === r.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder={t('reviews.replyPlaceholder')}
                      rows={3}
                      maxLength={1000}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => save(r.id)}
                        loading={action.busy}
                        disabled={reply.trim().length < 2}
                      >
                        {t('reviews.saveReply')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setReplying(null)}>
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {r.sellerReply && (
                      <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        {r.sellerReply}
                      </p>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setReplying(r.id);
                        setReply(r.sellerReply ?? '');
                      }}
                    >
                      {t('reviews.reply')}
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {list.data && (
          <div className="px-5 pb-4">
            <Pagination
              page={list.data.page}
              totalPages={list.data.totalPages}
              onChange={list.setPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
