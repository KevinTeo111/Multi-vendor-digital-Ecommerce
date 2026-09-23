'use client';

import Link from 'next/link';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { statusLabel } from '@/lib/format';

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'dark';

const variantClass: Record<Variant, string> = {
  primary: 'bg-brand-gradient text-white shadow-glow hover:brightness-110 disabled:opacity-60 disabled:shadow-none',
  secondary: 'border border-slate-200 bg-white text-slate-800 shadow-sm hover:border-brand-500 hover:text-brand-600',
  danger: 'bg-rose-600 text-white hover:bg-rose-500 disabled:bg-rose-300',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  dark: 'bg-navy-900 text-white hover:bg-navy-800',
};

const sizeClass = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof sizeClass; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:cursor-not-allowed',
        sizeClass[size],
        variantClass[variant],
        className,
      )}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: keyof typeof sizeClass;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cx('inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition', sizeClass[size], variantClass[variant], className)}
    >
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------

const controlClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-slate-500">{hint}</span>}
      {error && <span className="block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(controlClass, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(controlClass, 'min-h-[120px]', props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(controlClass, 'cursor-pointer', props.className)} />;
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

export function Card({ title, subtitle, actions, children, className, padded = true }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cx('rounded-2xl border border-slate-200/80 bg-white shadow-card', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, icon, trend }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode; trend?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card">
      <div className="flex items-start justify-between">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        {icon && <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icon}</div>}
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
      {(hint || trend) && (
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
          {trend}
          {hint}
        </div>
      )}
    </div>
  );
}

const badgeTone: Record<string, string> = {
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  PAID: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  AVAILABLE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  PENDING_REVIEW: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  REQUESTED: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  PAST_DUE: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  REJECTED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  BLOCKED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  FAILED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  SUSPENDED: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  CANCELED: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  DRAFT: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  UNPUBLISHED: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

export function Badge({ status, children }: { status: string; children?: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', badgeTone[status] ?? 'bg-brand-50 text-brand-700 ring-brand-500/20')}>
      {children ?? statusLabel(status)}
    </span>
  );
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success' | 'warning'; children: ReactNode }) {
  const tones = {
    info: 'border-sky-200 bg-sky-50 text-sky-900',
    error: 'border-rose-200 bg-rose-50 text-rose-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  };
  return <div className={cx('rounded-xl border px-4 py-3 text-sm', tones[tone])}>{children}</div>;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('animate-spin', className ?? 'h-5 w-5')} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-slate-500" role="status">
      <Spinner className="h-4 w-4" /> {label}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <tr>
            {headers.map((h, i) => (
              <th key={`${h}-${i}`} className="px-5 py-2.5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx('px-5 py-3 align-middle', className)}>{children}</td>;
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </Button>
      <span className="text-slate-500">
        Page {page} of {totalPages}
      </span>
      <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>
        Next
      </Button>
    </nav>
  );
}

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SectionHeading({ icon, title, subtitle, actions }: { icon?: ReactNode; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-500">{icon}</span>}
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions}
    </div>
  );
}
