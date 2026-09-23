'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DownloadButton } from '@/components/download-button';
import { PageContainer } from '@/components/page-container';
import { RequireRole } from '@/components/require-role';
import { Card, EmptyState, LinkButton, Loading, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { formatBytes, formatDate } from '@/lib/format';
import type { OrderItem } from '@/lib/types';

function Library() {
  const [items, setItems] = useState<OrderItem[] | null>(null);

  useEffect(() => {
    api<OrderItem[]>('/orders/library').then(setItems);
  }, []);

  if (!items) return <Loading />;

  return (
    <div>
      <PageHeader title="My downloads" description="Everything you have purchased, always available here." />
      {items.length === 0 ? (
        <EmptyState title="Nothing purchased yet" action={<LinkButton href="/products">Browse products</LinkButton>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id}>
              <div className="flex gap-4">
                <div className="h-16 w-24 shrink-0 overflow-hidden rounded bg-slate-100">
                  {item.product.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.product.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/products/${item.product.slug}`} className="block truncate font-medium hover:underline">
                    {item.productTitle}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {item.vendor.storeName} · Purchased {formatDate(item.order?.paidAt)}
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
