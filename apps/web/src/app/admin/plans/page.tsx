'use client';

import { useState, type FormEvent } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  Loading,
  Modal,
  PageHeader,
  Select,
  Table,
  Td,
  Textarea,
} from '@/components/ui';
import { useT } from '@/i18n/client';
import { api } from '@/lib/api';
import { formatBps, formatMoney } from '@/lib/format';
import type { Plan } from '@/lib/types';
import { useAction, useFetch } from '@/lib/use-fetch';

type PlanForm = {
  name: string;
  description: string;
  price: string;
  interval: 'MONTH' | 'YEAR';
  commissionPct: string;
  maxProducts: string;
  withdrawalsPerWeek: string;
  isActive: boolean;
  sortOrder: string;
};

const empty: PlanForm = {
  name: '',
  description: '',
  price: '0',
  interval: 'MONTH',
  commissionPct: '20',
  maxProducts: '',
  withdrawalsPerWeek: '1',
  isActive: true,
  sortOrder: '0',
};

function toForm(p: Plan): PlanForm {
  return {
    name: p.name,
    description: p.description ?? '',
    price: (p.priceCents / 100).toFixed(2),
    interval: p.interval,
    commissionPct: (p.commissionRateBps / 100).toString(),
    maxProducts: p.maxProducts?.toString() ?? '',
    withdrawalsPerWeek: p.withdrawalsPerWeek.toString(),
    isActive: p.isActive,
    sortOrder: p.sortOrder.toString(),
  };
}

export default function AdminPlansPage() {
  const t = useT();
  const list = useFetch<Plan[]>('/admin/plans');
  const action = useAction();
  const [editing, setEditing] = useState<{ id: string | null; form: PlanForm } | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const f = editing.form;
    const body = {
      name: f.name,
      description: f.description || undefined,
      priceCents: Math.round(Number(f.price) * 100),
      interval: f.interval,
      commissionRateBps: Math.round(Number(f.commissionPct) * 100),
      maxProducts: f.maxProducts ? Number(f.maxProducts) : null,
      withdrawalsPerWeek: Number(f.withdrawalsPerWeek),
      isActive: f.isActive,
      sortOrder: Number(f.sortOrder),
    };
    const ok = await action.run(() =>
      editing.id
        ? api(`/admin/plans/${editing.id}`, { method: 'PATCH', body })
        : api('/admin/plans', { method: 'POST', body }),
    );
    if (ok !== undefined) {
      setEditing(null);
      list.reload();
    }
  };

  const deactivate = async (p: Plan) => {
    if (!confirm(t('admin.deactivateConfirm', { name: p.name }))) return;
    const ok = await action.run(() => api(`/admin/plans/${p.id}`, { method: 'DELETE' }));
    if (ok !== undefined) list.reload();
  };

  const set =
    (k: keyof PlanForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setEditing(
        (s) =>
          s && {
            ...s,
            form: {
              ...s.form,
              [k]:
                e.target.type === 'checkbox'
                  ? (e.target as HTMLInputElement).checked
                  : e.target.value,
            },
          },
      );

  if (!list.data) return <Loading />;

  return (
    <div>
      <PageHeader
        title={t('admin.plansTitle')}
        description={t('admin.plansDescription')}
        actions={
          <Button onClick={() => setEditing({ id: null, form: empty })} arrow>
            {t('admin.newPlan')}
          </Button>
        }
      />
      {action.error && !editing && (
        <div className="mb-4">
          <Alert tone="error">{action.error}</Alert>
        </div>
      )}
      <Card>
        <Table
          headers={[
            t('admin.plan'),
            t('admin.price'),
            t('vendor.commission'),
            t('admin.maxProducts'),
            t('admin.withdrawalsPerWeek'),
            t('admin.subscribers'),
            t('common.status'),
            '',
          ]}
        >
          {list.data.map((p) => (
            <tr key={p.id}>
              <Td>
                <div className="font-medium text-navy-900">{p.name}</div>
                <div className="text-xs text-slate-500">{p.slug}</div>
              </Td>
              <Td>
                {p.priceCents === 0 ? t('common.free') : formatMoney(p.priceCents, p.currency)}{' '}
                {p.interval === 'YEAR' ? t('common.perYear') : t('common.perMonth')}
              </Td>
              <Td>{formatBps(p.commissionRateBps)}</Td>
              <Td>{p.maxProducts ?? '∞'}</Td>
              <Td>{p.withdrawalsPerWeek}</Td>
              <Td>{p.activeSubscriptions ?? 0}</Td>
              <Td>
                <Badge status={p.isActive ? 'ACTIVE' : 'CANCELED'}>
                  {p.isActive ? t('status.ACTIVE') : t('status.Inactive')}
                </Badge>
              </Td>
              <Td>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditing({ id: p.id, form: toForm(p) })}
                  >
                    {t('common.edit')}
                  </Button>
                  {p.isActive && (
                    <Button size="sm" variant="ghost" onClick={() => deactivate(p)}>
                      {t('admin.deactivate')}
                    </Button>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Modal
        open={editing !== null}
        title={editing?.id ? t('admin.editPlan') : t('admin.newPlan')}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form onSubmit={save} className="space-y-3">
            {action.error && <Alert tone="error">{action.error}</Alert>}
            <Field label={t('admin.name')}>
              <Input value={editing.form.name} onChange={set('name')} required minLength={2} />
            </Field>
            <Field label={t('admin.description')}>
              <Textarea value={editing.form.description} onChange={set('description')} rows={2} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('admin.price')}>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editing.form.price}
                  onChange={set('price')}
                  required
                />
              </Field>
              <Field label={t('admin.billingInterval')}>
                <Select value={editing.form.interval} onChange={set('interval')}>
                  <option value="MONTH">{t('admin.monthly')}</option>
                  <option value="YEAR">{t('admin.yearly')}</option>
                </Select>
              </Field>
              <Field label={t('admin.commissionPct')}>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={editing.form.commissionPct}
                  onChange={set('commissionPct')}
                  required
                />
              </Field>
              <Field label={t('admin.maxProducts')} hint={t('admin.emptyUnlimited')}>
                <Input
                  type="number"
                  min={1}
                  value={editing.form.maxProducts}
                  onChange={set('maxProducts')}
                />
              </Field>
              <Field label={t('admin.withdrawalsPerWeek')}>
                <Input
                  type="number"
                  min={1}
                  max={7}
                  value={editing.form.withdrawalsPerWeek}
                  onChange={set('withdrawalsPerWeek')}
                  required
                />
              </Field>
              <Field label={t('admin.sortOrder')}>
                <Input
                  type="number"
                  min={0}
                  value={editing.form.sortOrder}
                  onChange={set('sortOrder')}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.form.isActive} onChange={set('isActive')} />{' '}
              {t('admin.availableForNew')}
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={action.busy}>
                {t('common.save')}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
