'use client';

import { useState } from 'react';
import {
  FilterBar,
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
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
import { formatDate, formatMoney } from '@/lib/format';
import type { Order } from '@/lib/types';
import { api } from '@/lib/api';
import { useAction, usePagedList } from '@/lib/use-fetch';

export default function AdminOrdersPage() {
  const { t, status: statusLabel } = useLocale();
  const list = usePagedList<Order>('/admin/orders', { status: '', search: '' });
  const action = useAction();
  const [refunding, setRefunding] = useState<Order | null>(null);
  const [reason, setReason] = useState('');

  const refund = async () => {
    if (!refunding) return;
    const done = await action.run(() =>
      api(`/admin/orders/${refunding.id}/refund`, { method: 'POST', body: { reason } }),
    );
    if (done !== undefined) {
      setRefunding(null);
      setReason('');
      list.reload();
    }
  };

  return (
    <div>
      <PageHeader title={t('admin.ordersTitle')} />
      <Card
        actions={
          <FilterBar>
            <Input
              placeholder={t('admin.searchOrder')}
              value={list.filters.search}
              onChange={(e) => list.setFilter('search', e.target.value)}
              className="sm:w-56"
            />
            <Select
              value={list.filters.status}
              onChange={(e) => list.setFilter('status', e.target.value)}
              className="sm:w-auto"
              aria-label={t('common.status')}
            >
              {['', 'PAID', 'PENDING', 'FAILED', 'CANCELED', 'REFUNDED'].map((s) => (
                <option key={s} value={s}>
                  {s ? statusLabel(s) : t('common.allStatuses')}
                </option>
              ))}
            </Select>
          </FilterBar>
        }
      >
        {list.loading && !list.data ? (
          <Loading />
        ) : !list.data || list.data.items.length === 0 ? (
          <EmptyState title={t('admin.noOrders')} />
        ) : (
          <>
            <Table
              headers={[
                t('orders.order'),
                t('common.date'),
                t('admin.buyer'),
                t('orders.items'),
                t('orders.total'),
                t('vendor.commission'),
                t('common.status'),
                t('common.actions'),
              ]}
            >
              {list.data.items.map((o) => (
                <tr key={o.id}>
                  <Td className="font-mono text-xs">{o.orderNumber}</Td>
                  <Td className="text-xs">{formatDate(o.createdAt, true)}</Td>
                  <Td>
                    {o.buyer?.name}
                    <div className="text-xs text-slate-500">{o.buyer?.email}</div>
                  </Td>
                  <Td>
                    {o.items.map((i) => (
                      <div key={i.id} className="text-xs">
                        {i.productTitle}{' '}
                        <span className="text-slate-500">· {i.vendor.storeName}</span>
                      </div>
                    ))}
                  </Td>
                  <Td>{formatMoney(o.totalCents, o.currency)}</Td>
                  <Td>
                    {formatMoney(
                      o.items.reduce((s, i) => s + i.commissionCents, 0),
                      o.currency,
                    )}
                  </Td>
                  <Td>
                    <Badge status={o.status} />
                    {o.status === 'REFUNDED' && o.refundReason && (
                      <div className="mt-1 max-w-48 text-xs text-slate-500">{o.refundReason}</div>
                    )}
                  </Td>
                  <Td>
                    {o.status === 'PAID' && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          action.setError(null);
                          setRefunding(o);
                        }}
                      >
                        {t('admin.refund')}
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
            <Pagination
              page={list.data.page}
              totalPages={list.data.totalPages}
              onChange={list.setPage}
            />
          </>
        )}
      </Card>

      <Modal
        open={refunding !== null}
        title={t('admin.refundTitle', { number: refunding?.orderNumber ?? '' })}
        onClose={() => setRefunding(null)}
      >
        {refunding && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {t('admin.refundText', {
                amount: formatMoney(refunding.totalCents, refunding.currency),
              })}
            </p>
            {action.error && <Alert tone="error">{action.error}</Alert>}
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('admin.refundReason')}
              rows={3}
              maxLength={500}
            />
            <Button
              variant="danger"
              className="w-full"
              loading={action.busy}
              disabled={reason.trim().length < 3}
              onClick={refund}
            >
              {t('admin.refundConfirm', {
                amount: formatMoney(refunding.totalCents, refunding.currency),
              })}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
