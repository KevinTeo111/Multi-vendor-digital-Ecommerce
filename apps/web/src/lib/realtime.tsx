'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '@/components/auth-provider';
import { useToast } from '@/components/toasts';
import { useT } from '@/i18n/client';
import { getTokens } from './api';
import { formatMoney } from './format';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

export type RealtimeEvent =
  | 'product.status'
  | 'product.submitted'
  | 'withdrawal.status'
  | 'withdrawal.requested'
  | 'sale.new'
  | 'subscription.status'
  | 'order.paid';
type Handler = (payload: Record<string, unknown>) => void;

interface RealtimeState {
  connected: boolean;
  subscribe: (event: RealtimeEvent, handler: Handler) => () => void;
}

const RealtimeContext = createContext<RealtimeState | null>(null);

/**
 * One Socket.IO connection per signed-in session. Domain events are forwarded to page-level
 * subscribers (so lists refresh in place) and turned into toasts with links.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const t = useT();
  const socketRef = useRef<Socket | null>(null);
  const handlers = useRef<Map<RealtimeEvent, Set<Handler>>>(new Map());
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      return;
    }

    const socket = io(`${API_BASE}/realtime`, {
      auth: (cb) => cb({ token: getTokens().accessToken }),
      transports: ['websocket', 'polling'],
      reconnectionDelayMax: 10_000,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    const dispatch = (event: RealtimeEvent) => (payload: Record<string, unknown>) => {
      handlers.current.get(event)?.forEach((h) => h(payload));
    };
    const events: RealtimeEvent[] = [
      'product.status',
      'product.submitted',
      'withdrawal.status',
      'withdrawal.requested',
      'sale.new',
      'subscription.status',
      'order.paid',
    ];
    for (const ev of events) socket.on(ev, dispatch(ev));

    // Toasts (in addition to page-level handlers)
    socket.on('product.status', (p: { title: string; status: string; reason?: string | null }) => {
      const map: Record<string, { key: string; tone: 'success' | 'error' | 'info' }> = {
        APPROVED: { key: 'toast.productApproved', tone: 'success' },
        REJECTED: { key: 'toast.productRejected', tone: 'error' },
        BLOCKED: { key: 'toast.productBlocked', tone: 'error' },
        DRAFT: { key: 'toast.productUnblocked', tone: 'info' },
      };
      const entry =
        map[p.status] ??
        (p.status === 'APPROVED'
          ? map.APPROVED
          : { key: 'toast.productUnblocked', tone: 'info' as const });
      toast.push(t(entry.key, { title: p.title, reason: p.reason ?? '' }), {
        tone: entry.tone,
        action: { label: t('dashboard.navProducts'), href: '/vendor/products' },
      });
    });
    socket.on(
      'withdrawal.status',
      (p: { status: string; amountCents: number; reason?: string | null }) => {
        const amount = formatMoney(p.amountCents);
        const map: Record<string, { key: string; tone: 'success' | 'error' | 'info' }> = {
          APPROVED: { key: 'toast.withdrawalApproved', tone: 'success' },
          PAID: { key: 'toast.withdrawalPaid', tone: 'success' },
          REJECTED: { key: 'toast.withdrawalRejected', tone: 'error' },
          FAILED: { key: 'toast.withdrawalFailed', tone: 'error' },
        };
        const entry = map[p.status];
        if (entry)
          toast.push(t(entry.key, { amount, reason: p.reason ?? '' }), {
            tone: entry.tone,
            action: { label: t('dashboard.navEarnings'), href: '/vendor/finance' },
          });
      },
    );
    socket.on('sale.new', (p: { productTitle: string; vendorNetCents: number }) => {
      toast.push(
        t('toast.newSale', { title: p.productTitle, amount: formatMoney(p.vendorNetCents) }),
        { tone: 'success', action: { label: t('dashboard.navOrders'), href: '/vendor/sales' } },
      );
    });
    socket.on('subscription.status', (p: { status: string }) => {
      const map: Record<string, { key: string; tone: 'success' | 'error' | 'info' }> = {
        ACTIVE: { key: 'toast.subscriptionActive', tone: 'success' },
        PAST_DUE: { key: 'toast.subscriptionPastDue', tone: 'error' },
        CANCELED: { key: 'toast.subscriptionCanceled', tone: 'info' },
      };
      const entry = map[p.status];
      if (entry)
        toast.push(t(entry.key), {
          tone: entry.tone,
          action: { label: t('dashboard.navPlan'), href: '/vendor/subscription' },
        });
    });
    socket.on('order.paid', (p: { orderId: string; orderNumber: string }) => {
      toast.push(t('toast.orderPaid', { number: p.orderNumber }), {
        tone: 'success',
        action: { label: t('nav.myDownloads'), href: '/library' },
      });
    });
    if (user.role === 'ADMIN') {
      socket.on('product.submitted', (p: { title: string }) => {
        toast.push(t('toast.newSubmission', { title: p.title }), {
          action: { label: t('dashboard.navProductReview'), href: '/admin/products' },
        });
      });
      socket.on('withdrawal.requested', (p: { amountCents: number }) => {
        toast.push(t('toast.newWithdrawalRequest', { amount: formatMoney(p.amountCents) }), {
          action: { label: t('dashboard.navWithdrawals'), href: '/admin/withdrawals' },
        });
      });
    }

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // The toast/t references are stable enough; reconnect only when the user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  const subscribe = (event: RealtimeEvent, handler: Handler) => {
    if (!handlers.current.has(event)) handlers.current.set(event, new Set());
    handlers.current.get(event)!.add(handler);
    return () => {
      handlers.current.get(event)?.delete(handler);
    };
  };

  return (
    <RealtimeContext.Provider value={{ connected, subscribe }}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used within RealtimeProvider');
  return ctx;
}

/** Subscribe a page to one event for its lifetime. The handler ref is refreshed on every render. */
export function useRealtimeEvent(event: RealtimeEvent, handler: Handler) {
  const { subscribe } = useRealtime();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => subscribe(event, (payload) => ref.current(payload)), [event, subscribe]);
}
