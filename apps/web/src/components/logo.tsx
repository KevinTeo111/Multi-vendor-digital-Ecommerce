'use client';

import Link from 'next/link';
import { useT } from '@/i18n/client';
import { BRAND } from '@/lib/brand';

export function Logo({ href = '/', compact = false, light = false }: { href?: string; compact?: boolean; light?: boolean }) {
  const t = useT();
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label={`${BRAND.name} home`}>
      <span className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-base font-black text-white shadow-glow">D</span>
      {!compact && (
        <span className="leading-tight">
          <span className={`block text-base font-extrabold tracking-tight ${light ? 'text-white' : 'text-navy-900'}`}>{BRAND.name}</span>
          <span className={`block text-[11px] ${light ? 'text-slate-300' : 'text-slate-500'}`}>{t('common.tagline')}</span>
        </span>
      )}
    </Link>
  );
}
