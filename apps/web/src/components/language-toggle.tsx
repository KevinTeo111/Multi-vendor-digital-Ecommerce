'use client';

import { LOCALES, LOCALE_SHORT, type Locale } from '@/i18n';
import { useLocale } from '@/i18n/client';

export function LanguageToggle({
  className = '',
  dark = false,
}: {
  className?: string;
  dark?: boolean;
}) {
  const { locale, setLocale, t } = useLocale();
  return (
    <div
      className={`inline-flex items-center rounded-full p-0.5 text-xs font-bold ${dark ? 'bg-white/10' : 'bg-slate-100'} ${className}`}
      role="group"
      aria-label={t('nav.language')}
    >
      {LOCALES.map((l: Locale) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={`rounded-full px-2.5 py-1 transition ${locale === l ? 'bg-brand-500 text-white shadow' : dark ? 'text-slate-300 hover:text-white' : 'text-slate-500 hover:text-navy-900'}`}
        >
          {LOCALE_SHORT[l]}
        </button>
      ))}
    </div>
  );
}
