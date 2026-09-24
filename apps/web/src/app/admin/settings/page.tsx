'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Card, Field, Input, Loading, PageHeader, Select } from '@/components/ui';
import { useT } from '@/i18n/client';
import { api } from '@/lib/api';
import { useAction, useFetch } from '@/lib/use-fetch';

type Settings = Record<string, string | number | string[]>;

type FieldDef = {
  key: string;
  label: string;
  kind: 'text' | 'money' | 'int' | 'percent' | 'list' | 'select';
  hint?: string;
  options?: Array<{ value: string; label: string }>;
};

export default function AdminSettingsPage() {
  const t = useT();
  const settings = useFetch<Settings>('/admin/settings');
  const action = useAction();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const GROUPS: Array<{ title: string; fields: FieldDef[] }> = [
    {
      title: t('admin.groupSite'),
      fields: [
        { key: 'site.name', label: t('admin.siteName'), kind: 'text' },
        { key: 'site.currency', label: t('admin.currency'), kind: 'text', hint: t('admin.currencyHint') },
      ],
    },
    {
      title: t('admin.groupFinance'),
      fields: [
        { key: 'finance.min_withdrawal_cents', label: t('admin.minWithdrawal'), kind: 'money', hint: t('admin.minWithdrawalHint') },
        { key: 'finance.pending_hold_days', label: t('admin.holdDays'), kind: 'int', hint: t('admin.holdDaysHint') },
        { key: 'finance.default_commission_bps', label: t('admin.defaultCommission'), kind: 'percent', hint: t('admin.defaultCommissionHint') },
        {
          key: 'finance.payout_mode',
          label: t('admin.payoutMode'),
          kind: 'select',
          hint: t('admin.payoutModeHint'),
          options: [
            { value: 'manual', label: t('admin.payoutManual') },
            { value: 'gateway', label: t('admin.payoutGateway') },
          ],
        },
      ],
    },
    {
      title: t('admin.groupProducts'),
      fields: [
        { key: 'products.max_upload_mb', label: t('admin.maxUpload'), kind: 'int' },
        { key: 'products.allowed_file_extensions', label: t('admin.allowedExtensions'), kind: 'list', hint: t('admin.allowedExtensionsHint') },
      ],
    },
  ];
  const FIELDS = GROUPS.flatMap((g) => g.fields);

  useEffect(() => {
    if (!settings.data) return;
    const next: Record<string, string> = {};
    for (const f of FIELDS) {
      const v = settings.data[f.key];
      next[f.key] = f.kind === 'money' ? ((v as number) / 100).toFixed(2) : f.kind === 'percent' ? ((v as number) / 100).toString() : f.kind === 'list' ? (v as string[]).join(', ') : String(v ?? '');
    }
    setForm(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <PageHeader title={t('admin.settingsTitle')} />
      <form onSubmit={save} className="space-y-6">
        {action.error && <Alert tone="error">{action.error}</Alert>}
        {saved && <Alert tone="success">{t('admin.settingsSaved')}</Alert>}
        {GROUPS.map((group) => (
          <Card key={group.title} title={group.title}>
            <div className="grid gap-4 md:grid-cols-2">
              {group.fields.map((f) => (
                <Field key={f.key} label={f.label} hint={f.hint}>
                  {f.kind === 'select' ? (
                    <Select value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      type={f.kind === 'text' || f.kind === 'list' ? 'text' : 'number'}
                      step={f.kind === 'money' || f.kind === 'percent' ? '0.01' : '1'}
                      min={0}
                      value={form[f.key] ?? ''}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      required
                    />
                  )}
                </Field>
              ))}
            </div>
          </Card>
        ))}
        <Button type="submit" loading={action.busy} arrow>
          {t('admin.saveSettings')}
        </Button>
      </form>
    </div>
  );
}
