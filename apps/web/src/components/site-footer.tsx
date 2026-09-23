'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BRAND } from '@/lib/brand';
import { Logo } from './logo';

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith('/vendor') || pathname.startsWith('/admin')) return null;

  return (
    <footer className="mt-16 bg-navy-900 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <Logo />
          <nav className="flex flex-wrap gap-6 text-sm">
            <Link href="/" className="hover:text-white">Home</Link>
            <Link href="/products" className="hover:text-white">Browse</Link>
            <Link href="/plans" className="hover:text-white">Sell</Link>
            <Link href="/register" className="hover:text-white">Create account</Link>
          </nav>
        </div>
        <div className="mt-8 flex flex-col gap-3 border-t border-navy-800 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</span>
          <span className="flex gap-5">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>Contact</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
