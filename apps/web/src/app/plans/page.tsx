// Allow a sleeping free-tier API up to a minute to wake up before this page gives up.
export const maxDuration = 60;

import Link from 'next/link';
import { ArrowRightIcon, CheckIcon } from '@/components/icons';
import { PageContainer } from '@/components/page-container';
import { getT } from '@/i18n/server';
import { serverApi } from '@/lib/api';
import { formatBps, formatMoney } from '@/lib/format';
import type { Plan } from '@/lib/types';

export const metadata = { title: 'Plans' };

export default async function PlansPage() {
  const { t } = await getT();
  const plans = (await serverApi<Plan[]>('/plans')) ?? [];
  const popularIndex = plans.length >= 3 ? 1 : plans.length - 1;

  return (
    <>
      <section className="bg-hero text-white">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6">
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
            {t('plans.badge')}
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-5xl">
            {t('plans.title1')}{' '}
            <span className="text-brand-gradient-light">{t('plans.title2')}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-300">{t('plans.subtitle')}</p>
        </div>
      </section>

      <PageContainer>
        <div className="-mt-16 grid gap-5 md:grid-cols-3">
          {plans.map((plan, i) => {
            const popular = i === popularIndex && plans.length > 1;
            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-3xl bg-white p-7 shadow-card ${popular ? 'border-2 border-brand-500 shadow-glow' : 'border border-slate-200/80'}`}
              >
                {popular && (
                  <span className="bg-brand-gradient absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold text-white">
                    {t('plans.mostPopular')}
                  </span>
                )}
                <h2 className="text-lg font-bold text-navy-900">{plan.name}</h2>
                {plan.description && (
                  <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                )}
                <div className="mt-5 text-4xl font-extrabold text-navy-900">
                  {plan.priceCents === 0
                    ? t('common.free')
                    : formatMoney(plan.priceCents, plan.currency)}
                  {plan.priceCents > 0 && (
                    <span className="text-sm font-medium text-slate-500">
                      {' '}
                      {plan.interval === 'YEAR' ? t('common.perYear') : t('common.perMonth')}
                    </span>
                  )}
                </div>
                <ul className="mt-6 space-y-3 text-sm text-slate-700">
                  <Feature>
                    {t('plans.commission', { pct: formatBps(plan.commissionRateBps) })}
                  </Feature>
                  <Feature>
                    {plan.maxProducts === null
                      ? t('plans.unlimitedProducts')
                      : t('plans.listedProducts', { count: plan.maxProducts })}
                  </Feature>
                  <Feature>
                    {t(
                      plan.withdrawalsPerWeek > 1 ? 'plans.withdrawalsPlural' : 'plans.withdrawals',
                      { count: plan.withdrawalsPerWeek },
                    )}
                  </Feature>
                  <Feature>{t('plans.ownStorefront')}</Feature>
                  <Feature>{t('plans.secureDelivery')}</Feature>
                </ul>
                <Link
                  href={`/register?role=VENDOR&plan=${plan.slug}`}
                  className={`group mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold transition ${popular ? 'bg-brand-gradient text-white shadow-glow' : 'border border-slate-200 text-navy-900 hover:border-brand-500 hover:text-brand-600'}`}
                >
                  {t('plans.choose', { name: plan.name })}{' '}
                  <ArrowRightIcon size={16} className="arrow-nudge" />
                </Link>
              </div>
            );
          })}
        </div>
        {plans.length === 0 && (
          <p className="mt-10 text-center text-sm text-slate-500">{t('plans.noPlans')}</p>
        )}
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
