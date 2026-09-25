'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ProductForm, type ProductFormValues } from '@/components/product-form';
import { Alert, Badge, Button, Card, Loading, PageHeader } from '@/components/ui';
import { useLocale } from '@/i18n/client';
import { api, uploadToPresignedUrl } from '@/lib/api';
import { formatBytes } from '@/lib/format';
import { useRealtimeEvent } from '@/lib/realtime';
import type { Category, PublicSettings, VendorProduct } from '@/lib/types';
import { useAction, useFetch } from '@/lib/use-fetch';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, status: statusLabel } = useLocale();
  const product = useFetch<VendorProduct>(`/vendor/products/${id}`);
  const categories = useFetch<Category[]>('/categories');
  const settings = useFetch<PublicSettings>('/settings/public');
  const save = useAction();
  const lifecycle = useAction();

  // Live status from the admin review, without reloading the page.
  useRealtimeEvent('product.status', (p) => {
    if (p.productId === id)
      product.setData((prev) =>
        prev
          ? {
              ...prev,
              status: p.status as VendorProduct['status'],
              rejectionReason: (p.reason as string | null) ?? null,
            }
          : prev,
      );
  });

  if (!product.data || !categories.data)
    return product.error ? <Alert tone="error">{product.error}</Alert> : <Loading />;
  const p = product.data;

  const update = async (values: ProductFormValues) => {
    const ok = await save.run(() =>
      api(`/vendor/products/${id}`, { method: 'PATCH', body: values }),
    );
    if (ok !== undefined) product.reload();
  };

  const submitForReview = async () => {
    const ok = await lifecycle.run(() => api(`/vendor/products/${id}/submit`, { method: 'POST' }));
    if (ok !== undefined) router.push('/vendor/products');
  };

  const canSubmit = ['DRAFT', 'REJECTED', 'UNPUBLISHED'].includes(p.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.title}
        description={t('vendor.statusLabel', { status: statusLabel(p.status) })}
        actions={
          <>
            <Badge status={p.status} />
            {canSubmit && (
              <Button onClick={submitForReview} loading={lifecycle.busy} arrow>
                {p.status === 'UNPUBLISHED' ? t('vendor.republish') : t('vendor.submitForReview')}
              </Button>
            )}
          </>
        }
      />
      {lifecycle.error && <Alert tone="error">{lifecycle.error}</Alert>}
      {p.status === 'REJECTED' && p.rejectionReason && (
        <Alert tone="error">
          <strong>{t('vendor.rejectedByTeam')}</strong> {p.rejectionReason}
        </Alert>
      )}
      {p.status === 'PENDING_REVIEW' && <Alert tone="info">{t('vendor.waitingReview')}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card title={t('vendor.details')}>
          <ProductForm
            categories={categories.data}
            initial={p}
            onSubmit={update}
            busy={save.busy}
            error={save.error}
          />
        </Card>

        <div className="space-y-6">
          <ImagesPanel product={p} onChange={product.reload} />
          <FilesPanel product={p} settings={settings.data} onChange={product.reload} />
        </div>
      </div>
    </div>
  );
}

