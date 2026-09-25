'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Alert, Badge, Button, Card, Loading, PageHeader } from '@/components/ui';
import { useT } from '@/i18n/client';
import { api } from '@/lib/api';
import { formatBps, formatDate, formatMoney } from '@/lib/format';
import { useRealtimeEvent } from '@/lib/realtime';
import type { Plan, Subscription } from '@/lib/types';
import { useAction, useFetch } from '@/lib/use-fetch';

function SubscriptionView() {
  const t = useT();
  const params = useSearchParams();
  const highlight = params.get('plan');
  const returned = params.get('status'); // "success" | "canceled" after the hosted checkout
  const plans = useFetch<Plan[]>('/plans');
  const sub = useFetch<{ current: Subscription | null; pending: Subscription | null; history: Subscription[] }>('/vendor/subscription');
  const action = useAction();

  // The gateway webhook activates the subscription a few seconds after checkout; refresh when it lands.
  useRealtimeEvent('subscription.status', () => sub.reload());

  const subscribe = async (planId: string) => {
    const res = await action.run(() => api<{ checkoutUrl: string | null }>('/vendor/subscription', { method: 'POST', body: { planId } }));
    if (res?.checkoutUrl) window.location.href = res.checkoutUrl;
    else if (res) sub.reload();
  };

  const cancel = async () => {
    if (!confirm(t('vendor.cancelConfirm'))) return;
    const ok = await action.run(() => api('/vendor/subscription', { method: 'DELETE' }));
    if (ok !== undefined) sub.reload();
  };

  if (!plans.data || !sub.data) return <Loading />;
  const { current, pending } = sub.data;

  return (
    <div className="space-y-6">
      <PageHeader title={t('vendor.planTitle')} description={t('vendor.planDescription')} />
      {action.error && <Alert tone="error">{action.error}</Alert>}
      {returned === 'success' && !current && <Alert tone="info">{t('vendor.checkoutProcessing')}</Alert>}
      {returned === 'canceled' && !current && <Alert tone="warning">{t('vendor.checkoutCanceled')}</Alert>}

      {current ? (
        <Card
          title={t('vendor.currentSubscription')}
          actions={
            current.status === 'ACTIVE' && (
              <Button variant="ghost" size="sm" onClick={cancel} loading={action.busy}>
                {t('vendor.cancelPlan')}
              </Button>
            )
          }
        >
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-lg font-semibold text-navy-900">{current.plan.name}</span>
            <Badge status={current.status} />
            <span className="text-slate-500">
              {current.status === 'CANCELED' ? t('vendor.accessUntil') : t('vendor.renews')} {formatDate(current.currentPeriodEnd)}
            </span>
          </div>
        </Card>
      ) : pending ? (
        <Alert tone="info">{t('vendor.subscriptionPending', { plan: pending.plan.name })}</Alert>
      ) : (
        <Alert tone="warning">{t('vendor.noActivePlan')}</Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {plans.data.map((plan) => {
          const isCurrent = current?.planId === plan.id && current.status === 'ACTIVE';
          return (
            <Card key={plan.id} className={highlight === plan.slug ? 'ring-2 ring-brand-500' : ''}>
              <h3 className="text-lg font-semibold text-navy-900">{plan.name}</h3>
              <div className="mt-1 text-2xl font-bold text-navy-900">
                {plan.priceCents === 0 ? t('common.free') : formatMoney(plan.priceCents, plan.currency)}
                {plan.priceCents > 0 && <span className="text-sm font-normal text-slate-500"> {plan.interval === 'YEAR' ? t('common.perYear') : t('common.perMonth')}</span>}
              </div>
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                <li>{t('plans.commission', { pct: formatBps(plan.commissionRateBps) })}</li>
                <li>{plan.maxProducts === null ? t('plans.unlimitedProducts') : t('plans.listedProducts', { count: plan.maxProducts })}</li>
                <li>{t(plan.withdrawalsPerWeek > 1 ? 'plans.withdrawalsPlural' : 'plans.withdrawals', { count: plan.withdrawalsPerWeek })}</li>
              </ul>
              <Button className="mt-4 w-full" variant={isCurrent ? 'secondary' : 'primary'} disabled={isCurrent} onClick={() => subscribe(plan.id)} loading={action.busy} arrow={!isCurrent}>
                {isCurrent ? t('vendor.currentPlanButton') : current ? t('vendor.switchPlan') : t('vendor.choosePlanButton')}
              </Button>
              {plan.priceCents > 0 && <p className="mt-2 text-center text-xs text-slate-500">{t('vendor.securePaymentPage')}</p>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense>
      <SubscriptionView />
    </Suspense>
  );
}
