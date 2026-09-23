import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddToCart } from '@/components/add-to-cart';
import { serverApi } from '@/lib/api';
import { formatBytes, formatDate, formatMoney } from '@/lib/format';
import type { ProductDetail } from '@/lib/types';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await serverApi<ProductDetail>(`/products/${slug}`);
  return { title: product?.title ?? 'Product', description: product?.shortDescription };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await serverApi<ProductDetail>(`/products/${slug}`);
  if (!product) notFound();

  const previews = [product.thumbnailUrl, ...product.previewImageUrls].filter((u): u is string => Boolean(u));

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <nav className="text-xs text-slate-500">
          <Link href="/products">Products</Link> / <Link href={`/products?category=${product.category.slug}`}>{product.category.name}</Link>
        </nav>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{product.title}</h1>
        <p className="text-slate-600 dark:text-slate-300">{product.shortDescription}</p>

        {previews.length > 0 && (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previews[0]} alt={product.title} className="w-full rounded-lg border border-slate-200 object-cover dark:border-slate-700" />
            {previews.length > 1 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {previews.slice(1).map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt="" className="aspect-[4/3] w-full rounded-md border border-slate-200 object-cover dark:border-slate-700" />
                ))}
              </div>
            )}
          </div>
        )}

        <article className="prose prose-slate max-w-none whitespace-pre-wrap text-sm dark:prose-invert">{product.description}</article>

        {product.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {product.tags.map((t) => (
              <Link key={t} href={`/products?search=${encodeURIComponent(t)}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                #{t}
              </Link>
            ))}
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="text-3xl font-bold">{formatMoney(product.priceCents, product.currency)}</div>
          <div className="mt-1 text-xs text-slate-500">Instant download after payment</div>
          <div className="mt-4">
            <AddToCart productId={product.id} />
          </div>
          {product.demoUrl && (
            <a href={product.demoUrl} target="_blank" rel="noreferrer" className="mt-3 block text-center text-sm text-indigo-600 hover:underline">
              Live preview ↗
            </a>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
          <dl className="space-y-2">
            <Row label="Seller">
              <Link href={`/store/${product.vendor.slug}`} className="text-indigo-600 hover:underline">
                {product.vendor.storeName}
              </Link>
            </Row>
            <Row label="Category">{product.category.name}</Row>
            {product.version && <Row label="Version">{product.version}</Row>}
            <Row label="Published">{formatDate(product.publishedAt)}</Row>
            <Row label="Sales">{product.salesCount}</Row>
          </dl>
        </div>

        {product.files.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-2 font-semibold">Included files</h2>
            <ul className="space-y-1">
              {product.files.map((f) => (
                <li key={f.id} className="flex justify-between gap-2 text-xs">
                  <span className="truncate">{f.fileName}</span>
                  <span className="shrink-0 text-slate-500">{formatBytes(f.sizeBytes)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
