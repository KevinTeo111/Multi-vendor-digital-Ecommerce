import Link from 'next/link';
import { ProductGrid } from '@/components/product-card';
import { serverApi } from '@/lib/api';
import type { Category, Paginated, ProductCard } from '@/lib/types';

export default async function HomePage() {
  const [newest, popular, categories] = await Promise.all([
    serverApi<Paginated<ProductCard>>('/products', { sort: 'newest', pageSize: 8 }),
    serverApi<Paginated<ProductCard>>('/products', { sort: 'popular', pageSize: 4 }),
    serverApi<Category[]>('/categories'),
  ]);

  return (
    <div className="space-y-12">
      <section className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-12 text-white sm:px-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Digital products from independent creators</h1>
        <p className="mt-3 max-w-xl text-indigo-100">
          Software, templates, e-books and courses. Instant download after checkout. Sellers keep control of their own store.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/products" className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">
            Browse products
          </Link>
          <Link href="/plans" className="rounded-md border border-white/60 px-4 py-2 text-sm font-semibold hover:bg-white/10">
            Start selling
          </Link>
        </div>
      </section>

      {categories && categories.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Categories</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/products?category=${c.slug}`}
                className="rounded-full border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                {c.name}
                {c.productCount ? <span className="ml-1 text-slate-400">({c.productCount})</span> : null}
              </Link>
            ))}
          </div>
        </section>
      )}

      <Section title="Best sellers" href="/products?sort=popular" products={popular?.items ?? []} />
      <Section title="Newest" href="/products?sort=newest" products={newest?.items ?? []} />
    </div>
  );
}

function Section({ title, href, products }: { title: string; href: string; products: ProductCard[] }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Link href={href} className="text-sm text-indigo-600 hover:underline">
          View all
        </Link>
      </div>
      {products.length ? (
        <ProductGrid products={products} />
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
          No products published yet.
        </p>
      )}
    </section>
  );
}
