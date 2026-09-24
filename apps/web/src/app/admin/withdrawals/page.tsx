'use client';

import { useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Loading, Modal, PageHeader, Pagination, Select, Table, Td, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import type { Paginated, PublicSettings, Withdrawal } from '@/lib/types';
import { useAction, useFetch } from '@/lib/use-fetch';

const STATUSES = ['REQUESTED', 'APPROVED', '', 'PAID', 'REJECTED', 'FAILED'];

export default function AdminWithdrawalsPage() {
  const [status, setStatus] = useState('REQUESTED');
  const [page, setPage] = useState(1);
  const list = useFetch<Paginated<Withdrawal>>('/admin/finance/withdrawals', { status: status || undefined, page, pageSize: 25 });
  const settings = useFetch<PublicSettings>('/settings/public');
  const action = useAction();
  const [rejecting, setRejecting] = useState<Withdrawal | null>(null);
  const [paying, setPaying] = useState<Withdrawal | null>(null);
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const manual = settings.data?.payoutMode !== 'gateway';

  const approve = async (w: Withdrawal) => {
    const msg = manual
      ? `Approve ${formatMoney(w.amountCents)} for ${w.vendor?.storeName}? You will then send the money manually and mark it as paid.`
      : `Approve and transfer ${formatMoney(w.amountCents)} to ${w.vendor?.storeName} through the payment gateway?`;
    if (!confirm(msg)) return;
    const ok = await action.run(() => api(`/admin/finance/withdrawals/${w.id}/approve`, { method: 'POST', body: {} }));
    if (ok !== undefined) list.reload();
  };

  const markPaid = async () => {
    if (!paying) return;
    const ok = await action.run(() =>
      api(`/admin/finance/withdrawals/${paying.id}/mark-paid`, { method: 'POST', body: { reference: reference || undefined, notes: notes || undefined } }),
    );
    if (ok !== undefined) {
      setPaying(null);
      setReference('');
      setNotes('');
      list.reload();
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    const ok = await action.run(() => api(`/admin/finance/withdrawals/${rejecting.id}/reject`, { method: 'POST', body: { reason } }));
    if (ok !== undefined) {
      setRejecting(null);
      setReason('');
      list.reload();
    }
  };

  return (
    <div>
      <PageHeader
        title="Withdrawals"
        description={
          manual
            ? 'Manual payouts: approve, send the money by PIX or bank transfer, then mark the withdrawal as paid.'
            : 'Gateway payouts: approving triggers a transfer through the payment provider.'
        }
      />
      {action.error && (
        <div className="mb-4">
          <Alert tone="error">{action.error}</Alert>
        </div>
      )}
      <Card
        actions={
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-auto" aria-label="Status">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s || 'All statuses'}
              </option>
            ))}
          </Select>
        }
      >
        {list.loading && !list.data ? (
          <Loading />
        ) : !list.data || list.data.items.length === 0 ? (
          <EmptyState title="No withdrawals in this view" />
        ) : (
          <>
            <Table headers={['Requested', 'Vendor', 'Payout to', 'Amount', 'Status', 'Actions']}>
              {list.data.items.map((w) => (
                <tr key={w.id}>
                  <Td className="text-xs">{formatDate(w.requestedAt, true)}</Td>
                  <Td>{w.vendor?.storeName}</Td>
                  <Td className="text-xs text-slate-500">
                    {w.vendor?.payoutDetails ? (
                      w.vendor.payoutDetails.type === 'PIX' ? (
                        <>
                          <div className="font-medium text-slate-700">PIX {w.vendor.payoutDetails.pixKey}</div>
                          <div>{w.vendor.payoutDetails.holderName} · {w.vendor.payoutDetails.holderDocument}</div>
                        </>
                      ) : (
                        <>
                          <div className="font-medium text-slate-700">
                            Bank {w.vendor.payoutDetails.bankCode} · Ag {w.vendor.payoutDetails.branch} · Cc {w.vendor.payoutDetails.accountNumber}
                          </div>
                          <div>{w.vendor.payoutDetails.holderName} · {w.vendor.payoutDetails.holderDocument}</div>
                        </>
                      )
                    ) : (
                      <span className="text-rose-600">Missing</span>
                    )}
                  </Td>
                  <Td className="font-semibold">{formatMoney(w.amountCents)}</Td>
                  <Td>
                    <Badge status={w.status} />
                    {w.rejectionReason && <div className="mt-1 text-xs text-slate-500">{w.rejectionReason}</div>}
                    {w.adminNotes && <div className="mt-1 text-xs text-slate-500">{w.adminNotes}</div>}
                    {w.paidAt && <div className="mt-1 text-xs text-slate-500">Paid {formatDate(w.paidAt)}</div>}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {w.status === 'REQUESTED' && (
                        <>
                          <Button size="sm" onClick={() => approve(w)} loading={action.busy}>
                            {manual ? 'Approve' : 'Approve & pay'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setRejecting(w)}>
                            Reject
                          </Button>
                        </>
                      )}
                      {(w.status === 'APPROVED' || (manual && w.status === 'REQUESTED')) && (
                        <Button size="sm" variant="secondary" onClick={() => setPaying(w)}>
                          Mark as paid
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination page={list.data.page} totalPages={list.data.totalPages} onChange={setPage} />
          </>
        )}
      </Card>

      <Modal open={paying !== null} title="Mark withdrawal as paid" onClose={() => setPaying(null)}>
        {paying && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Confirm that you sent <strong>{formatMoney(paying.amountCents)}</strong> to <strong>{paying.vendor?.storeName}</strong>. The vendor will see the withdrawal as paid.
            </p>
            <Field label="Transaction reference (optional)" hint="PIX end-to-end ID or bank receipt number">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} />
            </Field>
            <Field label="Notes (optional)">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPaying(null)}>
                Cancel
              </Button>
              <Button loading={action.busy} onClick={markPaid}>
                Confirm payment
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={rejecting !== null} title="Reject withdrawal" onClose={() => setRejecting(null)}>
        <p className="mb-2 text-sm text-slate-500">The held amount returns to the vendor&apos;s available balance.</p>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason shown to the vendor" />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRejecting(null)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={reason.trim().length < 3} loading={action.busy} onClick={reject}>
            Reject
          </Button>
        </div>
      </Modal>
    </div>
  );
}
