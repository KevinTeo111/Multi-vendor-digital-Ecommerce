// Allow a sleeping free-tier API up to a minute to wake up before this page gives up.
export const maxDuration = 60;

import { LegalDocumentView } from '@/components/legal-document';
import { legalContext, legalDocument } from '@/content/legal';
import { getLocale } from '@/i18n/server';
import { serverApi } from '@/lib/api';
import type { PublicSettings } from '@/lib/types';

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: locale === 'pt-BR' ? 'Contato' : 'Contact' };
}

export default async function ContactPage() {
  const [locale, settings] = await Promise.all([
    getLocale(),
    serverApi<PublicSettings>('/settings/public'),
  ]);
  return (
    <LegalDocumentView
      doc={legalDocument('contact', locale, legalContext(settings))}
      locale={locale}
    />
  );
}
