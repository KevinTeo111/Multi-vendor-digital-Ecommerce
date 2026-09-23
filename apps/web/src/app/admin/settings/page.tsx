'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Card, Field, Input, Loading, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { useAction, useFetch } from '@/lib/use-fetch';

type Settings = Record<string, string | number | string[]>;

const FIELDS: Array<{ key: string; label: string; kind: 'text' | 'money' | 'int' | 'percent' | 'list'; hint?: string }> = [
  { key: 'site.name', label: 'Site name', kind: 'text' },
  { key: 'site.currency', label: 'Currency (ISO code)', kind: 'text', hint: 'Used for new orders and plans' },
  { key: 'finance.min_withdrawal_cents', label: 'Minimum withdrawal', kind: 'money', hint: 'Vendors can request a payout only above this amount' },
  { key: 'finance.pending_hold_days', label: 'Earnings hold (days)', kind: 'int', hint: 'Days before a sale becomes available for withdrawal' },
  { key: 'finance.default_commission_bps', label: 'Default commission (%)', kind: 'percent', hint: 'Applied when a vendor has no plan' },
  { key: 'products.max_upload_mb', label: 'Max upload size (MB)', kind: 'int' },
  { key: 'products.allowed_file_extensions', label: 'Allowed file extensions', kind: 'list', hint: 'Comma separated, without dots' },
];

export default function AdminSettingsPage() {
  const settings = useFetch<Settings>('/admin/settings');
  const action = useAction();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!settings.data) return;
    const next: Record<string, string> = {};
    for (const f of FIELDS) {
      const v = settings.data[f.key];
      next[f.key] =
        f.kind === 'money' ? ((v as number) / 100).toFixed(2)
        : f.kind === 'percent' ? ((v as number) / 100).toString()
        : f.kind === 'list' ? (v as string[]).join(', ')
        : String(v ?? '');
    }
    setForm(next);
  }, [settings.data]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaved(false);
    const body: Settings = {};
    for (const f of FIELDS) {
      const raw = form[f.key] ?? '';
      body[f.key] =
        f.kind === 'money' ? Math.round(Number(raw) * 100)
        : f.kind === 'percent' ? Math.round(Number(raw) * 100)
        : f.kind === 'int' ? Number(raw)
        : f.kind === 'list' ? raw.split(',').map((s) => s.trim().toLowerCase().replace(/^\./, '')).filter(Boolean)
        : raw;
    }
    const ok = await action.run(() => api('/admin/settings', { method: 'PUT', body }));
    if (ok !== undefined) {
      setSaved(true);
      settings.reload();
    }
  };

  if (!settings.data) return <Loading />;

  return (
    <div>
      <PageHeader title="Site settings" />
      <Card>
        <form onSubmit={save} className="space-y-4">
          {action.error && <Alert tone="error">{action.error}</Alert>}
          {saved && <Alert tone="success">Settings saved.</Alert>}
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              <Input
                type={f.kind === 'text' || f.kind === 'list' ? 'text' : 'number'}
                step={f.kind === 'money' || f.kind === 'percent' ? '0.01' : '1'}
                min={0}
                value={form[f.key] ?? ''}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                required
              />
            </Field>
          ))}
          <Button type="submit" loading={action.busy}>
            Save settings
          </Button>
        </form>
      </Card>
    </div>
  );
}
