'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export interface NavItem {
  href: string;
  label: string;
}

export function DashboardShell({ title, nav, children }: { title: string; nav: NavItem[]; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="grid gap-6 md:grid-cols-[200px_1fr]">
      <aside>
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {nav.map((item) => {
            const active = item.href === pathname || (item.href !== nav[0].href && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm ${
                  active ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
