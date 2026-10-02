'use client';

import { useState, type FormEvent } from 'react';
import { useT } from '@/i18n/client';
import { api } from '@/lib/api';
import { formatBps, formatDate, formatMoney } from '@/lib/format';
import type { Coupon, CouponType } from '@/lib/types';
import { useAction, useFetch } from '@/lib/use-fetch';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Loading,
  Select,
  Table,
  Td,
} from './ui';

interface Option {
  id: string;
  label: string;
}

/**
 * Coupon list and creation form, shared by the admin (platform-funded coupons, optional seller
 * scope) and sellers (their own products, seller-funded). The API enforces who may do what.
 */
export function CouponManager({
  basePath,
  products,
  sellers,
}: {
  basePath: '/admin/coupons' | '/vendor/coupons';
  products: Option[];
  sellers?: Option[];
}) {
  const t = useT();
  const list = useFetch<Coupon[]>(basePath);
  const action = useAction();
  const empty = {
    code: '',
    type: 'PERCENT' as CouponType,
    value: '',
    minOrder: '',
    maxRedemptions: '',
    perBuyer: '1',
    startsAt: '',
    endsAt: '',
    productId: '',
    vendorId: '',
  };
  const [form, setForm] = useState(empty);
  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm({ ...form, [k]: e.target.value });

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const cents = (v: string) => (v ? Math.round(Number(v) * 100) : undefined);
    const created = await action.run(() =>
      api(basePath, {
        method: 'POST',
        body: {
          code: form.code,
          type: form.type,
          // PERCENT is stored in basis points (10% = 1000), FIXED in cents.
          value: Math.round(Number(form.value) * 100),
          minOrderCents: cents(form.minOrder),
          maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : undefined,
          perBuyerLimit: Number(form.perBuyer) || 1,
          startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
          endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
          productId: form.productId || undefined,
          vendorId: form.vendorId || undefined,
        },
      }),
    );
    if (created !== undefined) {
      setForm(empty);
      list.reload();
    }
  };

  const toggle = async (c: Coupon) => {
    const ok = await action.run(() =>
      api(`${basePath}/${c.id}`, { method: 'PATCH', body: { active: !c.active } }),
    );
    if (ok !== undefined) list.reload();
  };

  const describe = (c: Coupon) =>
    t('coupon.off', {
      value: c.type === 'PERCENT' ? formatBps(c.value) : formatMoney(c.value),
    });

  return (
    <div className="space-y-6">
      {action.error && <Alert tone="error">{action.error}</Alert>}
      <Card title={t('coupon.create')}>
        <form onSubmit={create} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('coupon.code')}>
              <Input
                value={form.code}
                onChange={set('code')}
                required
                pattern="[A-Za-z0-9_-]{3,30}"
                placeholder="BLACKFRIDAY"
                className="uppercase"
              />
            </Field>
            <Field label={t('coupon.type')}>
              <Select value={form.type} onChange={set('type')}>
                <option value="PERCENT">{t('coupon.percent')}</option>
                <option value="FIXED">{t('coupon.fixed')}</option>
              </Select>
            </Field>
            <Field
              label={form.type === 'PERCENT' ? t('coupon.valuePercent') : t('coupon.valueFixed')}
            >
              <Input
                type="number"
                min="0.01"
                max={form.type === 'PERCENT' ? 100 : undefined}
                step="0.01"
                value={form.value}
                onChange={set('value')}
                required
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('coupon.minOrder')}>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={form.minOrder}
                onChange={set('minOrder')}
              />
            </Field>
            <Field label={t('coupon.maxRedemptions')}>
              <Input
                type="number"
                min="1"
                step="1"
                value={form.maxRedemptions}
                onChange={set('maxRedemptions')}
              />
            </Field>
            <Field label={t('coupon.perBuyer')}>
              <Input
                type="number"
                min="1"
                step="1"
                value={form.perBuyer}
                onChange={set('perBuyer')}
                required
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('coupon.startsAt')}>
              <Input type="datetime-local" value={form.startsAt} onChange={set('startsAt')} />
            </Field>
            <Field label={t('coupon.endsAt')}>
              <Input type="datetime-local" value={form.endsAt} onChange={set('endsAt')} />
            </Field>
          </div>
          <div className={`grid gap-4 ${sellers ? 'sm:grid-cols-2' : ''}`}>
            {sellers && (
              <Field label={t('coupon.seller')}>
                <Select value={form.vendorId} onChange={set('vendorId')}>
                  <option value="">{t('coupon.anySeller')}</option>
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label={t('coupon.product')}>
              <Select value={form.productId} onChange={set('productId')}>
                <option value="">{t('coupon.anyProduct')}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button type="submit" loading={action.busy} arrow>
            {t('coupon.create')}
          </Button>
        </form>
      </Card>

      <Card title={t('coupon.title')}>
        {!list.data ? (
          <Loading />
        ) : list.data.length === 0 ? (
          <EmptyState title={t('coupon.none')} />
        ) : (
          <Table
            headers={[
              t('coupon.code'),
              t('coupon.type'),
              t('coupon.appliesTo'),
              t('coupon.usage'),
              t('common.status'),
              t('common.actions'),
            ]}
          >
            {list.data.map((c) => (
              <tr key={c.id}>
                <Td className="font-mono font-semibold">{c.code}</Td>
                <Td>
                  {describe(c)}
                  {c.minOrderCents && (
                    <div className="text-xs text-slate-500">≥ {formatMoney(c.minOrderCents)}</div>
                  )}
                </Td>
                <Td className="text-xs">
                  {c.product?.title ?? c.vendor?.storeName ?? t('coupon.scopeAll')}
                </Td>
                <Td className="text-xs">
                  {c.maxRedemptions
                    ? t('coupon.usesOf', { used: c._count.redemptions, max: c.maxRedemptions })
                    : t('coupon.uses', { used: c._count.redemptions })}
                  {c.endsAt && (
                    <div className="text-slate-500">
                      {t('coupon.validUntil', { date: formatDate(c.endsAt, true) })}
                    </div>
                  )}
                </Td>
                <Td>
                  <Badge status={c.active ? 'ACTIVE' : 'CANCELED'}>
                    {c.active ? t('coupon.active') : t('coupon.inactive')}
                  </Badge>
                </Td>
                <Td>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => toggle(c)}
                    loading={action.busy}
                  >
                    {c.active ? t('coupon.deactivate') : t('coupon.activate')}
                  </Button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
