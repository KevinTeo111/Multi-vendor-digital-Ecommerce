'use client';

import { useState } from 'react';
import { useT } from '@/i18n/client';
import { api } from '@/lib/api';
import type { OrderItem } from '@/lib/types';
import { useAction } from '@/lib/use-fetch';
import { StarInput, Stars } from './stars';
import { Alert, Button, Field, Textarea } from './ui';

/** The buyer's review of one purchased item: shown, or opened for writing / editing. */
export function ReviewForm({ item, onSaved }: { item: OrderItem; onSaved: () => void }) {
  const t = useT();
  const existing = item.review ?? null;
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const action = useAction();

  const save = async () => {
    const ok = await action.run(() =>
      api('/reviews', {
        method: 'POST',
        body: { orderItemId: item.id, rating, comment: comment.trim() || undefined },
      }),
    );
    if (ok !== undefined) {
      setOpen(false);
      onSaved();
    }
  };

  if (!open)
    return (
      <div className="mt-3 border-t border-slate-100 pt-3">
        {existing ? (
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <Stars value={existing.rating} />
              <button
                onClick={() => setOpen(true)}
                className="text-xs font-semibold text-brand-600 hover:underline"
              >
                {t('reviews.edit')}
              </button>
            </div>
            {existing.hidden && (
              <p className="text-xs text-amber-700">{t('reviews.hiddenByTeam')}</p>
            )}
            {existing.sellerReply && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                {t('reviews.sellerReply', { store: item.vendor.storeName })}: {existing.sellerReply}
              </p>
            )}
          </div>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            {t('reviews.rate')}
          </Button>
        )}
      </div>
    );

  return (
    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
      {action.error && <Alert tone="error">{action.error}</Alert>}
      <Field label={t('reviews.yourRating')}>
        <StarInput value={rating} onChange={setRating} label={t('reviews.yourRating')} />
      </Field>
      <Field label={t('reviews.comment')}>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={2000}
        />
      </Field>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} loading={action.busy} disabled={rating < 1}>
          {t('reviews.save')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  );
}
