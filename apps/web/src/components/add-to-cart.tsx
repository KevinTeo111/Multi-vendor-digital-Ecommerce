'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useT } from '@/i18n/client';
import { api, ApiError } from '@/lib/api';
import { useCart } from '@/lib/cart-store';
import { useAuth } from './auth-provider';
import { CartIcon } from './icons';
import { useToast } from './toasts';
import { Alert, Button, LinkButton } from './ui';

/**
 * Adds the product and stays on the page: a toast confirms it and offers the cart,
 * so the buyer never loses their place in the catalog.
 */
export function AddToCart({ productId, title }: { productId: string; title: string }) {
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
        body: { productId },
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
