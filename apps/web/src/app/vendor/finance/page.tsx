'use client';

import { useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Loading, PageHeader, Pagination, Stat, Table, Td } from '@/components/ui';
import { useT } from '@/i18n/client';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import { useRealtimeEvent } from '@/lib/realtime';
import type { Balance, LedgerEntry, Paginated, Withdrawal, WithdrawalEligibility } from '@/lib/types';
import { useAction, useFetch } from '@/lib/use-fetch';

export default function VendorFinancePage() {
  const t = useT();
  const balance = useFetch<Balance>('/vendor/finance/balance');
  const eligibility = useFetch<WithdrawalEligibility>('/vendor/finance/withdrawals/eligibility');
  const [wPage, setWPage] = useState(1);
  const withdrawals = useFetch<Paginated<Withdrawal>>('/vendor/finance/withdrawals', { page: wPage, pageSize: 10 });
  const [lPage, setLPage] = useState(1);
  const ledger = useFetch<Paginated<LedgerEntry>>('/vendor/finance/ledger', { page: lPage, pageSize: 15 });
  const action = useAction();
  const [amount, setAmount] = useState('');

  const reloadAll = () => {
    balance.reload();
    eligibility.reload();
    withdrawals.reload();
    ledger.reload();
  };
  useRealtimeEvent('withdrawal.status', reloadAll);
  useRealtimeEvent('sale.new', reloadAll);

  const request = async () => {
    const cents = amount ? Math.round(Number(amount) * 100) : undefined;
    const ok = await action.run(() => api('/vendor/finance/withdrawals', { method: 'POST', body: cents ? { amountCents: cents } : {} }));
    if (ok !== undefined) {
      setAmount('');
      reloadAll();
    }
  };

  if (!balance.data || !eligibility.data) return <Loading />;
  const e = eligibility.data;

  return (
    <div className="space-y-6">
      <PageHeader title={t('vendor.financeTitle')} description={t('vendor.financeDescription')} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label={t('vendor.availableBalance')} value={formatMoney(balance.data.availableCents)} hint={t('vendor.minWithdrawal', { amount: formatMoney(e.minWithdrawalCents) })} />
        <Stat label={t('vendor.pendingBalance')} value={formatMoney(balance.data.pendingCents)} hint={t('vendor.clearsAutomatically')} />
      </div>

      <Card title={t('vendor.requestWithdrawal')}>
        {action.error && <Alert tone="error">{action.error}</Alert>}
        {e.ok ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label={t('vendor.amountOptional')}>
              <Input type="number" min={e.minWithdrawalCents / 100} step="0.01" value={amount} onChange={(ev) => setAmount(ev.target.value)} placeholder={(e.availableCents / 100).toFixed(2)} />
            </Field>
            <Button onClick={request} loading={action.busy} arrow>
              {t('vendor.requestButton')}
            </Button>
          </div>
        ) : (
          <Alert tone="warning">{e.reason}</Alert>
        )}
        <p className="mt-3 text-xs text-slate-500">{t('vendor.weeklyUsed', { used: e.requestsInLastWeek, limit: e.withdrawalsPerWeek })}</p>
      </Card>

      <Card title={t('vendor.withdrawalsTitle')}>
        {!withdrawals.data || withdrawals.data.items.length === 0 ? (
          <EmptyState title={t('vendor.noWithdrawals')} />
        ) : (
          <>
            <Table headers={[t('vendor.requested'), t('common.amount'), t('common.status'), t('vendor.paid'), t('vendor.notes')]}>
              {withdrawals.data.items.map((w) => (
                <tr key={w.id}>
                  <Td className="text-xs">{formatDate(w.requestedAt, true)}</Td>
                  <Td className="font-medium">{formatMoney(w.amountCents)}</Td>
                  <Td>
                    <Badge status={w.status} />
                  </Td>
                  <Td className="text-xs">{formatDate(w.paidAt)}</Td>
                  <Td className="text-xs text-slate-500">{w.rejectionReason ?? w.adminNotes ?? ''}</Td>
                </tr>
              ))}
            </Table>
            <Pagination page={withdrawals.data.page} totalPages={withdrawals.data.totalPages} onChange={setWPage} />
          </>
        )}
      </Card>

      <Card title={t('vendor.ledger')}>
        {!ledger.data || ledger.data.items.length === 0 ? (
          <EmptyState title={t('vendor.noEntries')} />
        ) : (
          <>
            <Table headers={[t('common.date'), t('vendor.description'), t('vendor.type'), t('common.status'), t('common.amount')]}>
              {ledger.data.items.map((l) => (
                <tr key={l.id}>
                  <Td className="text-xs">{formatDate(l.createdAt, true)}</Td>
                  <Td>
                    {l.description}
                    {l.orderItem && <span className="ml-1 font-mono text-xs text-slate-500">{l.orderItem.order.orderNumber}</span>}
                  </Td>
                  <Td className="text-xs">{l.type.replace(/_/g, ' ')}</Td>
                  <Td>
                    <Badge status={l.status} />
                    {l.status === 'PENDING' && l.availableAt && <div className="text-xs text-slate-500">{t('vendor.until', { date: formatDate(l.availableAt) })}</div>}
                  </Td>
                  <Td className={l.amountCents < 0 ? 'text-rose-600' : 'text-emerald-700'}>{formatMoney(l.amountCents)}</Td>
                </tr>
              ))}
            </Table>
            <Pagination page={ledger.data.page} totalPages={ledger.data.totalPages} onChange={setLPage} />
          </>
        )}
      </Card>
    </div>
  );
}
