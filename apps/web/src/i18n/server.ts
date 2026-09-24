import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, makeT, type Locale } from './index';

/** Locale for server components, read from the cookie set by the language toggle. */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get('locale')?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: makeT(locale) };
}
