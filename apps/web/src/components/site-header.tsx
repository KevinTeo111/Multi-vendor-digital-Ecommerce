'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useT } from '@/i18n/client';
import { useCart } from '@/lib/cart-store';
import { initials } from '@/lib/utils';
import { useAuth } from './auth-provider';
import { ArrowRightIcon, CartIcon, CloseIcon, LogoutIcon, MenuIcon, SearchIcon } from './icons';
import { LanguageToggle } from './language-toggle';
import { Logo } from './logo';

export function SiteHeader() {
  const { user, logout, loading } = useAuth();
  const { count } = useCart();
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    setDrawer(false);
    setSearchOpen(false);
  }, [pathname]);

  if (pathname.startsWith('/vendor') || pathname.startsWith('/admin')) return null;

  const NAV = [
    { href: '/', label: t('nav.home') },
    { href: '/products', label: t('nav.browse') },
    { href: '/plans', label: t('nav.sell') },
    ...(user ? [{ href: '/orders', label: t('nav.orders') }] : []),
  ];
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const search = (e: FormEvent) => {
    e.preventDefault();
    router.push(`/products${q ? `?search=${encodeURIComponent(q)}` : ''}`);
    setSearchOpen(false);
  };

  const dashboardHref =
    user?.role === 'ADMIN' ? '/admin' : user?.role === 'VENDOR' ? '/vendor' : '/library';
  const dashboardLabel =
    user?.role === 'ADMIN'
      ? t('nav.adminPanel')
      : user?.role === 'VENDOR'
        ? t('nav.sellerDashboard')
        : t('nav.myDownloads');
  const avatar = initials(user?.name);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-slate-200/70">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Logo />

          {/* Floating pill navigation (kaho style) */}
          <nav
            className="mx-auto hidden items-center rounded-full bg-white p-1 shadow-pill ring-1 ring-slate-200/70 lg:flex"
            aria-label="Main"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${isActive(item.href) ? 'bg-brand-500 text-white shadow' : 'text-navy-900 hover:text-brand-600'}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right cluster: square blue action buttons */}
          <div className="ml-auto flex items-center overflow-hidden rounded-xl bg-brand-500 text-white shadow-glow">
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className="flex h-11 w-11 items-center justify-center hover:bg-brand-600"
              aria-label={t('common.search')}
              aria-expanded={searchOpen}
            >
              <SearchIcon size={20} />
            </button>
            {!loading && user && (
              <Link
                href="/cart"
                className="relative flex h-11 w-11 items-center justify-center border-l border-white/15 hover:bg-brand-600"
                aria-label={t('nav.cart')}
              >
                <CartIcon size={20} />
                {count > 0 && (
                  <span className="absolute right-1.5 top-1.5 min-w-[18px] rounded-full bg-white px-1 text-center text-[10px] font-bold leading-[18px] text-brand-600">
                    {count}
                  </span>
                )}
              </Link>
            )}
            {!loading && user ? (
              <Link
                href={dashboardHref}
                className="hidden h-11 items-center gap-2 border-l border-white/15 px-3 text-sm font-semibold hover:bg-brand-600 md:flex"
                title={dashboardLabel}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                  {avatar}
                </span>
                <span className="max-w-[140px] truncate">{dashboardLabel}</span>
              </Link>
            ) : (
              !loading && (
                <Link
                  href="/login"
                  className="hidden h-11 items-center border-l border-white/15 px-4 text-sm font-semibold hover:bg-brand-600 md:flex"
                >
                  {t('common.signIn')}
                </Link>
              )
            )}
            <button
              onClick={() => setDrawer(true)}
              className="flex h-11 w-11 items-center justify-center border-l border-white/15 hover:bg-brand-600"
              aria-label={t('nav.menu')}
              aria-expanded={drawer}
            >
              <MenuIcon size={22} />
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="border-t border-slate-200/70 bg-white">
            <form
              onSubmit={search}
              className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:px-6"
            >
              <label className="relative flex-1">
                <SearchIcon
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t('home.searchPlaceholder')}
                  aria-label={t('common.search')}
                  className="h-11 w-full rounded-full border border-slate-200 bg-surface pl-11 pr-4 text-sm text-navy-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </label>
              <button
                type="submit"
                className="bg-brand-gradient flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white"
              >
                {t('common.search')} <ArrowRightIcon size={16} />
              </button>
            </form>
          </div>
        )}
      </header>

      {/* Slide-in side drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            className="flex-1 bg-navy-950/50 backdrop-blur-sm"
            onClick={() => setDrawer(false)}
            aria-label={t('common.close')}
          />
          <aside className="animate-slide-in-right flex h-full w-[min(88vw,360px)] flex-col bg-navy-900 p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between">
              <Logo light />
              <button
                onClick={() => setDrawer(false)}
                className="rounded-full p-2 text-slate-300 hover:bg-white/10 hover:text-white"
                aria-label={t('common.close')}
              >
                <CloseIcon size={20} />
              </button>
            </div>

            <nav className="mt-8 flex flex-col">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center justify-between border-b border-white/10 py-4 text-lg font-semibold hover:text-cyan-400"
                >
                  {item.label}
                  <ArrowRightIcon size={18} className="arrow-nudge text-brand-500" />
                </Link>
              ))}
              {user && (
                <Link
                  href={dashboardHref}
                  className="group flex items-center justify-between border-b border-white/10 py-4 text-lg font-semibold hover:text-cyan-400"
                >
                  {dashboardLabel}
                  <ArrowRightIcon size={18} className="arrow-nudge text-brand-500" />
                </Link>
              )}
            </nav>

            <div className="mt-6 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t('nav.language')}
              </span>
              <LanguageToggle dark />
            </div>

            <div className="mt-auto space-y-3 pt-6">
              {user ? (
                <>
                  <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
                    <span className="bg-brand-gradient flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold">
                      {avatar}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{user.name}</div>
                      <div className="truncate text-xs text-slate-400">{user.email}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => logout().then(() => router.push('/'))}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 py-2.5 text-sm font-semibold hover:bg-white/10"
                  >
                    <LogoutIcon size={16} /> {t('common.signOut')}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/register?role=VENDOR"
                    className="bg-brand-gradient flex items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold shadow-glow"
                  >
                    {t('nav.startSelling')} <ArrowRightIcon size={16} />
                  </Link>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/login"
                      className="rounded-full border border-white/20 py-2.5 text-center text-sm font-semibold hover:bg-white/10"
                    >
                      {t('common.signIn')}
                    </Link>
                    <Link
                      href="/register"
                      className="rounded-full border border-white/20 py-2.5 text-center text-sm font-semibold hover:bg-white/10"
                    >
                      {t('common.signUp')}
                    </Link>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
