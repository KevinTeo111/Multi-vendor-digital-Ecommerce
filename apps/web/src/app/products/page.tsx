import Link from 'next/link';
import { ProductGrid } from '@/components/product-card';
import { serverApi } from '@/lib/api';
import type { Category, Paginated, ProductCard } from '@/lib/types';

type Search = { search?: string; category?: string; sort?: string; page?: string; vendor?: string };

export const metadata = { title: 'Browse products' };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const page = Number(params.page ?? 1) || 1;

  const [result, categories] = await Promise.all([
    serverApi<Paginated<ProductCard>>('/products', {
      search: params.search,
      category: params.category,
      vendor: params.vendor,
      sort: params.sort ?? 'newest',
      page,
      pageSize: 24,
    }),
    serverApi<Category[]>('/categories'),
  ]);

  const link = (patch: Partial<Search>) => {
    const q = new URLSearchParams();
    const merged = { ...params, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, String(v));
    return `/products?${q.toString()}`;
  };

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <aside className="space-y-4">
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Categories</h2>
          <ul className="space-y-1 text-sm">
            <li>
              <Link href={link({ category: undefined, page: undefined })} className={!params.category ? 'font-semibold' : ''}>
                All
              </Link>
            </li>
            {categories?.map((c) => (
              <li key={c.id}>
                <Link href={link({ category: c.slug, page: undefined })} className={params.category === c.slug ? 'font-semibold' : ''}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Sort</h2>
          <ul className="space-y-1 text-sm">
            {[
              ['newest', 'Newest'],
              ['popular', 'Best selling'],
              ['price_asc', 'Price: low to high'],
              ['price_desc', 'Price: high to low'],
            ].map(([value, label]) => (
              <li key={value}>
                <Link href={link({ sort: value, page: undefined })} className={(params.sort ?? 'newest') === value ? 'font-semibold' : ''}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">
            {params.search ? `Results for “${params.search}”` : params.category ? categories?.find((c) => c.slug === params.category)?.name ?? 'Products' : 'All products'}
          </h1>
          <span className="text-sm text-slate-500">{result?.total ?? 0} products</span>
        </div>

        {result && result.items.length > 0 ? (
          <>
            <ProductGrid products={result.items} />
            {result.totalPages > 1 && (
              <nav className="mt-6 flex justify-between text-sm">
                {page > 1 ? <Link href={link({ page: String(page - 1) })}>← Previous</Link> : <span />}
                <span className="text-slate-500">
                  Page {page} of {result.totalPages}
                </span>
                {page < result.totalPages ? <Link href={link({ page: String(page + 1) })}>Next →</Link> : <span />}
              </nav>
            )}
          </>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">
            No products found.
          </p>
        )}
      </div>
    </div>
  );
}
