'use client';

import Link from 'next/link';
import { DownloadButton } from '@/components/download-button';
import { PageContainer } from '@/components/page-container';
import { RequireRole } from '@/components/require-role';
import { Card, EmptyState, LinkButton, Loading, PageHeader } from '@/components/ui';
import { useT } from '@/i18n/client';
import { formatBytes, formatDate } from '@/lib/format';
import { useRealtimeEvent } from '@/lib/realtime';
import type { OrderItem } from '@/lib/types';
import { useFetch } from '@/lib/use-fetch';

function Library() {
  const t = useT();
  const items = useFetch<OrderItem[]>('/orders/library');
  useRealtimeEvent('order.paid', () => items.reload());

  if (!items.data) return <Loading />;

  return (
    <div>
      <PageHeader title={t('library.title')} description={t('library.subtitle')} />
      {items.data.length === 0 ? (
        <EmptyState title={t('library.empty')} action={<LinkButton href="/products" arrow>{t('cart.browse')}</LinkButton>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.data.map((item) => (
            <Card key={item.id}>
              <div className="flex gap-4">
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {item.product.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.product.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/products/${item.product.slug}`} className="block truncate font-medium text-navy-900 hover:text-brand-600">
                    {item.productTitle}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {item.vendor.storeName} · {t('library.purchased', { date: formatDate(item.order?.paidAt) })}
                  </div>
                </div>
              </div>
              <ul className="mt-3 space-y-2">
                {(item.product.files ?? []).map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">
                      {f.fileName} <span className="text-xs text-slate-500">({formatBytes(f.sizeBytes)})</span>
                    </span>
                    <DownloadButton orderItemId={item.id} fileId={f.id} />
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <RequireRole roles={['BUYER', 'VENDOR', 'ADMIN']}>
      <PageContainer>
        <Library />
      </PageContainer>
    </RequireRole>
  );
}
