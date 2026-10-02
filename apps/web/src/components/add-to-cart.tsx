'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useT } from '@/i18n/client';
import { api, ApiError } from '@/lib/api';
import { useCart } from '@/lib/cart-store';
import { formatMoney } from '@/lib/format';
import type { LicenseType } from '@/lib/types';
import { useAuth } from './auth-provider';
import { CartIcon } from './icons';
import { useToast } from './toasts';
import { Alert, Button, LinkButton } from './ui';

/**
 * Adds the product and stays on the page: a toast confirms it and offers the cart,
 * so the buyer never loses their place in the catalog.
 */
export function AddToCart({
  productId,
  title,
  priceCents,
  extendedPriceCents,
  currency,
}: {
  productId: string;
  title: string;
  priceCents: number;
  extendedPriceCents: number | null;
  currency: string;
}) {
  const [license, setLicense] = useState<LicenseType>('REGULAR');
  const { user } = useAuth();
  const { setCount, refresh } = useCart();
  const toast = useToast();
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState<{ loading: boolean; error?: string; done?: boolean }>({
    loading: false,
  });

  const add = async () => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setState({ loading: true });
    try {
      const cart = await api<{ items: unknown[] }>('/cart/items', {
        method: 'POST',
        body: { productId, licenseType: license },
      });
      setCount(cart.items.length);
      setState({ loading: false, done: true });
      toast.push(t('toast.addedToCart', { title }), {
        tone: 'success',
        action: { label: t('product.viewCart'), href: '/cart' },
      });
    } catch (err) {
      setState({
        loading: false,
        error: err instanceof ApiError ? err.message : 'Could not add to cart',
      });
      void refresh();
    }
  };

  return (
    <div className="space-y-2">
      {extendedPriceCents !== null && (
        <fieldset className="space-y-2" aria-label={t('licence.label')}>
          {(
            [
              ['REGULAR', priceCents, t('licence.regular'), t('licence.regularHint')],
              ['EXTENDED', extendedPriceCents, t('licence.extended'), t('licence.extendedHint')],
            ] as const
          ).map(([value, cents, label, hint]) => (
            <label
              key={value}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${license === value ? 'border-brand-500 bg-brand-50/50' : 'border-slate-200 hover:border-brand-500/50'}`}
            >
              <input
                type="radio"
                name={`license-${productId}`}
                value={value}
                checked={license === value}
                onChange={() => {
                  setLicense(value);
                  setState({ loading: false });
                }}
                className="mt-1 accent-brand-500"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-navy-900">{label}</span>
                  <span className="font-bold text-navy-900">{formatMoney(cents, currency)}</span>
                </span>
                <span className="block text-xs text-slate-500">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {state.done ? (
        <LinkButton href="/cart" variant="secondary" className="w-full" arrow>
          {t('product.added')} · {t('product.viewCart')}
        </LinkButton>
      ) : (
        <Button onClick={add} loading={state.loading} className="w-full" size="lg">
          <CartIcon size={18} /> {t('product.addToCart')}
        </Button>
      )}
      {state.error && <Alert tone="error">{state.error}</Alert>}
    </div>
  );
}
