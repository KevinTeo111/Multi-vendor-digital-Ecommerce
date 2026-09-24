'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Card, Field, Input, Loading, PageHeader, Select, Textarea } from '@/components/ui';
import { useT } from '@/i18n/client';
import { api } from '@/lib/api';
import type { PayoutDetails, VendorMe } from '@/lib/types';
import { useAction, useFetch } from '@/lib/use-fetch';

export default function VendorSettingsPage() {
  const t = useT();
  const me = useFetch<VendorMe>('/vendors/me');
  const profile = useAction();
  const payout = useAction();
  const [form, setForm] = useState({ storeName: '', slug: '', description: '' });
  const [pay, setPay] = useState<PayoutDetails>({ type: 'PIX' });
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (me.data) {
      setForm({ storeName: me.data.storeName, slug: me.data.slug, description: me.data.description ?? '' });
      if (me.data.payoutDetails) setPay(me.data.payoutDetails);
    }
  }, [me.data]);

  if (!me.data) return <Loading />;

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await profile.run(() => api('/vendors/me', { method: 'PATCH', body: { ...form, description: form.description || undefined } }));
    if (ok !== undefined) {
      setSaved(t('vendor.profileSaved'));
      me.reload();
    }
  };

  const savePayout = async (e: FormEvent) => {
    e.preventDefault();
    const body = Object.fromEntries(Object.entries(pay).filter(([, v]) => v !== '' && v !== undefined));
    const ok = await payout.run(() => api('/vendors/me', { method: 'PATCH', body: { payoutDetails: body } }));
    if (ok !== undefined) {
      setSaved(t('vendor.payoutSaved'));
      me.reload();
    }
  };

  const setP = (k: keyof PayoutDetails) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setPay({ ...pay, [k]: e.target.value });

  return (
    <div className="space-y-6">
      <PageHeader title={t('vendor.settingsTitle')} />
      {saved && <Alert tone="success">{saved}</Alert>}

      <Card title={t('vendor.storeProfile')}>
        <form onSubmit={saveProfile} className="space-y-4">
          {profile.error && <Alert tone="error">{profile.error}</Alert>}
          <Field label={t('vendor.storeNameLabel')}>
            <Input value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} required minLength={2} />
          </Field>
          <Field label={t('vendor.storeSlug')} hint={t('vendor.storeSlugHint', { slug: form.slug || '…' })}>
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} pattern="[a-z0-9-]+" minLength={3} required />
          </Field>
          <Field label={t('vendor.storeDescription')}>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
          </Field>
          <Button type="submit" loading={profile.busy}>
            {t('vendor.saveProfile')}
          </Button>
        </form>
      </Card>

      <Card title={t('vendor.payoutDetails')}>
        <form onSubmit={savePayout} className="space-y-4">
          {payout.error && <Alert tone="error">{payout.error}</Alert>}
          <p className="text-sm text-slate-500">{t('vendor.payoutInfo')}</p>
          <Field label={t('vendor.method')}>
            <Select value={pay.type} onChange={setP('type')}>
              <option value="PIX">PIX</option>
              <option value="BANK">{t('vendor.bankAccount')}</option>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('vendor.holderName')}>
              <Input value={pay.holderName ?? ''} onChange={setP('holderName')} required />
            </Field>
            <Field label={t('vendor.holderDocument')}>
              <Input value={pay.holderDocument ?? ''} onChange={setP('holderDocument')} required />
            </Field>
          </div>
          {pay.type === 'PIX' ? (
            <Field label={t('vendor.pixKey')}>
              <Input value={pay.pixKey ?? ''} onChange={setP('pixKey')} required />
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('vendor.bankCode')}>
                <Input value={pay.bankCode ?? ''} onChange={setP('bankCode')} required />
              </Field>
              <Field label={t('vendor.branch')}>
                <Input value={pay.branch ?? ''} onChange={setP('branch')} required />
              </Field>
              <Field label={t('vendor.accountNumber')}>
                <Input value={pay.accountNumber ?? ''} onChange={setP('accountNumber')} required />
              </Field>
              <Field label={t('vendor.accountType')}>
                <Select value={pay.accountType ?? 'CHECKING'} onChange={setP('accountType')}>
                  <option value="CHECKING">{t('vendor.checking')}</option>
                  <option value="SAVINGS">{t('vendor.savings')}</option>
                </Select>
              </Field>
            </div>
          )}
          <Button type="submit" loading={payout.busy}>
            {t('vendor.savePayout')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
