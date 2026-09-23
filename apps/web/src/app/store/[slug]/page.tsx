import { notFound } from 'next/navigation';
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

  return (
    <div className="space-y-8">
      <header className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-2xl font-bold">{vendor.storeName}</h1>
        {vendor.description && <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">{vendor.description}</p>}
        <p className="mt-3 text-xs text-slate-500">
          {vendor.productCount} products · Member since {formatDate(vendor.createdAt)}
        </p>
      </header>

      {products && products.items.length > 0 ? (
        <ProductGrid products={products.items} />
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">
          This store has no published products yet.
        </p>
      )}
    </div>
  );
}
