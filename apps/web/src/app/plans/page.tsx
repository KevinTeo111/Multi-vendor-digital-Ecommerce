import Link from 'next/link';
import { serverApi } from '@/lib/api';
import { formatBps, formatMoney } from '@/lib/format';
import type { Plan } from '@/lib/types';

export const metadata = { title: 'Seller plans' };

export default async function PlansPage() {
  const plans = (await serverApi<Plan[]>('/plans')) ?? [];

  return (
    <div className="space-y-8">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Start selling your digital products</h1>
        <p className="mx-auto mt-2 max-w-xl text-slate-600 dark:text-slate-300">
          Pick a plan, open your store and publish. Every listing is reviewed by our team before it goes live.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-lg font-semibold">{plan.name}</h2>
            <div className="mt-2 text-3xl font-bold">
              {plan.priceCents === 0 ? 'Free' : formatMoney(plan.priceCents, plan.currency)}
              {plan.priceCents > 0 && <span className="text-sm font-normal text-slate-500"> / {plan.interval === 'YEAR' ? 'year' : 'month'}</span>}
            </div>
            {plan.description && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{plan.description}</p>}
            <ul className="mt-4 space-y-2 text-sm">
              <li>✔ {formatBps(plan.commissionRateBps)} platform commission</li>
              <li>✔ {plan.maxProducts === null ? 'Unlimited' : plan.maxProducts} listed products</li>
              <li>✔ {plan.withdrawalsPerWeek} withdrawal request{plan.withdrawalsPerWeek > 1 ? 's' : ''} per week</li>
            </ul>
            <Link
              href={`/register?role=VENDOR&plan=${plan.slug}`}
              className="mt-6 rounded-md bg-indigo-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-indigo-500"
            >
              Choose {plan.name}
            </Link>
          </div>
        ))}
      </div>

      {plans.length === 0 && <p className="text-center text-sm text-slate-500">No plans are available right now.</p>}
    </div>
  );
}
