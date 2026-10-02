'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/i18n/client';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Paginated, Review } from '@/lib/types';
import { RatingSummary, Stars } from './stars';
import { Button } from './ui';

/** Public reviews of a product, newest first, with "show more". */
export function ProductReviews({
  slug,
  storeName,
  ratingSum,
  ratingCount,
}: {
  slug: string;
  storeName: string;
  ratingSum: number;
  ratingCount: number;
}) {
  const t = useT();
  const [items, setItems] = useState<Review[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<Paginated<Review>>(`/products/${slug}/reviews`, {
      auth: false,
      query: { page, pageSize: 5 },
    })
      .then((res) => {
        setItems((prev) => (page === 1 ? res.items : [...prev, ...res.items]));
        setTotalPages(res.totalPages);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [slug, page]);

  return (
    <section className="mt-10 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-navy-900">{t('reviews.title')}</h2>
        <RatingSummary sum={ratingSum} count={ratingCount} size={16} className="text-sm" />
      </div>
      {!loading && items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{t('reviews.none')}</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {items.map((r) => (
            <li key={r.id} className="py-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stars value={r.rating} />
                <span className="text-sm font-semibold text-navy-900">{r.buyer.name}</span>
                <span className="text-xs text-slate-500">{formatDate(r.createdAt)}</span>
              </div>
              {r.comment && (
                <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{r.comment}</p>
              )}
              {r.sellerReply && (
                <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm">
                  <div className="text-xs font-semibold text-brand-700">
                    {t('reviews.sellerReply', { store: storeName })}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-slate-700">{r.sellerReply}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {page < totalPages && (
        <Button variant="secondary" onClick={() => setPage(page + 1)} loading={loading}>
          {t('reviews.more')}
        </Button>
      )}
    </section>
  );
}
