import type { ReactNode } from 'react';

/** One label/value line inside a <dl>. Server-safe (no hooks), used by storefront and dashboard pages. */
export function DefinitionRow({
  label,
  children,
  align = 'right',
}: {
  label: string;
  children: ReactNode;
  align?: 'right' | 'left';
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className={`min-w-0 text-navy-900 ${align === 'right' ? 'text-right' : ''}`}>
        {children}
      </dd>
    </div>
  );
}
