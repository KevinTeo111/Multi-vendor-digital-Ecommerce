'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { Alert, Badge, Button, Card, Field, Input, Loading, Modal, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { formatBps, formatDate, formatMoney } from '@/lib/format';
import { PAGARME_PUBLIC_KEY, tokenizeCard, type CardInput } from '@/lib/pagarme';
import type { Plan, Subscription } from '@/lib/types';
import { useAction, useFetch } from '@/lib/use-fetch';

function SubscriptionView() {
  const params = useSearchParams();
  const highlight = params.get('plan');
  const plans = useFetch<Plan[]>('/plans');
  const sub = useFetch<{ current: Subscription | null; history: Subscription[] }>('/vendor/subscription');
  const action = useAction();
  const [cardFor, setCardFor] = useState<Plan | null>(null);

  const subscribe = async (planId: string, cardToken?: string) => {
    const res = await action.run(() => api<{ checkoutUrl: string | null }>('/vendor/subscription', { method: 'POST', body: { planId, cardToken } }));
    if (res?.checkoutUrl) window.location.href = res.checkoutUrl;
    else if (res) {
      setCardFor(null);
      sub.reload();
    }
  };

  const choose = (plan: Plan) => {
    // Paid plans need a card token when a real gateway is configured; free plans never do.
    if (plan.priceCents > 0 && PAGARME_PUBLIC_KEY) setCardFor(plan);
    else void subscribe(plan.id);
  };

  const cancel = async () => {
    if (!confirm('Cancel your plan? You keep access until the end of the current period.')) return;
    const ok = await action.run(() => api('/vendor/subscription', { method: 'DELETE' }));
    if (ok !== undefined) sub.reload();
  };

  if (!plans.data || !sub.data) return <Loading />;
  const current = sub.data.current;

  return (
    <div className="space-y-6">
      <PageHeader title="Your plan" description="Plans define your commission rate, product limit and weekly withdrawal allowance." />
      {action.error && !cardFor && <Alert tone="error">{action.error}</Alert>}

      {current ? (
        <Card title="Current subscription" actions={current.status === 'ACTIVE' && <Button variant="ghost" size="sm" onClick={cancel} loading={action.busy}>Cancel plan</Button>}>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-lg font-semibold">{current.plan.name}</span>
            <Badge status={current.status} />
            <span className="text-slate-500">
              {current.status === 'CANCELED' ? 'Access until' : 'Renews'} {formatDate(current.currentPeriodEnd)}
            </span>
          </div>
        </Card>
      ) : (
        <Alert tone="warning">You have no active plan. Choose one below to start publishing.</Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {plans.data.map((plan) => {
          const isCurrent = current?.planId === plan.id && current.status === 'ACTIVE';
          return (
            <Card key={plan.id} className={highlight === plan.slug ? 'ring-2 ring-indigo-500' : ''}>
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <div className="mt-1 text-2xl font-bold">
                {plan.priceCents === 0 ? 'Free' : formatMoney(plan.priceCents, plan.currency)}
                {plan.priceCents > 0 && <span className="text-sm font-normal text-slate-500"> / {plan.interval === 'YEAR' ? 'year' : 'month'}</span>}
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                <li>{formatBps(plan.commissionRateBps)} commission</li>
                <li>{plan.maxProducts === null ? 'Unlimited' : plan.maxProducts} listed products</li>
                <li>{plan.withdrawalsPerWeek} withdrawal request(s) per week</li>
              </ul>
              <Button className="mt-4 w-full" variant={isCurrent ? 'secondary' : 'primary'} disabled={isCurrent} onClick={() => choose(plan)} loading={action.busy && !cardFor}>
                {isCurrent ? 'Current plan' : current ? 'Switch to this plan' : 'Choose plan'}
              </Button>
            </Card>
          );
        })}
      </div>

      <CardModal plan={cardFor} busy={action.busy} error={action.error} onClose={() => setCardFor(null)} onToken={(token) => cardFor && subscribe(cardFor.id, token)} />
    </div>
  );
}

function CardModal({ plan, busy, error, onClose, onToken }: { plan: Plan | null; busy: boolean; error: string | null; onClose: () => void; onToken: (token: string) => void }) {
  const [card, setCard] = useState<CardInput>({ number: '', holderName: '', expMonth: '', expYear: '', cvv: '' });
  const [tokenizing, setTokenizing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTokenizing(true);
    setLocalError(null);
    try {
      onToken(await tokenizeCard(card));
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setTokenizing(false);
    }
  };

  const set = (k: keyof CardInput) => (e: React.ChangeEvent<HTMLInputElement>) => setCard({ ...card, [k]: e.target.value });

  return (
    <Modal open={plan !== null} title={plan ? `Subscribe to ${plan.name}` : ''} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        {(localError || error) && <Alert tone="error">{localError ?? error}</Alert>}
        <p className="text-sm text-slate-500">
          {plan && `${formatMoney(plan.priceCents, plan.currency)} per ${plan.interval === 'YEAR' ? 'year' : 'month'}, billed automatically. Card data is sent directly to the payment provider.`}
        </p>
        <Field label="Card number">
          <Input inputMode="numeric" autoComplete="cc-number" value={card.number} onChange={set('number')} required />
        </Field>
        <Field label="Name on card">
          <Input autoComplete="cc-name" value={card.holderName} onChange={set('holderName')} required />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Month">
            <Input inputMode="numeric" placeholder="MM" autoComplete="cc-exp-month" value={card.expMonth} onChange={set('expMonth')} required maxLength={2} />
          </Field>
          <Field label="Year">
            <Input inputMode="numeric" placeholder="YYYY" autoComplete="cc-exp-year" value={card.expYear} onChange={set('expYear')} required maxLength={4} />
          </Field>
          <Field label="CVV">
            <Input inputMode="numeric" autoComplete="cc-csc" value={card.cvv} onChange={set('cvv')} required maxLength={4} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={tokenizing || busy}>
            Subscribe
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense>
      <SubscriptionView />
    </Suspense>
  );
}
