'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useT } from '@/i18n/client';

export function SortSelect({ value }: { value?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const t = useT();

  const OPTIONS = [
    ['popular', t('browse.sortPopular')],
    ['newest', t('browse.sortNewest')],
    ['price_asc', t('browse.sortPriceAsc')],
    ['price_desc', t('browse.sortPriceDesc')],
  ] as const;

  const change = (sort: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('sort', sort);
    next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm">
      <span className="text-slate-500">{t('browse.sortBy')}</span>
      <select value={value ?? 'newest'} onChange={(e) => change(e.target.value)} className="bg-transparent font-semibold text-navy-900 focus:outline-none" aria-label={t('browse.sortBy')}>
        {OPTIONS.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
