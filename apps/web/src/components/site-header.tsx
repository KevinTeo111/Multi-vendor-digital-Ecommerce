'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from './auth-provider';
import { CartIcon, CloseIcon, LogoutIcon, MenuIcon, SearchIcon } from './icons';
import { Logo } from './logo';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/products', label: 'Browse' },
  { href: '/plans', label: 'Sell' },
];

export function SiteHeader() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  // Dashboards have their own chrome.
  if (pathname.startsWith('/vendor') || pathname.startsWith('/admin')) return null;

  const search = (e: FormEvent) => {
    e.preventDefault();
    router.push(`/products${q ? `?search=${encodeURIComponent(q)}` : ''}`);
    setOpen(false);
  };

  const dashboardHref = user?.role === 'ADMIN' ? '/admin' : user?.role === 'VENDOR' ? '/vendor' : '/library';
  const dashboardLabel = user?.role === 'ADMIN' ? 'Admin panel' : user?.role === 'VENDOR' ? 'Seller dashboard' : 'My downloads';
  const initials = user?.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-navy-900 text-white shadow-lg shadow-navy-950/30">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Logo />

        <form onSubmit={search} className="hidden flex-1 justify-center md:flex">
          <label className="relative w-full max-w-xl">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for digital products, creators, or categories…"
              aria-label="Search products"
              className="h-11 w-full rounded-full border border-navy-600 bg-navy-800 pl-11 pr-4 text-sm text-white placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </label>
        </form>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {!loading && user ? (
            <>
              <Link href="/cart" className="rounded-full p-2.5 text-slate-300 hover:bg-navy-800 hover:text-white" aria-label="Cart">
                <CartIcon />
              </Link>
              <Link href={dashboardHref} className="ml-1 flex items-center gap-2 rounded-full border border-navy-600 py-1 pl-1 pr-3 text-sm hover:bg-navy-800">
                <span className="bg-brand-gradient flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold">{initials}</span>
                <span className="max-w-[140px] truncate">{dashboardLabel}</span>
              </Link>
              <button onClick={() => logout().then(() => router.push('/'))} className="rounded-full p-2.5 text-slate-300 hover:bg-navy-800 hover:text-white" aria-label="Sign out" title="Sign out">
                <LogoutIcon />
              </button>
            </>
          ) : (
            !loading && (
              <>
                <Link href="/login" className="rounded-lg border border-navy-600 px-4 py-2 text-sm font-medium hover:bg-navy-800">
                  Sign In
                </Link>
                <Link href="/register" className="bg-brand-gradient rounded-lg px-4 py-2 text-sm font-semibold shadow-glow hover:brightness-110">
                  Sign Up
                </Link>
              </>
            )
          )}
        </div>

        <button className="ml-auto rounded-lg p-2 hover:bg-navy-800 md:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      <nav className="hidden border-t border-navy-800 md:block">
        <div className="mx-auto flex max-w-7xl gap-8 px-6 text-sm">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`border-b-2 py-3 font-medium transition ${active ? 'border-brand-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
              >
                {item.label}
              </Link>
            );
          })}
          {user && (
            <Link href="/orders" className={`border-b-2 py-3 font-medium ${pathname.startsWith('/orders') ? 'border-brand-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
              Orders
            </Link>
          )}
        </div>
      </nav>

      {open && (
        <div className="space-y-3 border-t border-navy-800 px-4 py-4 text-sm md:hidden">
          <form onSubmit={search} className="relative">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products…"
              className="h-11 w-full rounded-full border border-navy-600 bg-navy-800 pl-10 pr-4 text-white placeholder:text-slate-400 focus:outline-none"
            />
          </form>
          <div className="grid gap-1">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 hover:bg-navy-800">
                {item.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link href="/cart" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 hover:bg-navy-800">Cart</Link>
                <Link href="/orders" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 hover:bg-navy-800">Orders</Link>
                <Link href={dashboardHref} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 hover:bg-navy-800">{dashboardLabel}</Link>
                <button onClick={() => logout().then(() => router.push('/'))} className="rounded-lg px-3 py-2 text-left text-slate-400 hover:bg-navy-800">
                  Sign out
                </button>
              </>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link href="/login" onClick={() => setOpen(false)} className="rounded-lg border border-navy-600 px-4 py-2 text-center font-medium">Sign In</Link>
                <Link href="/register" onClick={() => setOpen(false)} className="bg-brand-gradient rounded-lg px-4 py-2 text-center font-semibold">Sign Up</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
