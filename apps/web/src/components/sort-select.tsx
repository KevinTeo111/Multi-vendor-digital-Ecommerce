'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const OPTIONS = [
  ['popular', 'Most Popular'],
  ['newest', 'Newest First'],
  ['price_asc', 'Lowest Price'],
  ['price_desc', 'Highest Price'],
] as const;

export function SortSelect({ value }: { value?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const change = (sort: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('sort', sort);
    next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm">
      <span className="text-slate-500">Sort by:</span>
      <select value={value ?? 'newest'} onChange={(e) => change(e.target.value)} className="bg-transparent font-medium text-slate-900 focus:outline-none" aria-label="Sort products">
        {OPTIONS.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
