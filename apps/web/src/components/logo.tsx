'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useT } from '@/i18n/client';
import { BRAND } from '@/lib/brand';

/** Brand mark + wordmark. The mark is /public/logo.png (transparent background, works on light and dark). */
export function Logo({ href = '/', compact = false, light = false, size = 40 }: { href?: string; compact?: boolean; light?: boolean; size?: number }) {
  const t = useT();
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label={`${BRAND.name} home`}>
      <Image src="/logo.png" alt={BRAND.name} width={size} height={size} priority className="shrink-0 object-contain" />
      {!compact && (
        <span className="leading-tight">
          <span className={`block text-base font-extrabold tracking-tight ${light ? 'text-white' : 'text-navy-900'}`}>{BRAND.name}</span>
          <span className={`block text-[11px] ${light ? 'text-slate-300' : 'text-slate-500'}`}>{t('common.tagline')}</span>
        </span>
      )}
    </Link>
  );
}
