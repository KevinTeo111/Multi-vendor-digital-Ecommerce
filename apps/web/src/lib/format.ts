const currencyLocale: Record<string, string> = { BRL: 'pt-BR', USD: 'en-US', EUR: 'de-DE' };

/** Locale used for dates when none is passed; set by the LocaleProvider on the client and by server pages. */
let defaultLocale = 'pt-BR';
export function setDefaultLocale(locale: string) {
  defaultLocale = locale;
}

export function formatMoney(cents: number, currency = 'BRL') {
  return new Intl.NumberFormat(currencyLocale[currency] ?? 'en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

export function formatBps(bps: number) {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
}

export function formatDate(value: string | Date | null | undefined, withTime = false, locale = defaultLocale) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString(locale, {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' } : {}),
    timeZone: 'America/Sao_Paulo',
  });
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export function statusLabel(status: string) {
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
