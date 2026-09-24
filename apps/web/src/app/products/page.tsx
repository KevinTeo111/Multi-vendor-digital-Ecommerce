// Allow a sleeping free-tier API up to a minute to wake up before this page gives up.
export const maxDuration = 60;

import Link from 'next/link';
import { Suspense } from 'react';
import { GridIcon, categoryIcon } from '@/components/icons';
import { PageContainer } from '@/components/page-container';
import { ProductGrid } from '@/components/product-card';
import { SortSelect } from '@/components/sort-select';
import { serverApi } from '@/lib/api';
import type { Category, Paginated, ProductCard } from '@/lib/types';

type Search = { search?: string; category?: string; sort?: string; page?: string; vendor?: string; minPriceCents?: string; maxPriceCents?: string };

export const metadata = { title: 'Browse products' };

const PRICE_RANGES: Array<{ label: string; min?: number; max?: number }> = [
  { label: 'Any price' },
  { label: 'Free', min: 0, max: 0 },
  { label: 'Up to R$ 25', max: 2500 },
  { label: 'R$ 25 – R$ 100', min: 2500, max: 10000 },
  { label: 'R$ 100+', min: 10000 },
];

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const page = Number(params.page ?? 1) || 1;

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
  const title = params.search ? `Results for “${params.search}”` : activeCategory?.name ?? 'All Categories';

  return (
    <PageContainer>
      <nav className="mb-4 text-xs text-slate-500">
        <Link href="/" className="hover:text-brand-600">Home</Link> <span className="mx-1">/</span> <span className="text-slate-700">Browse</span>
        {activeCategory && (
          <>
            <span className="mx-1">/</span> <span className="text-slate-700">{activeCategory.name}</span>
          </>
        )}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Categories</h2>
            <ul className="space-y-1 text-sm">
              <li>
                <FilterLink href={link({ category: undefined, page: undefined })} active={!params.category} icon={<GridIcon size={16} />}>
                  All Categories
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
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Price Range</h2>
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
              Clear all filters
            </Link>
          )}
        </aside>

        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
              <p className="text-sm text-slate-500">{result?.total ?? 0} products</p>
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
                  {page > 1 ? <PageLink href={link({ page: String(page - 1) })}>← Previous</PageLink> : <span />}
                  <span className="text-slate-500">
                    Page {page} of {result.totalPages}
                  </span>
                  {page < result.totalPages ? <PageLink href={link({ page: String(page + 1) })}>Next →</PageLink> : <span />}
                </nav>
              )}
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center">
              <p className="font-semibold text-slate-900">No products found</p>
              <p className="mt-1 text-sm text-slate-500">Try a different search or clear the filters.</p>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

function FilterLink({ href, active, icon, count, children }: { href: string; active?: boolean; icon?: React.ReactNode; count?: number; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 transition ${active ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-700 hover:bg-slate-50'}`}
    >
      {icon && <span className={active ? 'text-brand-600' : 'text-slate-400'}>{icon}</span>}
      <span className="flex-1">{children}</span>
      {count !== undefined && <span className="text-xs text-slate-400">{count}</span>}
    </Link>
  );
}

function PageLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-lg border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 shadow-sm hover:border-brand-500 hover:text-brand-600">
      {children}
    </Link>
  );
}
