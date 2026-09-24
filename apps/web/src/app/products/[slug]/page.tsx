// Allow a sleeping free-tier API up to a minute to wake up before this page gives up.
export const maxDuration = 60;

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AddToCart } from '@/components/add-to-cart';
import { BadgeCheckIcon, CheckIcon, DownloadIcon, ShieldIcon, StoreIcon } from '@/components/icons';
import { PageContainer } from '@/components/page-container';
import { getT } from '@/i18n/server';
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
  const { t, locale } = await getT();
  const product = await serverApi<ProductDetail>(`/products/${slug}`);
  if (!product) notFound();

  const previews = [product.thumbnailUrl, ...product.previewImageUrls].filter((u): u is string => Boolean(u));
  const totalBytes = product.files.reduce((s, f) => s + f.sizeBytes, 0);

  return (
    <PageContainer>
      <nav className="mb-5 text-xs text-slate-500">
        <Link href="/" className="hover:text-brand-600">{t('nav.home')}</Link> <span className="mx-1">/</span>
        <Link href={`/products?category=${product.category.slug}`} className="hover:text-brand-600">{product.category.name}</Link> <span className="mx-1">/</span>
        <span className="text-slate-700">{product.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-navy-900 shadow-card">
            {previews[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previews[0]} alt={product.title} className="aspect-[4/3] w-full object-cover" />
            ) : (
              <div className="bg-hero flex aspect-[4/3] items-center justify-center text-slate-400">{t('product.noPreview')}</div>
            )}
          </div>
          {previews.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-5">
              {previews.slice(1).map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt="" className="aspect-[4/3] w-full rounded-xl border border-slate-200 object-cover" />
              ))}
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card">
            <h2 className="mb-3 text-base font-semibold text-navy-900">{t('product.description')}</h2>
            <article className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{product.description}</article>
            {product.tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {product.tags.map((tag) => (
                  <Link key={tag} href={`/products?search=${encodeURIComponent(tag)}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-brand-50 hover:text-brand-700">
                    #{tag}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-card">
            <h1 className="text-2xl font-bold tracking-tight text-navy-900">{product.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {t('product.by')}{' '}
              <Link href={`/store/${product.vendor.slug}`} className="font-medium text-brand-600 hover:underline">
                {product.vendor.storeName}
              </Link>
            </p>
            <p className="mt-3 text-sm text-slate-600">{product.shortDescription}</p>

            <div className="mt-5 flex items-baseline gap-3">
              <span className="text-3xl font-extrabold text-navy-900">{product.priceCents === 0 ? t('common.free') : formatMoney(product.priceCents, product.currency)}</span>
              {product.salesCount > 0 && <span className="text-sm text-slate-500">{t(product.salesCount === 1 ? 'common.sale' : 'common.sales', { count: product.salesCount })}</span>}
            </div>

            <ul className="mt-5 space-y-2 text-sm text-slate-700">
              <Feature>{t('product.instantDownload')}</Feature>
              <Feature>{t('product.lifetimeAccess')}</Feature>
              {product.files.length > 0 && <Feature>{t(product.files.length === 1 ? 'product.files' : 'product.filesPlural', { count: product.files.length, size: formatBytes(totalBytes) })}</Feature>}
              {product.version && <Feature>{t('product.version', { version: product.version })}</Feature>}
            </ul>

            <div className="mt-6 space-y-2">
              <AddToCart productId={product.id} title={product.title} />
              {product.demoUrl && (
                <a href={product.demoUrl} target="_blank" rel="noreferrer" className="flex h-11 w-full items-center justify-center rounded-full border border-slate-200 text-sm font-semibold text-slate-700 hover:border-brand-500 hover:text-brand-600">
                  {t('product.livePreview')} ↗
                </a>
              )}
            </div>

            <div className="mt-5 flex items-center gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <span className="flex items-center gap-1"><ShieldIcon size={14} className="text-brand-500" /> {t('product.securePayment')}</span>
              <span className="flex items-center gap-1"><DownloadIcon size={14} className="text-brand-500" /> {t('product.protectedDownload')}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('product.sellerInfo')}</h2>
            <div className="flex items-center gap-3">
              {product.vendor.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.vendor.logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                <span className="bg-brand-gradient flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white">{product.vendor.storeName[0]}</span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 font-semibold text-navy-900">
                  <span className="truncate">{product.vendor.storeName}</span>
                  <BadgeCheckIcon size={16} className="shrink-0 text-brand-500" />
                </div>
                <div className="text-xs text-slate-500">{t('product.approvedSeller')}</div>
              </div>
              <Link href={`/store/${product.vendor.slug}`} className="flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand-500 hover:text-brand-600">
                <StoreIcon size={14} /> {t('product.viewStore')}
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card text-sm">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('product.details')}</h2>
            <dl className="space-y-2">
              <Row label={t('product.category')}>{product.category.name}</Row>
              <Row label={t('product.published')}>{formatDate(product.publishedAt, false, locale)}</Row>
              {product.files.map((f) => (
                <Row key={f.id} label={f.isMain ? t('product.mainFile') : t('product.file')}>
                  <span className="truncate">{f.fileName}</span> <span className="text-slate-400">({formatBytes(f.sizeBytes)})</span>
                </Row>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <CheckIcon size={12} />
      </span>
      {children}
    </li>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 text-right text-slate-800">{children}</dd>
    </div>
  );
}
