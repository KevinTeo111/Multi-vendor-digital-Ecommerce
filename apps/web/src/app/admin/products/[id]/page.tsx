'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { Alert, Badge, Button, Card, Loading, Modal, PageHeader, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { formatBytes, formatDate, formatMoney } from '@/lib/format';
import type { VendorProduct } from '@/lib/types';
import { useAction, useFetch } from '@/lib/use-fetch';

export default function AdminProductDetail() {
  const { id } = useParams<{ id: string }>();
  const product = useFetch<VendorProduct>(`/admin/products/${id}`);
  const action = useAction();
  const [modal, setModal] = useState<'reject' | 'block' | null>(null);
  const [reason, setReason] = useState('');

  if (!product.data) return product.error ? <Alert tone="error">{product.error}</Alert> : <Loading />;
  const p = product.data;

  const run = async (verb: string, body?: unknown) => {
    const ok = await action.run(() => api(`/admin/products/${id}/${verb}`, { method: 'POST', body }));
    if (ok !== undefined) {
      setModal(null);
      setReason('');
      product.reload();
    }
  };

  const openFile = async (fileId: string) => {
    const res = await action.run(() => api<{ url: string }>(`/admin/products/${id}/files/${fileId}/download-url`));
    if (res) window.open(res.url, '_blank');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.title}
        description={`${p.vendor?.storeName} · ${p.vendor?.user?.email ?? ''}`}
        actions={
          <>
            <Badge status={p.status} />
            {p.status === 'PENDING_REVIEW' && (
              <>
                <Button onClick={() => run('approve')} loading={action.busy}>
                  Approve
                </Button>
                <Button variant="danger" onClick={() => setModal('reject')}>
                  Reject
                </Button>
              </>
            )}
            {p.status !== 'BLOCKED' && p.status !== 'PENDING_REVIEW' && (
              <Button variant="danger" onClick={() => setModal('block')}>
                Block
              </Button>
            )}
            {p.status === 'BLOCKED' && (
              <Button variant="secondary" onClick={() => run('unblock')} loading={action.busy}>
                Unblock
              </Button>
            )}
          </>
        }
      />
      {action.error && <Alert tone="error">{action.error}</Alert>}
      {p.rejectionReason && <Alert tone="warning">Last reason given: {p.rejectionReason}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {p.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.thumbnailUrl} alt="" className="w-full max-w-xl rounded-lg border border-slate-200" />
          )}
          {p.previewImageUrls && p.previewImageUrls.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {p.previewImageUrls.map((u, i) => u && (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={u} alt="" className="aspect-[4/3] w-full rounded object-cover" />
              ))}
            </div>
          )}
          <Card title="Short description">
            <p className="text-sm">{p.shortDescription}</p>
          </Card>
          <Card title="Description">
            <div className="whitespace-pre-wrap text-sm">{p.description}</div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Details">
            <dl className="space-y-2 text-sm">
              <Row label="Price">{formatMoney(p.priceCents, p.currency)}</Row>
              <Row label="Category">{p.category.name}</Row>
              <Row label="Version">{p.version ?? '—'}</Row>
              <Row label="Demo">{p.demoUrl ? <a href={p.demoUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Open ↗</a> : '—'}</Row>
              <Row label="Tags">{p.tags.join(', ') || '—'}</Row>
              <Row label="Submitted">{formatDate(p.submittedAt, true)}</Row>
              <Row label="Sales">{p.salesCount}</Row>
              <Row label="Vendor">
                <Link href={`/admin/vendors?search=${encodeURIComponent(p.vendor?.slug ?? '')}`} className="text-indigo-600 hover:underline">
                  {p.vendor?.storeName}
                </Link>
              </Row>
            </dl>
          </Card>
          <Card title="Files">
            <ul className="space-y-2 text-sm">
              {(p.files ?? []).map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {f.fileName} <span className="text-xs text-slate-500">({formatBytes(f.sizeBytes)})</span>
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => openFile(f.id)}>
                    Inspect
                  </Button>
                </li>
              ))}
              {(p.files ?? []).length === 0 && <li className="text-slate-500">No files.</li>}
            </ul>
          </Card>
        </div>
      </div>

      <Modal open={modal !== null} title={modal === 'reject' ? 'Reject product' : 'Block product'} onClose={() => setModal(null)}>
        <p className="mb-2 text-sm text-slate-500">The vendor will see this reason.</p>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModal(null)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={modal === 'reject' && reason.trim().length < 3} loading={action.busy} onClick={() => run(modal!, { reason })}>
            Confirm
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
