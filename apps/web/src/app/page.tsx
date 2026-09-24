// Allow a sleeping free-tier API up to a minute to wake up before this page gives up.
export const maxDuration = 60;

import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowRightIcon, BadgeCheckIcon, CrownIcon, DownloadIcon, GridIcon, SearchIcon, ShieldIcon, categoryIcon } from '@/components/icons';
import { ProductGrid } from '@/components/product-card';
import { SortSelect } from '@/components/sort-select';
import { getT } from '@/i18n/server';
import { serverApi } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/format';
import type { Category, Paginated, ProductCard } from '@/lib/types';

export default async function HomePage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const { sort = 'popular' } = await searchParams;
  const { t, locale } = await getT();
  const [featured, categories, latest] = await Promise.all([
    serverApi<Paginated<ProductCard>>('/products', { sort, pageSize: 8 }),
    serverApi<Category[]>('/categories'),
    serverApi<Paginated<ProductCard>>('/products', { sort: 'newest', pageSize: 5 }),
  ]);
  const totalProducts = featured?.total ?? 0;
  const floating = (latest?.items ?? []).slice(0, 4);

  return (
    <>
      {/* Hero ------------------------------------------------------------ */}
      <section className="bg-hero text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div>
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">{t('home.badge')}</span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              {t('home.title1')}
              <br />
              <span className="text-brand-gradient-light">{t('home.title2')}</span>
            </h1>
            <p className="mt-5 max-w-lg text-base text-slate-300 sm:text-lg">{t('home.subtitle')}</p>

            <form action="/products" className="mt-8 flex max-w-xl items-center rounded-full bg-white p-1.5 shadow-glow">
              <input name="search" placeholder={t('home.searchPlaceholder')} aria-label={t('common.search')} className="h-10 flex-1 bg-transparent px-4 text-sm text-navy-900 placeholder:text-slate-400 focus:outline-none" />
              <button type="submit" className="bg-brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white" aria-label={t('common.search')}>
                <SearchIcon size={18} />
              </button>
            </form>

            <ul className="mt-8 grid gap-4 text-sm sm:grid-cols-3">
              <Trust icon={<ShieldIcon size={18} />} title={t('home.trust1')} text={t('home.trust1Text')} />
              <Trust icon={<DownloadIcon size={18} />} title={t('home.trust2')} text={t('home.trust2Text')} />
              <Trust icon={<BadgeCheckIcon size={18} />} title={t('home.trust3')} text={t('home.trust3Text')} />
            </ul>
          </div>

          <div className="relative hidden min-h-[380px] lg:block">
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-brand-500/25 via-cyan-400/10 to-transparent blur-2xl" />
            <div className="relative grid grid-cols-2 gap-4 p-4">
              {floating.map((p, i) => {
                const Icon = categoryIcon(p.category.slug);
                return (
                  <Link
                    key={p.id}
                    href={`/products/${p.slug}`}
                    className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 shadow-xl backdrop-blur transition hover:border-brand-500/60 hover:bg-white/15 ${i % 2 ? 'animate-float-delayed mt-8' : 'animate-float'}`}
                  >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${FLOAT_COLORS[i % FLOAT_COLORS.length]}`}>
                      <Icon size={20} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{p.title}</span>
                      <span className="block text-xs text-slate-300">{p.category.name}</span>
                      <span className="mt-1 block text-sm font-bold text-white">{p.priceCents === 0 ? t('common.free') : formatMoney(p.priceCents, p.currency)}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Categories ---------------------------------------------------- */}
        <section className="py-8">
          <div className="scrollbar-none flex gap-3 overflow-x-auto pb-2">
            <CategoryChip href="/products" label={t('home.allCategories')} icon={<GridIcon size={22} />} active />
            {categories?.map((c) => {
              const Icon = categoryIcon(c.slug);
              return <CategoryChip key={c.id} href={`/products?category=${c.slug}`} label={c.name} icon={<Icon size={22} />} />;
            })}
          </div>
        </section>

        {/* Featured -------------------------------------------------------- */}
        <section className="py-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-baseline gap-4">
              <h2 className="text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">{t('home.featuredTitle')}</h2>
              <span className="hidden text-sm font-medium text-slate-500 sm:inline">{t('home.featuredSubtitle')}</span>
            </div>
            <Suspense>
              <SortSelect value={sort} />
            </Suspense>
          </div>
          {featured && featured.items.length > 0 ? (
            <ProductGrid products={featured.items} />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">{t('home.noProducts')}</div>
          )}
          {featured && featured.total > 8 && (
            <div className="mt-8 text-center">
              <Link href="/products" className="bg-brand-gradient group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-glow">
                {t('home.viewAllProducts', { count: featured.total })} <ArrowRightIcon size={16} className="arrow-nudge" />
              </Link>
            </div>
          )}
        </section>

        {/* New releases: kaho news-release style list -------------------- */}
        {latest && latest.items.length > 0 && (
          <section className="py-10">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div className="flex items-baseline gap-4">
                <h2 className="text-2xl font-extrabold tracking-tight text-navy-900 sm:text-3xl">{t('home.latestTitle')}</h2>
                <span className="hidden text-sm font-medium text-slate-500 sm:inline">{t('home.latestSubtitle')}</span>
              </div>
              <Link href="/products?sort=newest" className="bg-brand-gradient group inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-glow">
                {t('common.viewAll')} <ArrowRightIcon size={16} className="arrow-nudge" />
              </Link>
            </div>
            <div className="border-t border-slate-200">
              {latest.items.map((p) => (
                <Link key={p.id} href={`/products/${p.slug}`} className="group flex items-center gap-4 border-b border-slate-200 py-4 transition hover:bg-brand-50/40 sm:gap-6">
                  <span className="w-24 shrink-0 text-xs text-slate-500 sm:w-28 sm:text-sm">{formatDate(p.publishedAt, false, locale)}</span>
                  <span className="hidden w-32 shrink-0 text-xs font-semibold text-brand-600 sm:block">{p.category.name}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-navy-900 sm:text-base">{p.title}</span>
                  <span className="shrink-0 text-sm font-bold text-navy-900">{p.priceCents === 0 ? t('common.free') : formatMoney(p.priceCents, p.currency)}</span>
                  <span className="arrow-nudge flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-500 text-brand-600 transition group-hover:bg-brand-500 group-hover:text-white">
                    <ArrowRightIcon size={16} />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Value banner ---------------------------------------------------- */}
        <section className="py-8">
          <div className="grid gap-8 rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-cyan-400/10 p-8 lg:grid-cols-[1.2fr_1fr] lg:p-12">
            <div>
              <span className="inline-flex rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">{t('home.whyBadge')}</span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-navy-900">{t('home.whyTitle')}</h2>
              <p className="mt-3 max-w-md text-slate-600">{t('home.whyText')}</p>
              <Link href="/products" className="bg-brand-gradient group mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-glow">
                {t('home.startBrowsing')} <ArrowRightIcon size={16} className="arrow-nudge" />
              </Link>
            </div>
            <ul className="grid gap-3 self-center text-sm text-slate-700 sm:grid-cols-2">
              {[t('home.why1'), t('home.why2'), t('home.why3'), t('home.why4')].map((text) => (
                <li key={text} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">✓</span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Become a seller ------------------------------------------------- */}
        <section className="pb-6 pt-2">
          <div className="flex flex-col gap-6 rounded-3xl bg-navy-900 px-8 py-8 text-white lg:flex-row lg:items-center lg:px-10">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-400">
                <CrownIcon size={26} />
              </span>
              <div>
                <h2 className="text-xl font-bold">{t('home.sellerTitle')}</h2>
                <p className="mt-1 text-sm text-slate-300">{t('home.sellerText')}</p>
              </div>
            </div>
            <Link href="/plans" className="bg-brand-gradient group inline-flex items-center gap-2 self-start rounded-full px-6 py-3 text-sm font-semibold shadow-glow lg:self-center">
              {t('home.startSelling')} <ArrowRightIcon size={16} className="arrow-nudge" />
            </Link>
            <dl className="grid grid-cols-3 gap-6 border-t border-white/10 pt-6 lg:ml-auto lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
              <Metric value={totalProducts} label={t('home.statProducts')} />
              <Metric value={categories?.length ?? 0} label={t('home.statCategories')} />
              <Metric value="24/7" label={t('home.statDelivery')} />
            </dl>
          </div>
        </section>
      </div>
    </>
  );
}

const FLOAT_COLORS = ['bg-pink-500/20 text-pink-300', 'bg-sky-500/20 text-sky-300', 'bg-emerald-500/20 text-emerald-300', 'bg-violet-500/20 text-violet-300'];

function Trust({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-cyan-400">{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-xs text-slate-300">{text}</span>
      </span>
    </li>
  );
}

function CategoryChip({ href, label, icon, active }: { href: string; label: string; icon: React.ReactNode; active?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex min-w-[120px] flex-col items-center gap-2 rounded-2xl border px-4 py-4 text-center text-xs font-medium transition ${
        active ? 'border-brand-100 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-700 shadow-sm hover:border-brand-500 hover:text-brand-600'
      }`}
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? 'bg-white text-brand-600' : 'bg-slate-50 text-slate-700'}`}>{icon}</span>
      {label}
    </Link>
  );
}

function Metric({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div>
      <dt className="text-2xl font-extrabold">{typeof value === 'number' ? value.toLocaleString() : value}</dt>
      <dd className="text-xs text-slate-300">{label}</dd>
    </div>
  );
}
