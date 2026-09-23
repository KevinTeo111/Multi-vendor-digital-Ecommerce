'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from './auth-provider';
import { Alert, Button } from './ui';

export function AddToCart({ productId }: { productId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<{ loading: boolean; error?: string; done?: boolean }>({ loading: false });

  const add = async () => {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setState({ loading: true });
    try {
      await api('/cart/items', { method: 'POST', body: { productId } });
      setState({ loading: false, done: true });
    } catch (err) {
      setState({ loading: false, error: err instanceof ApiError ? err.message : 'Could not add to cart' });
    }
  };

  return (
    <div className="space-y-2">
      {state.done ? (
        <Button variant="secondary" onClick={() => router.push('/cart')} className="w-full">
          Added · View cart
        </Button>
      ) : (
        <Button onClick={add} loading={state.loading} className="w-full">
          Add to cart
        </Button>
      )}
      {state.error && <Alert tone="error">{state.error}</Alert>}
    </div>
  );
}
