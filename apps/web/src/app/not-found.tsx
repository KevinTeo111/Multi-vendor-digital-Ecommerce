'use client';

import Link from 'next/link';
import { useT } from '@/i18n/client';

export default function NotFound() {
  const t = useT();
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="text-brand-gradient text-7xl font-black">404</div>
      <h1 className="mt-4 text-2xl font-bold text-navy-900">{t('notFound.title')}</h1>
      <p className="mt-2 text-sm text-slate-500">{t('notFound.text')}</p>
      <Link
        href="/"
        className="bg-brand-gradient mt-6 inline-flex rounded-full px-6 py-2.5 text-sm font-semibold text-white shadow-glow"
      >
        {t('notFound.home')}
      </Link>
    </div>
  );
}