function ImagesPanel({ product, onChange }: { product: VendorProduct; onChange: () => void }) {
  const t = useLocale().t;
  const action = useAction();
  const [progress, setProgress] = useState<number | null>(null);

  const upload = async (kind: 'thumbnail' | 'preview', file: File) => {
    await action.run(async () => {
      const { uploadUrl, storageKey } = await api<{ uploadUrl: string; storageKey: string }>(
        `/vendor/products/${product.id}/images/upload-url`,
        {
          method: 'POST',
          body: { fileName: file.name, contentType: file.type, kind },
        },
      );
      await uploadToPresignedUrl(uploadUrl, file, setProgress);
      await api(`/vendor/products/${product.id}/images/confirm`, {
        method: 'POST',
        body: { storageKey, kind },
      });
    });
    setProgress(null);
    onChange();
  };

  const remove = async (storageKey: string) => {
    await action.run(() =>
      api(`/vendor/products/${product.id}/images`, { method: 'DELETE', body: { storageKey } }),
    );
    onChange();
  };

  const previews = product.previewImageKeys.map((key, i) => ({
    key,
    url: product.previewImageUrls?.[i] ?? null,
  }));

  return (
    <Card title={t('vendor.images')}>
      {action.error && <Alert tone="error">{action.error}</Alert>}
      <div className="space-y-4 text-sm">
        <div>
          <div className="mb-1 font-medium">{t('vendor.thumbnail')}</div>
          {product.thumbnailUrl ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={product.thumbnailUrl} alt="" className="h-16 w-24 rounded object-cover" />
              <Button
                size="sm"
                variant="ghost"
                onClick={() => product.thumbnailKey && remove(product.thumbnailKey)}
              >
                {t('common.remove')}
              </Button>
            </div>
          ) : (
            <FilePicker
              accept="image/*"
              label={t('vendor.uploadThumbnail')}
              onPick={(f) => upload('thumbnail', f)}
            />
          )}
        </div>
        <div>
          <div className="mb-1 font-medium">
            {t('vendor.previewImages', { count: previews.length })}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {previews.map((img) => (
              <div key={img.key} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {img.url && (
                  <img src={img.url} alt="" className="aspect-[4/3] w-full rounded object-cover" />
                )}
                <button
                  onClick={() => remove(img.key)}
                  className="absolute right-1 top-1 rounded bg-black/60 px-1 text-xs text-white"
                  aria-label={t('common.remove')}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {previews.length < 8 && (
            <FilePicker
              accept="image/*"
              label={t('vendor.addPreview')}
              onPick={(f) => upload('preview', f)}
            />
          )}
        </div>
        {progress !== null && (
          <div className="text-xs text-slate-500">{t('vendor.uploading', { pct: progress })}</div>
        )}
      </div>
    </Card>
  );
}

function FilesPanel({
  product,
  settings,
  onChange,
}: {
  product: VendorProduct;
  settings: PublicSettings | null;
  onChange: () => void;
}) {
  const t = useLocale().t;
  const action = useAction();
  const [progress, setProgress] = useState<number | null>(null);

  const upload = async (file: File) => {
    await action.run(async () => {
      const { uploadUrl, storageKey } = await api<{ uploadUrl: string; storageKey: string }>(
        `/vendor/products/${product.id}/files/upload-url`,
        {
          method: 'POST',
          body: {
            fileName: file.name,
            contentType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
          },
        },
      );
      await uploadToPresignedUrl(uploadUrl, file, setProgress);
      await api(`/vendor/products/${product.id}/files/confirm`, {
        method: 'POST',
        body: { storageKey, fileName: file.name },
      });
    });
    setProgress(null);
    onChange();
  };

  const remove = async (fileId: string) => {
    await action.run(() =>
      api(`/vendor/products/${product.id}/files/${fileId}`, { method: 'DELETE' }),
    );
    onChange();
  };

  return (
    <Card title={t('vendor.downloadableFiles')}>
      {action.error && <Alert tone="error">{action.error}</Alert>}
      <ul className="mb-3 space-y-2 text-sm">
        {(product.files ?? []).map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-2">
            <span className="truncate">
              {f.fileName}{' '}
              <span className="text-xs text-slate-500">({formatBytes(f.sizeBytes)})</span>
              {f.isMain && (
                <span className="ml-1 rounded bg-brand-50 px-1 text-xs text-brand-700">
                  {t('vendor.main')}
                </span>
              )}
            </span>
            <Button size="sm" variant="ghost" onClick={() => remove(f.id)}>
              {t('common.remove')}
            </Button>
          </li>
        ))}
        {(product.files ?? []).length === 0 && (
          <li className="text-slate-500">{t('vendor.noFilesYet')}</li>
        )}
      </ul>
      <FilePicker
        label={t('vendor.uploadFile')}
        onPick={upload}
        accept={settings?.allowedFileExtensions.map((e) => `.${e}`).join(',')}
      />
      {settings && (
        <p className="mt-2 text-xs text-slate-500">
          {t('vendor.allowed', {
            list: settings.allowedFileExtensions.join(', '),
            mb: settings.maxUploadMb,
          })}
        </p>
      )}
      {progress !== null && (
        <div className="mt-2 text-xs text-slate-500">
          {t('vendor.uploading', { pct: progress })}
        </div>
      )}
    </Card>
  );
}

function FilePicker({
  label,
  accept,
  onPick,
}: {
  label: string;
  accept?: string;
  onPick: (file: File) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center rounded-full border border-slate-200 px-4 py-1.5 text-sm font-semibold text-navy-900 hover:border-brand-500 hover:text-brand-600">
      {label}
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = '';
        }}
      />
    </label>
  );
}
