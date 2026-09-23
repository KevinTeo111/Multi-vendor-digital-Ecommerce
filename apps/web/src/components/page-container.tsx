import type { ReactNode } from 'react';

/** Standard content width for storefront pages. */
export function PageContainer({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 ${className}`}>{children}</div>;
}
