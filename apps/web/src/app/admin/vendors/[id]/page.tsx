'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ArrowRightIcon } from '@/components/icons';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Loading,
  PageHeader,
  Pagination,
  Select,
  Table,
  Td,
  Textarea,
} from '@/components/ui';
import { useLocale } from '@/i18n/client';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import type { AdminVendor, Balance, LedgerEntry } from '@/lib/types';
import { useAction, useFetch, usePagedList } from '@/lib/use-fetch';

/** Admin view of one seller's money: balances, the ledger, and manual corrections. */
export default function AdminVendorFinancePage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLocale();
  const vendor = useFetch<AdminVendor>(`/admin/vendors/${id}`);
  const balance = useFetch<Balance>(`/admin/finance/vendors/${id}/balance`);
  const ledger = usePagedList<LedgerEntry>(`/admin/finance/vendors/${id}/ledger`);

  const [direction, setDirection] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saved, setSaved] = useState(false);
  const action = useAction();

  const cents = Math.round(Number(amount.replace(',', '.')) * 100);
  const signedCents = direction === 'debit' ? -cents : cents;
  const goesNegative =
    direction === 'debit' && balance.data !== null && balance.data.availableCents - cents < 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(cents) || cents < 1) return;
    if (!confirm(t('admin.adjustConfirm', { amount: formatMoney(signedCents) }))) return;
    const ok = await action.run(() =>
      api(`/admin/finance/vendors/${id}/ledger/adjust`, {
        method: 'POST',
        body: { amountCents: signedCents, description: description.trim() },
      }),
    );
    if (ok !== undefined) {
      setAmount('');
      setDescription('');
      setSaved(true);
      balance.reload();
      ledger.reload();
    }
  };

  if (vendor.error) return <Alert tone="error">{vendor.error}</Alert>;
  if (!vendor.data) return <Loading />;
  const v = vendor.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.financeTitle', { store: v.storeName })}
        description={`${v.user.name} · ${v.user.email}`}
        actions={
          <Link
            href="/admin/vendors"
            className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline"
          >
            <ArrowRightIcon size={14} className="rotate-180" /> {t('admin.sellersTitle')}
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title={t('vendor.availableBalance')}>
          <p
            className={`text-2xl font-bold ${
              (balance.data?.availableCents ?? 0) < 0 ? 'text-rose-600' : 'text-navy-900'
            }`}
          >
            {balance.data ? formatMoney(balance.data.availableCents) : '—'}
          </p>
        </Card>
        <Card title={t('vendor.pendingBalance')}>
          <p className="text-2xl font-bold text-navy-900">
            {balance.data ? formatMoney(balance.data.pendingCents) : '—'}
          </p>
        </Card>
      </div>

      <Card title={t('admin.adjustTitle')} subtitle={t('admin.adjustDescription')}>
        <form onSubmit={submit} className="space-y-4">
          {action.error && <Alert tone="error">{action.error}</Alert>}
          {saved && !action.error && <Alert tone="success">{t('admin.adjustDone')}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('admin.adjustDirection')}>
              <Select
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'credit' | 'debit')}
              >
                <option value="credit">{t('admin.credit')}</option>
                <option value="debit">{t('admin.debit')}</option>
              </Select>
            </Field>
            <Field label={t('admin.adjustAmount')}>
              <Input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setSaved(false);
                }}
                required
              />
            </Field>
          </div>
          <Field label={t('admin.adjustReason')}>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              minLength={3}
              maxLength={500}
              required
            />
          </Field>
          {goesNegative && <Alert tone="warning">{t('admin.adjustNegative')}</Alert>}
          <Button type="submit" loading={action.busy} disabled={!(cents >= 1)}>
            {t('admin.adjustSubmit', { amount: cents >= 1 ? formatMoney(signedCents) : '' })}
          </Button>
        </form>
      </Card>

      <Card title={t('vendor.ledger')}>
        {ledger.loading && !ledger.data ? (
          <Loading />
        ) : !ledger.data || ledger.data.items.length === 0 ? (
          <EmptyState title={t('vendor.noEntries')} />
        ) : (
          <>
            <Table
              headers={[
                t('common.date'),
                t('vendor.description'),
                t('vendor.type'),
                t('common.status'),
                t('common.amount'),
              ]}
            >
              {ledger.data.items.map((l) => (
                <tr key={l.id}>
                  <Td className="text-xs">{formatDate(l.createdAt, true)}</Td>
                  <Td>
                    {l.description}
                    {l.orderItem && (
                      <span className="ml-1 font-mono text-xs text-slate-500">
                        {l.orderItem.order.orderNumber}
                      </span>
                    )}
                  </Td>
                  <Td className="text-xs">{l.type.replace(/_/g, ' ')}</Td>
                  <Td>
                    <Badge status={l.status} />
                    {l.status === 'PENDING' && l.availableAt && (
                      <div className="text-xs text-slate-500">
                        {t('vendor.until', { date: formatDate(l.availableAt) })}
                      </div>
                    )}
                  </Td>
                  <Td className={l.amountCents < 0 ? 'text-rose-600' : 'text-emerald-700'}>
                    {formatMoney(l.amountCents)}
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination
              page={ledger.data.page}
              totalPages={ledger.data.totalPages}
              onChange={ledger.setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
