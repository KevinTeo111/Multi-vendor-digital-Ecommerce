'use client';

import Link from 'next/link';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckIcon, CloseIcon } from './icons';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
  action?: { label: string; href: string };
}

interface ToastState {
  push: (message: string, options?: { tone?: Toast['tone']; action?: Toast['action']; durationMs?: number }) => void;
}

const ToastContext = createContext<ToastState | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback<ToastState['push']>(
    (message, options) => {
      const id = ++counter.current;
      setToasts((list) => [...list.slice(-4), { id, message, tone: options?.tone ?? 'info', action: options?.action }]);
      window.setTimeout(() => dismiss(id), options?.durationMs ?? 6000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border bg-white p-4 text-sm shadow-xl ${
              t.tone === 'error' ? 'border-rose-200' : t.tone === 'success' ? 'border-emerald-200' : 'border-slate-200'
            }`}
          >
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${t.tone === 'error' ? 'bg-rose-100 text-rose-600' : t.tone === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-brand-50 text-brand-600'}`}>
              {t.tone === 'error' ? '!' : <CheckIcon size={14} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-slate-800">{t.message}</p>
              {t.action && (
                <Link href={t.action.href} onClick={() => dismiss(t.id)} className="mt-1 inline-block font-semibold text-brand-600 hover:underline">
                  {t.action.label} →
                </Link>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-700" aria-label="Close">
              <CloseIcon size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
