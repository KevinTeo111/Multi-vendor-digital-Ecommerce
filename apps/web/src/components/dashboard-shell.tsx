'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useT } from '@/i18n/client';
import { useRealtime } from '@/lib/realtime';
import { initials } from '@/lib/utils';
import { useAuth } from './auth-provider';
import {
  ArrowRightIcon,
  CloseIcon,
  HomeIcon,
  LogoutIcon,
  MenuIcon,
  NAV_ICONS,
  type NavIconName,
} from './icons';
import { LanguageToggle } from './language-toggle';
import { Logo } from './logo';

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconName;
}

export function DashboardShell({
  title,
  nav,
  children,
}: {
  title: string;
  nav: NavItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();
  const { user, logout } = useAuth();
  const { connected } = useRealtime();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) =>
    href === nav[0].href ? pathname === href : pathname.startsWith(href);
  const firstName = user?.name.split(' ')[0] ?? '';
  const avatar = initials(user?.name);

  const sidebar = (
    <nav className="flex flex-1 flex-col gap-1">
      {nav.map((item) => {
        const Icon = NAV_ICONS[item.icon];
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold transition ${active ? 'bg-brand-500 text-white shadow-glow' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'}`}
          >
            <Icon size={18} />
            <span className="flex-1">{item.label}</span>
            {active && <ArrowRightIcon size={14} />}
          </Link>
        );
      })}
      <div className="mt-auto space-y-1 border-t border-slate-200 pt-3">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {t('nav.language')}
          </span>
          <LanguageToggle />
        </div>
        <Link
          href="/"
          className="flex items-center gap-3 rounded-full px-4 py-2.5 text-sm text-slate-600 hover:bg-brand-50 hover:text-brand-700"
        >
          <HomeIcon size={18} /> {t('nav.backToMarketplace')}
        </Link>
        <button
          onClick={() => logout().then(() => router.push('/'))}
          className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm text-slate-600 hover:bg-brand-50 hover:text-brand-700"
        >
          <LogoutIcon size={18} /> {t('common.signOut')}
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-1 bg-surface">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white p-4 lg:flex">
        <div className="mb-8 px-1">
          <Logo />
        </div>
        <div className="mb-2 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </div>
        {sidebar}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="animate-slide-in-right order-2 flex w-72 flex-col bg-white p-4 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <Logo />
              <button
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:text-navy-900"
                aria-label={t('common.close')}
              >
                <CloseIcon />
              </button>
            </div>
            {sidebar}
          </div>
          <button
            className="order-1 flex-1 bg-navy-950/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label={t('common.close')}
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/80 bg-white/85 px-4 py-3 backdrop-blur sm:px-6">
          <button
            className="rounded-full p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label={t('nav.menu')}
          >
            <MenuIcon />
          </button>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-navy-900">
              {t('dashboard.welcome', { name: firstName })}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {title}
              <span
                className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`}
                title={connected ? 'Live' : 'Offline'}
              />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 sm:inline">
              {user?.role === 'ADMIN'
                ? t('dashboard.administrator')
                : (user?.vendor?.storeName ?? user?.email)}
            </span>
            <span className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white">
              {avatar}
            </span>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
