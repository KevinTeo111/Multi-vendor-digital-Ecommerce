'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Alert, Button, Card, Field, Input, Loading, PageHeader, Select, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import type { PayoutDetails, VendorMe } from '@/lib/types';
import { useAction, useFetch } from '@/lib/use-fetch';

export default function VendorSettingsPage() {
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
      setSaved('Store profile saved');
      me.reload();
    }
  };

  const savePayout = async (e: FormEvent) => {
    e.preventDefault();
    const body = Object.fromEntries(Object.entries(pay).filter(([, v]) => v !== '' && v !== undefined));
    const ok = await payout.run(() => api('/vendors/me', { method: 'PATCH', body: { payoutDetails: body } }));
    if (ok !== undefined) {
      setSaved('Payout details saved');
      me.reload();
    }
  };

  const setP = (k: keyof PayoutDetails) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setPay({ ...pay, [k]: e.target.value });

  return (
    <div className="space-y-6">
      <PageHeader title="Store settings" />
      {saved && <Alert tone="success">{saved}</Alert>}

      <Card title="Store profile">
        <form onSubmit={saveProfile} className="space-y-4">
          {profile.error && <Alert tone="error">{profile.error}</Alert>}
          <Field label="Store name">
            <Input value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} required minLength={2} />
          </Field>
          <Field label="Store URL slug" hint={`Your store lives at /store/${form.slug || '…'}`}>
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} pattern="[a-z0-9-]+" minLength={3} required />
          </Field>
          <Field label="Description">
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} />
          </Field>
          <Button type="submit" loading={profile.busy}>
            Save profile
          </Button>
        </form>
      </Card>

      <Card title="Payout details" >
        <form onSubmit={savePayout} className="space-y-4">
          {payout.error && <Alert tone="error">{payout.error}</Alert>}
          <p className="text-sm text-slate-500">Withdrawals are transferred to this account after admin approval.</p>
          <Field label="Method">
            <Select value={pay.type} onChange={setP('type')}>
              <option value="PIX">PIX</option>
              <option value="BANK">Bank account</option>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Account holder name">
              <Input value={pay.holderName ?? ''} onChange={setP('holderName')} required />
            </Field>
            <Field label="Holder document (CPF/CNPJ)">
              <Input value={pay.holderDocument ?? ''} onChange={setP('holderDocument')} required />
            </Field>
          </div>
          {pay.type === 'PIX' ? (
            <Field label="PIX key">
              <Input value={pay.pixKey ?? ''} onChange={setP('pixKey')} required />
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bank code">
                <Input value={pay.bankCode ?? ''} onChange={setP('bankCode')} required />
              </Field>
              <Field label="Branch">
                <Input value={pay.branch ?? ''} onChange={setP('branch')} required />
              </Field>
              <Field label="Account number">
                <Input value={pay.accountNumber ?? ''} onChange={setP('accountNumber')} required />
              </Field>
              <Field label="Account type">
                <Select value={pay.accountType ?? 'CHECKING'} onChange={setP('accountType')}>
                  <option value="CHECKING">Checking</option>
                  <option value="SAVINGS">Savings</option>
                </Select>
              </Field>
            </div>
          )}
          <Button type="submit" loading={payout.busy}>
            Save payout details
          </Button>
        </form>
      </Card>
    </div>
  );
}
