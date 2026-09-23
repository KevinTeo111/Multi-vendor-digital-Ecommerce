'use client';

import { useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Loading, PageHeader, Pagination, Stat, Table, Td } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import type { Balance, LedgerEntry, Paginated, Withdrawal, WithdrawalEligibility } from '@/lib/types';
import { useAction, useFetch } from '@/lib/use-fetch';

export default function VendorFinancePage() {
  const balance = useFetch<Balance>('/vendor/finance/balance');
  const eligibility = useFetch<WithdrawalEligibility>('/vendor/finance/withdrawals/eligibility');
  const [wPage, setWPage] = useState(1);
  const withdrawals = useFetch<Paginated<Withdrawal>>('/vendor/finance/withdrawals', { page: wPage, pageSize: 10 });
  const [lPage, setLPage] = useState(1);
  const ledger = useFetch<Paginated<LedgerEntry>>('/vendor/finance/ledger', { page: lPage, pageSize: 15 });
  const action = useAction();
  const [amount, setAmount] = useState('');

  const request = async () => {
    const cents = amount ? Math.round(Number(amount) * 100) : undefined;
    const ok = await action.run(() => api('/vendor/finance/withdrawals', { method: 'POST', body: cents ? { amountCents: cents } : {} }));
    if (ok !== undefined) {
      setAmount('');
      balance.reload();
      eligibility.reload();
      withdrawals.reload();
      ledger.reload();
    }
  };

  if (!balance.data || !eligibility.data) return <Loading />;
  const e = eligibility.data;

  return (
    <div className="space-y-6">
      <PageHeader title="Finance" description="Earnings clear into your available balance after the hold period." />

      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="Available" value={formatMoney(balance.data.availableCents)} hint={`Minimum withdrawal ${formatMoney(e.minWithdrawalCents)}`} />
        <Stat label="Pending" value={formatMoney(balance.data.pendingCents)} hint="Clears automatically" />
      </div>

      <Card title="Request a withdrawal">
        {action.error && <Alert tone="error">{action.error}</Alert>}
        {e.ok ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Amount (leave empty for full balance)">
              <Input type="number" min={e.minWithdrawalCents / 100} step="0.01" value={amount} onChange={(ev) => setAmount(ev.target.value)} placeholder={(e.availableCents / 100).toFixed(2)} />
            </Field>
            <Button onClick={request} loading={action.busy}>
              Request withdrawal
            </Button>
          </div>
        ) : (
          <Alert tone="warning">{e.reason}</Alert>
        )}
        <p className="mt-3 text-xs text-slate-500">
          {e.requestsInLastWeek} of {e.withdrawalsPerWeek} weekly request(s) used. Approved withdrawals are paid to your registered payout account.
        </p>
      </Card>

      <Card title="Withdrawals">
        {!withdrawals.data || withdrawals.data.items.length === 0 ? (
          <EmptyState title="No withdrawals yet" />
        ) : (
          <>
            <Table headers={['Requested', 'Amount', 'Status', 'Paid', 'Notes']}>
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

      <Card title="Ledger">
        {!ledger.data || ledger.data.items.length === 0 ? (
          <EmptyState title="No entries yet" />
        ) : (
          <>
            <Table headers={['Date', 'Description', 'Type', 'Status', 'Amount']}>
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
                    {l.status === 'PENDING' && l.availableAt && <div className="text-xs text-slate-500">until {formatDate(l.availableAt)}</div>}
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
