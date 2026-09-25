'use client';

import { useState } from 'react';
import { useT } from '@/i18n/client';
import { api, ApiError } from '@/lib/api';
import { DownloadIcon } from './icons';
import { Button } from './ui';

export function DownloadButton({
  orderItemId,
  fileId,
  label,
}: {
  orderItemId: string;
  fileId?: string;
  label?: string;
}) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setLoading(true);
    setError(null);
    try {
      const path = fileId
        ? `/orders/items/${orderItemId}/files/${fileId}/download`
        : `/orders/items/${orderItemId}/download`;
      const res = await api<{ url: string }>(path);
      window.location.assign(res.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('library.downloadFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-right">
      <Button size="sm" variant="secondary" onClick={download} loading={loading}>
        <DownloadIcon size={14} /> {label ?? t('common.download')}
      </Button>
      {error && <div className="mt-1 text-xs text-rose-600">{error}</div>}
    </div>
  );
}
