'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowRightIcon } from '@/components/icons';
import { PageContainer } from '@/components/page-container';
import { RequireRole } from '@/components/require-role';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Input,
  LinkButton,
  Loading,
  PageHeader,
} from '@/components/ui';
import { useT } from '@/i18n/client';
import { api, ApiError } from '@/lib/api';
import { useCart } from '@/lib/cart-store';
import { formatMoney } from '@/lib/format';
import type { Cart, CheckoutPreview, Order } from '@/lib/types';

function CartView() {
  const router = useRouter();
  const t = useT();
  const { setCount } = useCart();
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  /** Asks the API what the cart costs with this code; the same rules run again at checkout. */
  const quote = async (code: string) => {
    setApplying(true);
    setCouponError(null);
    try {
      const res = await api<CheckoutPreview>('/checkout/preview', {
        method: 'POST',
        body: { couponCode: code },
      });
      setPreview(res);
    } catch (err) {
      setPreview(null);
      setCouponError(err instanceof ApiError ? err.message : t('cart.checkoutFailed'));
    } finally {
      setApplying(false);
    }
  };

  useEffect(() => {
    api<Cart>('/cart')
      .then((c) => {
        setCart(c);
        setCount(c.items.length);
      })
      .catch((e) => setError(e.message));
  }, [setCount]);

  const remove = async (productId: string) => {
    const next = await api<Cart>(`/cart/items/${productId}`, { method: 'DELETE' });
    setCart(next);
    setCount(next.items.length);
    // The discount depends on the cart: quote again, or drop the coupon if the cart is empty.
    if (preview?.couponCode && next.items.length) void quote(preview.couponCode);
    else setPreview(null);
  };

  /** Browser history restores the previous page and its scroll position; fall back to the catalog. */
  const continueShopping = () => {
    if (
      window.history.length > 1 &&
      document.referrer &&
      new URL(document.referrer).origin === window.location.origin
    )
      router.back();
    else router.push('/products');
  };

  const checkout = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ order: Order; checkoutUrl: string | null }>('/checkout', {
        method: 'POST',
        body: { couponCode: preview?.couponCode ?? undefined },
      });
      setCount(0);
      if (res.checkoutUrl) window.location.href = res.checkoutUrl;
      else router.push(`/orders/${res.order.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('cart.checkoutFailed'));
      setBusy(false);
    }
  };

  if (!cart) return error ? <Alert tone="error">{error}</Alert> : <Loading />;

  return (
    <div>
      <PageHeader
        title={t('cart.title')}
        description={cart.items.length ? t('cart.items', { count: cart.items.length }) : undefined}
        actions={
          <button
            onClick={continueShopping}
            className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-navy-900 shadow-sm hover:border-brand-500 hover:text-brand-600"
          >
            <ArrowRightIcon size={16} className="rotate-180" /> {t('cart.continueShopping')}
          </button>
        }
      />
      {cart.removedUnavailable > 0 && <Alert tone="warning">{t('cart.removedUnavailable')}</Alert>}
      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {cart.items.length === 0 ? (
        <EmptyState
          title={t('cart.empty')}
          action={
            <LinkButton href="/products" arrow>
              {t('cart.browse')}
            </LinkButton>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card padded={false}>
            <ul className="divide-y divide-slate-100">
              {cart.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5">
                  <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:h-14 sm:w-20">
                    {item.product.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.product.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/products/${item.product.slug}`}
                      className="block truncate font-medium text-navy-900 hover:text-brand-600"
                    >
                      {item.product.title}
                    </Link>
                    <span className="text-xs text-slate-500">
                      {t('product.by')} {item.product.vendor.storeName}
                      {' · '}
                      {item.licenseType === 'EXTENDED'
                        ? t('licence.extended')
                        : t('licence.regular')}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-4">
                    <span className="font-semibold text-navy-900">
                      {formatMoney(item.unitPriceCents, item.product.currency)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(item.productId)}
                      aria-label={`${t('common.remove')} ${item.product.title}`}
                    >
                      {t('common.remove')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card title={t('cart.summary')}>
            <div className="flex justify-between text-sm">
              <span>{t('cart.subtotal')}</span>
              <span className="font-semibold">{formatMoney(cart.subtotalCents)}</span>
            </div>
            {preview?.couponCode && (
              <>
                <div className="mt-2 flex justify-between text-sm text-emerald-700">
                  <span>{t('coupon.discount', { code: preview.couponCode })}</span>
                  <span className="font-semibold">− {formatMoney(preview.discountCents)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-sm">
                  <span>{t('coupon.total')}</span>
                  <span className="font-bold text-navy-900">{formatMoney(preview.totalCents)}</span>
                </div>
              </>
            )}
            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (couponInput.trim()) void quote(couponInput.trim());
              }}
            >
              <Input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder={t('coupon.cartLabel')}
                aria-label={t('coupon.cartLabel')}
                className="uppercase"
                maxLength={30}
              />
              {preview?.couponCode ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setPreview(null);
                    setCouponInput('');
                  }}
                >
                  {t('coupon.remove')}
                </Button>
              ) : (
                <Button type="submit" variant="secondary" loading={applying}>
                  {t('coupon.apply')}
                </Button>
              )}
            </form>
            {couponError && (
              <div className="mt-2">
                <Alert tone="error">{couponError}</Alert>
              </div>
            )}
            <Button className="mt-4 w-full" size="lg" onClick={checkout} loading={busy} arrow>
              {t('cart.pay', { amount: formatMoney(preview?.totalCents ?? cart.subtotalCents) })}
            </Button>
            <p className="mt-2 text-xs text-slate-500">{t('cart.note')}</p>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function CartPage() {
  return (
    <RequireRole roles={['BUYER', 'VENDOR', 'ADMIN']}>
      <PageContainer>
        <CartView />
      </PageContainer>
    </RequireRole>
  );
}
