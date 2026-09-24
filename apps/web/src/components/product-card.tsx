'use client';

import Link from 'next/link';
import { useT } from '@/i18n/client';
import { formatMoney } from '@/lib/format';
import type { ProductCard as ProductCardData } from '@/lib/types';
import { ArrowRightIcon, DownloadIcon } from './icons';

const NEW_WINDOW_DAYS = 14;

export function ProductCard({ product }: { product: ProductCardData }) {
  const t = useT();
  const href = `/products/${product.slug}`;
  const badge =
    product.salesCount >= 10
      ? { label: t('product.bestseller'), className: 'bg-amber-400 text-navy-900' }
      : product.publishedAt && Date.now() - new Date(product.publishedAt).getTime() < NEW_WINDOW_DAYS * 86_400_000
        ? { label: t('product.newBadge'), className: 'bg-emerald-500 text-white' }
        : null;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-500/10">
      <Link href={href} className="relative block aspect-[4/3] w-full overflow-hidden bg-navy-900" aria-label={product.title}>
        {product.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.thumbnailUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="bg-hero flex h-full flex-col items-center justify-center gap-1 text-slate-400">
            <span className="text-brand-gradient-light text-lg font-bold">{product.category.name}</span>
            <span className="text-xs">{t('product.noPreviewYet')}</span>
          </div>
        )}
        {badge && <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.className}`}>{badge.label}</span>}
      </Link>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <Link href={href} className="line-clamp-2 text-sm font-semibold text-navy-900 hover:text-brand-600">
          {product.title}
        </Link>
        <p className="text-xs text-slate-500">
          {t('product.by')}{' '}
          <Link href={`/store/${product.vendor.slug}`} className="font-medium text-slate-600 hover:text-brand-600">
            {product.vendor.storeName}
          </Link>
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
          <DownloadIcon size={14} className="text-brand-500" />
          {t(product.salesCount === 1 ? 'common.sale' : 'common.sales', { count: product.salesCount })}
          <span className="mx-1 text-slate-300">·</span>
          {product.category.name}
        </p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-lg font-bold text-navy-900">{product.priceCents === 0 ? t('common.free') : formatMoney(product.priceCents, product.currency)}</span>
          <Link href={href} className="arrow-nudge flex h-9 w-9 items-center justify-center rounded-full border border-brand-500 text-brand-600 transition group-hover:bg-brand-500 group-hover:text-white" aria-label={product.title}>
            <ArrowRightIcon size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
