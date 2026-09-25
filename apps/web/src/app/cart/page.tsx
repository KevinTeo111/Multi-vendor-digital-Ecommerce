'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowRightIcon } from '@/components/icons';
import { PageContainer } from '@/components/page-container';
import { RequireRole } from '@/components/require-role';
import { Alert, Button, Card, EmptyState, LinkButton, Loading, PageHeader } from '@/components/ui';
import { useT } from '@/i18n/client';
import { api, ApiError } from '@/lib/api';
import { useCart } from '@/lib/cart-store';
import { formatMoney } from '@/lib/format';
import type { Cart, Order } from '@/lib/types';

function CartView() {
  const router = useRouter();
  const t = useT();
  const { setCount } = useCart();
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Card padded={false}>
            <ul className="divide-y divide-slate-100">
              {cart.items.map((item) => (
                <li key={item.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100">
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
                    </span>
                  </div>
                  <span className="font-semibold text-navy-900">
                    {formatMoney(item.product.priceCents, item.product.currency)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(item.productId)}
                    aria-label={`${t('common.remove')} ${item.product.title}`}
                  >
                    {t('common.remove')}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
          <Card title={t('cart.summary')}>
            <div className="flex justify-between text-sm">
              <span>{t('cart.subtotal')}</span>
              <span className="font-semibold">{formatMoney(cart.subtotalCents)}</span>
            </div>
            <Button className="mt-4 w-full" size="lg" onClick={checkout} loading={busy} arrow>
              {t('cart.pay', { amount: formatMoney(cart.subtotalCents) })}
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
