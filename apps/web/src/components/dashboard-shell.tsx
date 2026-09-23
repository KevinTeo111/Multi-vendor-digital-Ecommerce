'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useAuth } from './auth-provider';
import { CloseIcon, HomeIcon, LogoutIcon, MenuIcon, NAV_ICONS, type NavIconName } from './icons';
import { Logo } from './logo';

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
}

export function DashboardShell({ title, nav, children }: { title: string; nav: NavItem[]; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => (href === nav[0].href ? pathname === href : pathname.startsWith(href));
  const firstName = user?.name.split(' ')[0] ?? '';

  const sidebar = (
    <nav className="flex flex-1 flex-col gap-1">
      {nav.map((item) => {
        const Icon = NAV_ICONS[item.icon];
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active ? 'bg-brand-gradient text-white shadow-glow' : 'text-slate-400 hover:bg-navy-800 hover:text-white'
            }`}
          >
            <Icon size={18} />
            {item.label}
          </Link>
        );
      })}
      <div className="mt-auto space-y-1 border-t border-navy-800 pt-3">
        <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:bg-navy-800 hover:text-white">
          <HomeIcon size={18} /> Back to marketplace
        </Link>
        <button onClick={() => logout().then(() => router.push('/'))} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 hover:bg-navy-800 hover:text-white">
          <LogoutIcon size={18} /> Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-navy-900 p-4 text-white lg:flex">
        <div className="mb-8 px-1">
          <Logo />
        </div>
        <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</div>
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="flex w-72 flex-col bg-navy-900 p-4 text-white">
            <div className="mb-6 flex items-center justify-between">
              <Logo />
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:text-white" aria-label="Close menu">
                <CloseIcon />
              </button>
            </div>
            {sidebar}
          </div>
          <button className="flex-1 bg-navy-950/60" onClick={() => setOpen(false)} aria-label="Close menu" />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur sm:px-6">
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <MenuIcon />
          </button>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">Welcome back, {firstName}!</div>
            <div className="text-xs text-slate-500">{title}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 sm:inline">{user?.role === 'ADMIN' ? 'Administrator' : user?.vendor?.storeName ?? user?.email}</span>
            <span className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white">
              {user?.name
                .split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </span>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
