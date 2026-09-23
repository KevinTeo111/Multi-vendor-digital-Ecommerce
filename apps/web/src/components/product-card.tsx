import Link from 'next/link';
import { formatMoney } from '@/lib/format';
import type { ProductCard as ProductCardData } from '@/lib/types';

export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="aspect-[4/3] w-full bg-slate-100 dark:bg-slate-800">
        {product.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">No preview</div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold group-hover:underline">{product.title}</h3>
        <p className="text-xs text-slate-500">
          by {product.vendor.storeName} · {product.category.name}
        </p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-base font-bold">{formatMoney(product.priceCents, product.currency)}</span>
          <span className="text-xs text-slate-500">{product.salesCount} sales</span>
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
