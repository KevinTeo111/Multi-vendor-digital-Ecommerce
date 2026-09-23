'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ProductForm, type ProductFormValues } from '@/components/product-form';
import { Alert, Badge, Button, Card, Loading, PageHeader } from '@/components/ui';
import { api, uploadToPresignedUrl } from '@/lib/api';
import { formatBytes } from '@/lib/format';
import type { Category, PublicSettings, VendorProduct } from '@/lib/types';
import { useAction, useFetch } from '@/lib/use-fetch';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const product = useFetch<VendorProduct>(`/vendor/products/${id}`);
  const categories = useFetch<Category[]>('/categories');
  const settings = useFetch<PublicSettings>('/settings/public');
  const save = useAction();
  const lifecycle = useAction();

  if (!product.data || !categories.data) return product.error ? <Alert tone="error">{product.error}</Alert> : <Loading />;
  const p = product.data;

  const update = async (values: ProductFormValues) => {
    const ok = await save.run(() => api(`/vendor/products/${id}`, { method: 'PATCH', body: values }));
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
        description={`Status: ${p.status.replace('_', ' ').toLowerCase()}`}
        actions={
          <>
            <Badge status={p.status} />
            {canSubmit && (
              <Button onClick={submitForReview} loading={lifecycle.busy}>
                {p.status === 'UNPUBLISHED' ? 'Republish' : 'Submit for review'}
              </Button>
            )}
          </>
        }
      />
      {lifecycle.error && <Alert tone="error">{lifecycle.error}</Alert>}
      {p.status === 'REJECTED' && p.rejectionReason && (
        <Alert tone="error">
          <strong>Rejected by the review team:</strong> {p.rejectionReason}
        </Alert>
      )}
      {p.status === 'PENDING_REVIEW' && <Alert tone="info">This product is waiting for admin review. You can still edit it.</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card title="Details">
          <ProductForm categories={categories.data} initial={p} onSubmit={update} busy={save.busy} error={save.error} />
        </Card>

        <div className="space-y-6">
          <ImagesPanel product={p} onChange={product.reload} />
          <FilesPanel product={p} settings={settings.data} onChange={product.reload} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ImagesPanel({ product, onChange }: { product: VendorProduct; onChange: () => void }) {
  const action = useAction();
  const [progress, setProgress] = useState<number | null>(null);

  const upload = async (kind: 'thumbnail' | 'preview', file: File) => {
    await action.run(async () => {
      const { uploadUrl, storageKey } = await api<{ uploadUrl: string; storageKey: string }>(`/vendor/products/${product.id}/images/upload-url`, {
        method: 'POST',
        body: { fileName: file.name, contentType: file.type, kind },
      });
      await uploadToPresignedUrl(uploadUrl, file, setProgress);
      await api(`/vendor/products/${product.id}/images/confirm`, { method: 'POST', body: { storageKey, kind } });
    });
    setProgress(null);
    onChange();
  };

  const remove = async (storageKey: string) => {
    await action.run(() => api(`/vendor/products/${product.id}/images`, { method: 'DELETE', body: { storageKey } }));
    onChange();
  };

  const previews = product.previewImageKeys.map((key, i) => ({ key, url: product.previewImageUrls?.[i] ?? null }));

  return (
    <Card title="Images">
      {action.error && <Alert tone="error">{action.error}</Alert>}
      <div className="space-y-4 text-sm">
        <div>
          <div className="mb-1 font-medium">Thumbnail (required)</div>
          {product.thumbnailUrl ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={product.thumbnailUrl} alt="" className="h-16 w-24 rounded object-cover" />
              <Button size="sm" variant="ghost" onClick={() => product.thumbnailKey && remove(product.thumbnailKey)}>
                Remove
              </Button>
            </div>
          ) : (
            <FilePicker accept="image/*" label="Upload thumbnail" onPick={(f) => upload('thumbnail', f)} />
          )}
        </div>
        <div>
          <div className="mb-1 font-medium">Preview images ({previews.length}/8)</div>
          <div className="grid grid-cols-3 gap-2">
            {previews.map((img) => (
              <div key={img.key} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {img.url && <img src={img.url} alt="" className="aspect-[4/3] w-full rounded object-cover" />}
                <button onClick={() => remove(img.key)} className="absolute right-1 top-1 rounded bg-black/60 px-1 text-xs text-white" aria-label="Remove image">
                  ✕
                </button>
              </div>
            ))}
          </div>
          {previews.length < 8 && <FilePicker accept="image/*" label="Add preview image" onPick={(f) => upload('preview', f)} />}
        </div>
        {progress !== null && <div className="text-xs text-slate-500">Uploading… {progress}%</div>}
      </div>
    </Card>
  );
}

function FilesPanel({ product, settings, onChange }: { product: VendorProduct; settings: PublicSettings | null; onChange: () => void }) {
  const action = useAction();
  const [progress, setProgress] = useState<number | null>(null);

  const upload = async (file: File) => {
    await action.run(async () => {
      const { uploadUrl, storageKey } = await api<{ uploadUrl: string; storageKey: string }>(`/vendor/products/${product.id}/files/upload-url`, {
        method: 'POST',
        body: { fileName: file.name, contentType: file.type || 'application/octet-stream', sizeBytes: file.size },
      });
      await uploadToPresignedUrl(uploadUrl, file, setProgress);
      await api(`/vendor/products/${product.id}/files/confirm`, { method: 'POST', body: { storageKey, fileName: file.name } });
    });
    setProgress(null);
    onChange();
  };

  const remove = async (fileId: string) => {
    await action.run(() => api(`/vendor/products/${product.id}/files/${fileId}`, { method: 'DELETE' }));
    onChange();
  };

  return (
    <Card title="Downloadable files">
      {action.error && <Alert tone="error">{action.error}</Alert>}
      <ul className="mb-3 space-y-2 text-sm">
        {(product.files ?? []).map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-2">
            <span className="truncate">
              {f.fileName} <span className="text-xs text-slate-500">({formatBytes(f.sizeBytes)})</span>
              {f.isMain && <span className="ml-1 rounded bg-indigo-100 px-1 text-xs text-indigo-700">main</span>}
            </span>
            <Button size="sm" variant="ghost" onClick={() => remove(f.id)}>
              Remove
            </Button>
          </li>
        ))}
        {(product.files ?? []).length === 0 && <li className="text-slate-500">No files uploaded yet.</li>}
      </ul>
      <FilePicker label="Upload file" onPick={upload} accept={settings?.allowedFileExtensions.map((e) => `.${e}`).join(',')} />
      {settings && (
        <p className="mt-2 text-xs text-slate-500">
          Allowed: {settings.allowedFileExtensions.join(', ')} · max {settings.maxUploadMb} MB
        </p>
      )}
      {progress !== null && <div className="mt-2 text-xs text-slate-500">Uploading… {progress}%</div>}
    </Card>
  );
}

function FilePicker({ label, accept, onPick }: { label: string; accept?: string; onPick: (file: File) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800">
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
