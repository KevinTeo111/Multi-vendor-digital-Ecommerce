import Link from 'next/link';
import { CheckIcon } from '@/components/icons';
import { PageContainer } from '@/components/page-container';
import { serverApi } from '@/lib/api';
import { formatBps, formatMoney } from '@/lib/format';
import type { Plan } from '@/lib/types';

export const metadata = { title: 'Seller plans' };

export default async function PlansPage() {
  const plans = (await serverApi<Plan[]>('/plans')) ?? [];
  const popularIndex = plans.length >= 3 ? 1 : plans.length - 1;

  return (
    <>
      <section className="bg-hero text-white">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6">
          <span className="inline-flex rounded-full border border-navy-600 bg-navy-800/70 px-3 py-1 text-xs font-medium text-slate-300">For creators</span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Start selling your <span className="text-brand-gradient">digital products</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-300">
            Pick a plan, open your store and publish. Every listing is reviewed by our team before it goes live, and you keep control of your earnings.
          </p>
        </div>
      </section>

      <PageContainer>
        <div className="-mt-16 grid gap-5 md:grid-cols-3">
          {plans.map((plan, i) => {
            const popular = i === popularIndex && plans.length > 1;
            return (
              <div key={plan.id} className={`relative flex flex-col rounded-3xl bg-white p-7 shadow-card ${popular ? 'border-2 border-brand-500 shadow-glow' : 'border border-slate-200/80'}`}>
                {popular && <span className="bg-brand-gradient absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold text-white">Most popular</span>}
                <h2 className="text-lg font-bold text-slate-900">{plan.name}</h2>
                {plan.description && <p className="mt-1 text-sm text-slate-500">{plan.description}</p>}
                <div className="mt-5 text-4xl font-extrabold text-slate-900">
                  {plan.priceCents === 0 ? 'Free' : formatMoney(plan.priceCents, plan.currency)}
                  {plan.priceCents > 0 && <span className="text-sm font-medium text-slate-500"> / {plan.interval === 'YEAR' ? 'year' : 'month'}</span>}
                </div>
                <ul className="mt-6 space-y-3 text-sm text-slate-700">
                  <Feature>{formatBps(plan.commissionRateBps)} platform commission per sale</Feature>
                  <Feature>{plan.maxProducts === null ? 'Unlimited' : plan.maxProducts} listed products</Feature>
                  <Feature>
                    {plan.withdrawalsPerWeek} withdrawal request{plan.withdrawalsPerWeek > 1 ? 's' : ''} per week
                  </Feature>
                  <Feature>Own storefront page</Feature>
                  <Feature>Secure file delivery</Feature>
                </ul>
                <Link
                  href={`/register?role=VENDOR&plan=${plan.slug}`}
                  className={`mt-8 inline-flex h-11 items-center justify-center rounded-lg text-sm font-semibold transition ${popular ? 'bg-brand-gradient text-white shadow-glow' : 'border border-slate-200 text-slate-800 hover:border-brand-500 hover:text-brand-600'}`}
                >
                  Choose {plan.name}
                </Link>
              </div>
            );
          })}
        </div>
        {plans.length === 0 && <p className="mt-10 text-center text-sm text-slate-500">No plans are available right now.</p>}
      </PageContainer>
    </>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <CheckIcon size={12} />
      </span>
      {children}
    </li>
  );
}
