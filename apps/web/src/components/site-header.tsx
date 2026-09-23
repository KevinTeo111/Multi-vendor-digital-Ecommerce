'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useAuth } from './auth-provider';

export function SiteHeader() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const search = (e: FormEvent) => {
    e.preventDefault();
    router.push(`/products${q ? `?search=${encodeURIComponent(q)}` : ''}`);
    setOpen(false);
  };

  const dashboardHref = user?.role === 'ADMIN' ? '/admin' : user?.role === 'VENDOR' ? '/vendor' : '/library';
  const dashboardLabel = user?.role === 'ADMIN' ? 'Admin' : user?.role === 'VENDOR' ? 'Vendor dashboard' : 'My downloads';

  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Marketplace
        </Link>

        <form onSubmit={search} className="hidden flex-1 md:block">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products…"
            aria-label="Search products"
            className="w-full max-w-md rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </form>

        <nav className="ml-auto hidden items-center gap-4 text-sm md:flex">
          <Link href="/products" className="hover:underline">
            Browse
          </Link>
          <Link href="/plans" className="hover:underline">
            Sell
          </Link>
          {!loading && user ? (
            <>
              <Link href="/cart" className="hover:underline">
                Cart
              </Link>
              <Link href="/orders" className="hover:underline">
                Orders
              </Link>
              <Link href={dashboardHref} className="hover:underline">
                {dashboardLabel}
              </Link>
              <button onClick={() => logout().then(() => router.push('/'))} className="text-slate-500 hover:underline">
                Sign out
              </button>
            </>
          ) : (
            !loading && (
              <>
                <Link href="/login" className="hover:underline">
                  Sign in
                </Link>
                <Link href="/register" className="rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-500">
                  Sign up
                </Link>
              </>
            )
          )}
        </nav>

        <button className="ml-auto rounded-md border px-2 py-1 text-sm md:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">
          ☰
        </button>
      </div>

      {open && (
        <div className="space-y-2 border-t border-slate-200 px-4 py-3 text-sm md:hidden dark:border-slate-800">
          <form onSubmit={search}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products…"
              className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
            />
          </form>
          <MobileLink href="/products" onClick={() => setOpen(false)}>Browse</MobileLink>
          <MobileLink href="/plans" onClick={() => setOpen(false)}>Sell</MobileLink>
          {user ? (
            <>
              <MobileLink href="/cart" onClick={() => setOpen(false)}>Cart</MobileLink>
              <MobileLink href="/orders" onClick={() => setOpen(false)}>Orders</MobileLink>
              <MobileLink href={dashboardHref} onClick={() => setOpen(false)}>{dashboardLabel}</MobileLink>
              <button onClick={() => logout().then(() => router.push('/'))} className="block py-1 text-slate-500">
                Sign out
              </button>
            </>
          ) : (
            <>
              <MobileLink href="/login" onClick={() => setOpen(false)}>Sign in</MobileLink>
              <MobileLink href="/register" onClick={() => setOpen(false)}>Sign up</MobileLink>
            </>
          )}
        </div>
      )}
    </header>
  );
}

function MobileLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link href={href} onClick={onClick} className="block py-1">
      {children}
    </Link>
  );
}
