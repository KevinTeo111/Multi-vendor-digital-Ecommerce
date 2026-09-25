'use client';

import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Loading,
  Modal,
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
import { useRealtimeEvent } from '@/lib/realtime';
import type { Paginated, PublicSettings, Withdrawal } from '@/lib/types';
import { useAction, useFetch } from '@/lib/use-fetch';

const STATUSES = ['REQUESTED', 'APPROVED', '', 'PAID', 'REJECTED', 'FAILED'];

export default function AdminWithdrawalsPage() {
  const { t, status: statusLabel } = useLocale();
  const [status, setStatus] = useState('REQUESTED');
  const [page, setPage] = useState(1);
  const list = useFetch<Paginated<Withdrawal>>('/admin/finance/withdrawals', {
    status: status || undefined,
    page,
    pageSize: 25,
  });
  const settings = useFetch<PublicSettings>('/settings/public');
  const action = useAction();
  const [rejecting, setRejecting] = useState<Withdrawal | null>(null);
  const [paying, setPaying] = useState<Withdrawal | null>(null);
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  useRealtimeEvent('withdrawal.requested', () => list.reload());

  const manual = settings.data?.payoutMode !== 'gateway';

  const approve = async (w: Withdrawal) => {
    const vars = { amount: formatMoney(w.amountCents), vendor: w.vendor?.storeName ?? '' };
    if (
      !confirm(
        manual ? t('admin.approveManualConfirm', vars) : t('admin.approveGatewayConfirm', vars),
      )
    )
      return;
    const ok = await action.run(() =>
      api(`/admin/finance/withdrawals/${w.id}/approve`, { method: 'POST', body: {} }),
    );
    if (ok !== undefined) list.reload();
  };

  const markPaid = async () => {
    if (!paying) return;
    const ok = await action.run(() =>
      api(`/admin/finance/withdrawals/${paying.id}/mark-paid`, {
        method: 'POST',
        body: { reference: reference || undefined, notes: notes || undefined },
      }),
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
    const ok = await action.run(() =>
      api(`/admin/finance/withdrawals/${rejecting.id}/reject`, {
        method: 'POST',
        body: { reason },
      }),
    );
    if (ok !== undefined) {
      setRejecting(null);
      setReason('');
      list.reload();
    }
  };

  return (
    <div>
      <PageHeader
        title={t('admin.withdrawalsTitle')}
        description={manual ? t('admin.manualDescription') : t('admin.gatewayDescription')}
      />
      {action.error && (
        <div className="mb-4">
          <Alert tone="error">{action.error}</Alert>
        </div>
      )}
      <Card
        actions={
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-auto"
            aria-label={t('common.status')}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s ? statusLabel(s) : t('common.allStatuses')}
              </option>
            ))}
          </Select>
        }
      >
        {list.loading && !list.data ? (
          <Loading />
        ) : !list.data || list.data.items.length === 0 ? (
          <EmptyState title={t('admin.noWithdrawalsView')} />
        ) : (
          <>
            <Table
              headers={[
                t('vendor.requested'),
                t('admin.vendor'),
                t('admin.payoutTo'),
                t('common.amount'),
                t('common.status'),
                t('common.actions'),
              ]}
            >
              {list.data.items.map((w) => (
                <tr key={w.id}>
                  <Td className="text-xs">{formatDate(w.requestedAt, true)}</Td>
                  <Td>{w.vendor?.storeName}</Td>
                  <Td className="text-xs text-slate-500">
                    {w.vendor?.payoutDetails ? (
                      w.vendor.payoutDetails.type === 'PIX' ? (
                        <>
                          <div className="font-medium text-slate-700">
                            PIX {w.vendor.payoutDetails.pixKey}
                          </div>
                          <div>
                            {w.vendor.payoutDetails.holderName} ·{' '}
                            {w.vendor.payoutDetails.holderDocument}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-medium text-slate-700">
                            {w.vendor.payoutDetails.bankCode} · Ag {w.vendor.payoutDetails.branch} ·
                            Cc {w.vendor.payoutDetails.accountNumber}
                          </div>
                          <div>
                            {w.vendor.payoutDetails.holderName} ·{' '}
                            {w.vendor.payoutDetails.holderDocument}
                          </div>
                        </>
                      )
                    ) : (
                      <span className="text-rose-600">{t('common.missing')}</span>
                    )}
                  </Td>
                  <Td className="font-semibold">{formatMoney(w.amountCents)}</Td>
                  <Td>
                    <Badge status={w.status} />
                    {w.rejectionReason && (
                      <div className="mt-1 text-xs text-slate-500">{w.rejectionReason}</div>
                    )}
                    {w.adminNotes && (
                      <div className="mt-1 text-xs text-slate-500">{w.adminNotes}</div>
                    )}
                    {w.paidAt && (
                      <div className="mt-1 text-xs text-slate-500">
                        {t('admin.paidOn', { date: formatDate(w.paidAt) })}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {w.status === 'REQUESTED' && (
                        <>
                          <Button size="sm" onClick={() => approve(w)} loading={action.busy}>
                            {manual ? t('admin.approve') : t('admin.approveAndPay')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setRejecting(w)}>
                            {t('admin.reject')}
                          </Button>
                        </>
                      )}
                      {(w.status === 'APPROVED' || (manual && w.status === 'REQUESTED')) && (
                        <Button size="sm" variant="secondary" onClick={() => setPaying(w)}>
                          {t('admin.markPaid')}
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination
              page={list.data.page}
              totalPages={list.data.totalPages}
              onChange={setPage}
            />
          </>
        )}
      </Card>

      <Modal
        open={paying !== null}
        title={t('admin.markPaidTitle')}
        onClose={() => setPaying(null)}
      >
        {paying && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              {t('admin.markPaidText', {
                amount: formatMoney(paying.amountCents),
                vendor: paying.vendor?.storeName ?? '',
              })}
            </p>
            <Field label={t('admin.reference')} hint={t('admin.referenceHint')}>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={120}
              />
            </Field>
            <Field label={t('admin.notes')}>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPaying(null)}>
                {t('common.cancel')}
              </Button>
              <Button loading={action.busy} onClick={markPaid} arrow>
                {t('admin.confirmPayment')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={rejecting !== null}
        title={t('admin.rejectWithdrawal')}
        onClose={() => setRejecting(null)}
      >
        <p className="mb-2 text-sm text-slate-500">{t('admin.rejectWithdrawalText')}</p>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder={t('admin.reasonPlaceholder')}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRejecting(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={reason.trim().length < 3}
            loading={action.busy}
            onClick={reject}
          >
            {t('admin.reject')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
