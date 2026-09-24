'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/components/auth-provider';
import { api } from './api';
import type { Cart } from './types';

interface CartState {
  count: number;
  refresh: () => Promise<void>;
  setCount: (n: number) => void;
}

const CartContext = createContext<CartState | null>(null);

/** Keeps the header's cart badge in sync without each page refetching the cart. */
export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    try {
      const cart = await api<Cart>('/cart');
      setCount(cart.items.length);
    } catch {
      /* ignore: badge is a convenience */
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ count, refresh, setCount }), [count, refresh]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
