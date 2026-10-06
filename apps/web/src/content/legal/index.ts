import type { Locale } from '@/i18n';
import type { PublicSettings } from '@/lib/types';
import { BRAND } from '@/lib/brand';
import * as en from './en';
import * as ptBR from './pt-BR';
import type { LegalContext, LegalDocument } from './types';

export type { LegalContext, LegalDocument, LegalSection } from './types';

export type LegalPage = 'terms' | 'privacy' | 'contact';

const BY_LOCALE: Record<Locale, Record<LegalPage, (ctx: LegalContext) => LegalDocument>> = {
  en: { terms: en.terms, privacy: en.privacy, contact: en.contact },
  'pt-BR': { terms: ptBR.terms, privacy: ptBR.privacy, contact: ptBR.contact },
};

/** Builds the operator facts from the public settings; works without the API (defaults only). */
export function legalContext(settings: PublicSettings | null): LegalContext {
  return {
    siteName: settings?.siteName ?? BRAND.name,
    companyName: settings?.legal?.companyName ?? '',
    cnpj: settings?.legal?.cnpj ?? '',
    address: settings?.legal?.address ?? '',
    contactEmail: settings?.legal?.contactEmail ?? '',
    pendingHoldDays: settings?.pendingHoldDays ?? 0,
  };
}

export function legalDocument(page: LegalPage, locale: Locale, ctx: LegalContext): LegalDocument {
  return BY_LOCALE[locale][page](ctx);
}
