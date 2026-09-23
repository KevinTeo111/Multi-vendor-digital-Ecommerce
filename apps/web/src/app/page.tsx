import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowRightIcon, BadgeCheckIcon, CrownIcon, DownloadIcon, FlameIcon, GridIcon, SearchIcon, ShieldIcon, categoryIcon } from '@/components/icons';
import { ProductGrid } from '@/components/product-card';
import { SortSelect } from '@/components/sort-select';
import { serverApi } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { Category, Paginated, ProductCard } from '@/lib/types';

export default async function HomePage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const { sort = 'popular' } = await searchParams;
  const [featured, categories, cheapest] = await Promise.all([
    serverApi<Paginated<ProductCard>>('/products', { sort, pageSize: 8 }),
    serverApi<Category[]>('/categories'),
    serverApi<Paginated<ProductCard>>('/products', { sort: 'price_asc', pageSize: 4 }),
  ]);
  const totalProducts = featured?.total ?? 0;
  const floating = (cheapest?.items ?? []).slice(0, 4);

  return (
    <>
      {/* Hero ------------------------------------------------------------ */}
      <section className="bg-hero text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div>
            <span className="inline-flex items-center rounded-full border border-navy-600 bg-navy-800/70 px-3 py-1 text-xs font-medium text-slate-300">
              Digital Products Marketplace
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Discover, Buy &amp; Sell
              <br />
              <span className="text-brand-gradient">Digital Products</span>
            </h1>
            <p className="mt-5 max-w-lg text-base text-slate-300 sm:text-lg">
              Premium digital products from talented creators around the world. Everything you need to grow, create and succeed, all in one place.
            </p>

            <form action="/products" className="mt-8 flex max-w-xl items-center rounded-full bg-white p-1.5 shadow-glow">
              <input
                name="search"
                placeholder="Search for digital products, e.g. templates, software, courses…"
                aria-label="Search products"
                className="h-10 flex-1 bg-transparent px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <button type="submit" className="bg-brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white" aria-label="Search">
                <SearchIcon size={18} />
              </button>
            </form>

            <ul className="mt-8 grid gap-4 text-sm sm:grid-cols-3">
              <Trust icon={<ShieldIcon size={18} />} title="Secure Payments" text="Protected transactions" />
              <Trust icon={<DownloadIcon size={18} />} title="Instant Download" text="Get access immediately" />
              <Trust icon={<BadgeCheckIcon size={18} />} title="Trusted Sellers" text="Reviewed & approved" />
            </ul>
          </div>

          {/* Floating product cards (real data) */}
          <div className="relative hidden min-h-[380px] lg:block">
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-brand-500/20 via-violet-600/10 to-transparent blur-2xl" />
            <div className="relative grid grid-cols-2 gap-4 p-4">
              {(floating.length ? floating : PLACEHOLDER_FLOATING).map((p, i) => (
                <Link
                  key={p.id}
                  href={'slug' in p && p.slug ? `/products/${p.slug}` : '/products'}
                  className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-navy-800/80 p-4 shadow-xl backdrop-blur transition hover:border-brand-500/60 ${i % 2 ? 'animate-float-delayed mt-8' : 'animate-float'}`}
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${FLOAT_COLORS[i % FLOAT_COLORS.length]}`}>
                    {(() => {
                      const Icon = categoryIcon(p.category.slug);
                      return <Icon size={20} />;
                    })()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{p.title}</span>
                    <span className="block text-xs text-slate-400">{p.category.name}</span>
                    <span className="mt-1 block text-sm font-bold text-white">{p.priceCents === 0 ? 'Free' : formatMoney(p.priceCents, p.currency)}</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Categories ---------------------------------------------------- */}
        <section className="-mt-1 py-8">
          <div className="scrollbar-none flex gap-3 overflow-x-auto pb-2">
            <CategoryChip href="/products" label="All Categories" icon={<GridIcon size={22} />} active />
            {categories?.map((c) => {
              const Icon = categoryIcon(c.slug);
              return <CategoryChip key={c.id} href={`/products?category=${c.slug}`} label={c.name} icon={<Icon size={22} />} />;
            })}
          </div>
        </section>

        {/* Featured -------------------------------------------------------- */}
        <section className="py-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                <FlameIcon size={22} />
              </span>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">Featured Products</h2>
                <p className="text-sm text-slate-500">Handpicked digital products from approved sellers</p>
              </div>
            </div>
            <Suspense>
              <SortSelect value={sort} />
            </Suspense>
          </div>
          {featured && featured.items.length > 0 ? (
            <ProductGrid products={featured.items} />
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
              No products published yet. Approved products appear here automatically.
            </div>
          )}
          {featured && featured.total > 8 && (
            <div className="mt-6 text-center">
              <Link href="/products" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700">
                View all {featured.total} products <ArrowRightIcon size={16} />
              </Link>
            </div>
          )}
        </section>

        {/* Value banner ---------------------------------------------------- */}
        <section className="py-8">
          <div className="grid gap-8 rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-violet-50 p-8 lg:grid-cols-[1.2fr_1fr] lg:p-12">
            <div>
              <span className="inline-flex rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">Why buy here</span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">Everything you need, delivered instantly</h2>
              <p className="mt-3 max-w-md text-slate-600">
                Every product is reviewed before it goes live. Pay once, download right away, and keep lifetime access in your library.
              </p>
              <Link href="/products" className="bg-brand-gradient mt-6 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-glow">
                Start browsing <ArrowRightIcon size={16} />
              </Link>
            </div>
            <ul className="grid gap-3 self-center text-sm text-slate-700 sm:grid-cols-2">
              {['Instant access after payment', 'Lifetime download access', 'Secure payment processing', 'Every listing reviewed by our team'].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Become a seller ------------------------------------------------- */}
        <section className="pb-4 pt-2">
          <div className="flex flex-col gap-6 rounded-3xl bg-navy-900 px-8 py-8 text-white lg:flex-row lg:items-center lg:px-10">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-400">
                <CrownIcon size={26} />
              </span>
              <div>
                <h2 className="text-xl font-bold">Become a Seller</h2>
                <p className="mt-1 text-sm text-slate-400">Share your digital products with a global audience and start earning today.</p>
              </div>
            </div>
            <Link href="/plans" className="bg-brand-gradient inline-flex items-center gap-2 self-start rounded-lg px-5 py-2.5 text-sm font-semibold shadow-glow lg:self-center">
              Start Selling <ArrowRightIcon size={16} />
            </Link>
            <dl className="grid grid-cols-3 gap-6 border-t border-navy-700 pt-6 lg:ml-auto lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
              <Metric value={totalProducts} label="Digital Products" />
              <Metric value={categories?.length ?? 0} label="Categories" />
              <Metric value="24/7" label="Instant Delivery" />
            </dl>
          </div>
        </section>
      </div>
    </>
  );
}

const FLOAT_COLORS = ['bg-pink-500/20 text-pink-300', 'bg-sky-500/20 text-sky-300', 'bg-emerald-500/20 text-emerald-300', 'bg-violet-500/20 text-violet-300'];

const PLACEHOLDER_FLOATING = [
  { id: 'p1', slug: '', title: 'Graphic Templates', priceCents: 1200, currency: 'BRL', category: { name: 'Graphics', slug: 'graphics' } },
  { id: 'p2', slug: '', title: 'Website Themes', priceCents: 2900, currency: 'BRL', category: { name: 'Templates', slug: 'templates' } },
  { id: 'p3', slug: '', title: 'Software & Tools', priceCents: 4900, currency: 'BRL', category: { name: 'Software', slug: 'software' } },
  { id: 'p4', slug: '', title: 'Online Courses', priceCents: 1900, currency: 'BRL', category: { name: 'Courses', slug: 'online-courses' } },
];

function Trust({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-navy-600 bg-navy-800 text-brand-500">{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-xs text-slate-400">{text}</span>
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
      <dd className="text-xs text-slate-400">{label}</dd>
    </div>
  );
}
