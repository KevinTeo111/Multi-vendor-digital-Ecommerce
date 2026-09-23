'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { RequireRole } from '@/components/require-role';
import { Alert, Button, Card, EmptyState, LinkButton, Loading, PageHeader } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { Cart, Order } from '@/lib/types';

function CartView() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => api<Cart>('/cart').then(setCart).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const remove = async (productId: string) => {
    setCart(await api<Cart>(`/cart/items/${productId}`, { method: 'DELETE' }));
  };

  const checkout = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ order: Order; checkoutUrl: string | null }>('/checkout', { method: 'POST' });
      if (res.checkoutUrl) window.location.href = res.checkoutUrl;
      else router.push(`/orders/${res.order.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Checkout failed');
      setBusy(false);
    }
  };

  if (!cart) return error ? <Alert tone="error">{error}</Alert> : <Loading />;

  return (
    <div>
      <PageHeader title="Your cart" />
      {cart.removedUnavailable > 0 && <Alert tone="warning">Some items were removed because they are no longer available.</Alert>}
      {error && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
      {cart.items.length === 0 ? (
        <EmptyState title="Your cart is empty" action={<LinkButton href="/products">Browse products</LinkButton>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <Card>
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {cart.items.map((item) => (
                <li key={item.id} className="flex items-center gap-4 py-3">
                  <div className="h-14 w-20 shrink-0 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                    {item.product.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.product.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/products/${item.product.slug}`} className="block truncate font-medium hover:underline">
                      {item.product.title}
                    </Link>
                    <span className="text-xs text-slate-500">by {item.product.vendor.storeName}</span>
                  </div>
                  <span className="font-semibold">{formatMoney(item.product.priceCents, item.product.currency)}</span>
                  <Button variant="ghost" size="sm" onClick={() => remove(item.productId)} aria-label={`Remove ${item.product.title}`}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Summary">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span className="font-semibold">{formatMoney(cart.subtotalCents)}</span>
            </div>
            <Button className="mt-4 w-full" onClick={checkout} loading={busy}>
              Pay {formatMoney(cart.subtotalCents)}
            </Button>
            <p className="mt-2 text-xs text-slate-500">Files are available for download right after the payment is confirmed.</p>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function CartPage() {
  return (
    <RequireRole roles={['BUYER', 'VENDOR', 'ADMIN']}>
      <CartView />
    </RequireRole>
  );
}
