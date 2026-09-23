'use client';

import { useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Loading, Modal, PageHeader, Pagination, Select, Table, Td, Textarea } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import type { Paginated, Withdrawal } from '@/lib/types';
import { useAction, useFetch } from '@/lib/use-fetch';

const STATUSES = ['REQUESTED', '', 'APPROVED', 'PAID', 'REJECTED', 'FAILED'];

export default function AdminWithdrawalsPage() {
  const [status, setStatus] = useState('REQUESTED');
  const [page, setPage] = useState(1);
  const list = useFetch<Paginated<Withdrawal>>('/admin/finance/withdrawals', { status: status || undefined, page, pageSize: 25 });
  const action = useAction();
  const [rejecting, setRejecting] = useState<Withdrawal | null>(null);
  const [reason, setReason] = useState('');

  const approve = async (w: Withdrawal) => {
    if (!confirm(`Approve and pay ${formatMoney(w.amountCents)} to ${w.vendor?.storeName}?`)) return;
    const ok = await action.run(() => api(`/admin/finance/withdrawals/${w.id}/approve`, { method: 'POST', body: {} }));
    if (ok !== undefined) list.reload();
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
      <PageHeader title="Withdrawals" description="Approving triggers a transfer to the vendor's payout account." />
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
                    {w.vendor?.payoutDetails
                      ? w.vendor.payoutDetails.type === 'PIX'
                        ? `PIX ${w.vendor.payoutDetails.pixKey}`
                        : `Bank ${w.vendor.payoutDetails.bankCode} / ${w.vendor.payoutDetails.branch} / ${w.vendor.payoutDetails.accountNumber}`
                      : 'Missing'}
                  </Td>
                  <Td className="font-medium">{formatMoney(w.amountCents)}</Td>
                  <Td>
                    <Badge status={w.status} />
                    {w.rejectionReason && <div className="text-xs text-slate-500">{w.rejectionReason}</div>}
                    {w.adminNotes && <div className="text-xs text-slate-500">{w.adminNotes}</div>}
                  </Td>
                  <Td>
                    {w.status === 'REQUESTED' && (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => approve(w)} loading={action.busy}>
                          Approve & pay
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRejecting(w)}>
                          Reject
                        </Button>
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination page={list.data.page} totalPages={list.data.totalPages} onChange={setPage} />
          </>
        )}
      </Card>

      <Modal open={rejecting !== null} title="Reject withdrawal" onClose={() => setRejecting(null)}>
        <p className="mb-2 text-sm text-slate-500">The held amount returns to the vendor's available balance.</p>
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
