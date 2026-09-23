import { notFound } from 'next/navigation';
import { BadgeCheckIcon } from '@/components/icons';
import { PageContainer } from '@/components/page-container';
import { ProductGrid } from '@/components/product-card';
import { serverApi } from '@/lib/api';
import { formatDate } from '@/lib/format';
import type { Paginated, ProductCard, VendorPublic } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const vendor = await serverApi<VendorPublic>(`/vendors/${slug}`);
  return { title: vendor?.storeName ?? 'Store' };
}

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [vendor, products] = await Promise.all([
    serverApi<VendorPublic>(`/vendors/${slug}`),
    serverApi<Paginated<ProductCard>>('/products', { vendor: slug, pageSize: 48 }),
  ]);
  if (!vendor) notFound();

  const totalSales = products?.items.reduce((s, p) => s + p.salesCount, 0) ?? 0;

  return (
    <>
      <section className="bg-hero text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 sm:flex-row sm:items-center sm:px-6">
          <span className="bg-brand-gradient flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl text-3xl font-black shadow-glow">{vendor.storeName[0]}</span>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
              <span className="truncate">{vendor.storeName}</span>
              <BadgeCheckIcon size={22} className="shrink-0 text-brand-500" />
            </h1>
            {vendor.description && <p className="mt-2 max-w-2xl text-sm text-slate-300">{vendor.description}</p>}
          </div>
          <dl className="flex gap-8 text-center">
            <Metric value={vendor.productCount} label="Products" />
            <Metric value={totalSales} label="Sales" />
            <Metric value={formatDate(vendor.createdAt)} label="Member since" small />
          </dl>
        </div>
      </section>

      <PageContainer>
        <h2 className="mb-5 text-xl font-bold tracking-tight text-slate-900">Products</h2>
        {products && products.items.length > 0 ? (
          <ProductGrid products={products.items} />
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-center text-sm text-slate-500">This store has no published products yet.</div>
        )}
      </PageContainer>
    </>
  );
}

function Metric({ value, label, small }: { value: React.ReactNode; label: string; small?: boolean }) {
  return (
    <div>
      <dt className={small ? 'text-sm font-semibold' : 'text-2xl font-extrabold'}>{value}</dt>
      <dd className="text-xs text-slate-400">{label}</dd>
    </div>
  );
}
