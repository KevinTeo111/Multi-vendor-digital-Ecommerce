// Allow a sleeping free-tier API up to a minute to wake up before this page gives up.
export const maxDuration = 60;

import Link from 'next/link';
import { Suspense } from 'react';
import { GridIcon, categoryIcon } from '@/components/icons';
import { PageContainer } from '@/components/page-container';
import { ProductGrid } from '@/components/product-card';
import { SortSelect } from '@/components/sort-select';
import { getT } from '@/i18n/server';
import { serverApi } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { Category, Paginated, ProductCard } from '@/lib/types';

type Search = { search?: string; category?: string; sort?: string; page?: string; vendor?: string; minPriceCents?: string; maxPriceCents?: string };

export const metadata = { title: 'Browse' };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const page = Number(params.page ?? 1) || 1;
  const { t } = await getT();

  const PRICE_RANGES: Array<{ label: string; min?: number; max?: number }> = [
    { label: t('browse.anyPrice') },
    { label: t('common.free'), min: 0, max: 0 },
    { label: t('browse.upTo', { amount: formatMoney(2500) }), max: 2500 },
    { label: t('browse.between', { min: formatMoney(2500), max: formatMoney(10000) }), min: 2500, max: 10000 },
    { label: t('browse.andAbove', { amount: formatMoney(10000) }), min: 10000 },
  ];

  const [result, categories] = await Promise.all([
    serverApi<Paginated<ProductCard>>('/products', {
      search: params.search,
      category: params.category,
      vendor: params.vendor,
      sort: params.sort ?? 'newest',
      minPriceCents: params.minPriceCents,
      maxPriceCents: params.maxPriceCents,
      page,
      pageSize: 24,
    }),
    serverApi<Category[]>('/categories'),
  ]);

  const link = (patch: Partial<Search>) => {
    const q = new URLSearchParams();
    const merged = { ...params, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== '') q.set(k, String(v));
    const s = q.toString();
    return `/products${s ? `?${s}` : ''}`;
  };

  const activeCategory = categories?.find((c) => c.slug === params.category);
  const title = params.search ? t('browse.resultsFor', { query: params.search }) : activeCategory?.name ?? t('browse.allProducts');

  return (
    <PageContainer>
      <nav className="mb-4 text-xs text-slate-500">
        <Link href="/" className="hover:text-brand-600">{t('nav.home')}</Link> <span className="mx-1">/</span> <span className="text-slate-700">{t('browse.title')}</span>
        {activeCategory && (
          <>
            <span className="mx-1">/</span> <span className="text-slate-700">{activeCategory.name}</span>
          </>
        )}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
            <h2 className="mb-3 text-sm font-semibold text-navy-900">{t('browse.categories')}</h2>
            <ul className="space-y-1 text-sm">
              <li>
                <FilterLink href={link({ category: undefined, page: undefined })} active={!params.category} icon={<GridIcon size={16} />}>
                  {t('browse.allCategories')}
                </FilterLink>
              </li>
              {categories?.map((c) => {
                const Icon = categoryIcon(c.slug);
                return (
                  <li key={c.id}>
                    <FilterLink href={link({ category: c.slug, page: undefined })} active={params.category === c.slug} icon={<Icon size={16} />} count={c.productCount}>
                      {c.name}
                    </FilterLink>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
            <h2 className="mb-3 text-sm font-semibold text-navy-900">{t('browse.priceRange')}</h2>
            <ul className="space-y-1 text-sm">
              {PRICE_RANGES.map((r) => {
                const active = String(params.minPriceCents ?? '') === String(r.min ?? '') && String(params.maxPriceCents ?? '') === String(r.max ?? '');
                return (
                  <li key={r.label}>
                    <FilterLink href={link({ minPriceCents: r.min?.toString(), maxPriceCents: r.max?.toString(), page: undefined })} active={active}>
                      {r.label}
                    </FilterLink>
                  </li>
                );
              })}
            </ul>
          </div>

          {(params.search || params.category || params.minPriceCents || params.maxPriceCents) && (
            <Link href="/products" className="block text-center text-xs font-medium text-brand-600 hover:underline">
              {t('browse.clearFilters')}
            </Link>
          )}
        </aside>

        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-navy-900">{title}</h1>
              <p className="text-sm text-slate-500">{t('browse.productsCount', { count: result?.total ?? 0 })}</p>
            </div>
            <Suspense>
              <SortSelect value={params.sort} />
            </Suspense>
          </div>

          {result && result.items.length > 0 ? (
            <>
              <ProductGrid products={result.items} />
              {result.totalPages > 1 && (
                <nav className="mt-8 flex items-center justify-between text-sm">
                  {page > 1 ? <PageLink href={link({ page: String(page - 1) })}>← {t('common.previous')}</PageLink> : <span />}
                  <span className="text-slate-500">{t('common.pageOf', { page, total: result.totalPages })}</span>
                  {page < result.totalPages ? <PageLink href={link({ page: String(page + 1) })}>{t('common.next')} →</PageLink> : <span />}
                </nav>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center">
              <p className="font-semibold text-navy-900">{t('browse.noProductsTitle')}</p>
              <p className="mt-1 text-sm text-slate-500">{t('browse.noProductsText')}</p>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

function FilterLink({ href, active, icon, count, children }: { href: string; active?: boolean; icon?: React.ReactNode; count?: number; children: React.ReactNode }) {
  return (
    <Link href={href} className={`flex items-center gap-2 rounded-full px-3 py-2 transition ${active ? 'bg-brand-500 font-semibold text-white' : 'text-slate-700 hover:bg-slate-50'}`}>
      {icon && <span className={active ? 'text-white' : 'text-slate-400'}>{icon}</span>}
      <span className="flex-1">{children}</span>
      {count !== undefined && <span className={`text-xs ${active ? 'text-white/80' : 'text-slate-400'}`}>{count}</span>}
    </Link>
  );
}

function PageLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-full border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm hover:border-brand-500 hover:text-brand-600">
      {children}
    </Link>
  );
}
