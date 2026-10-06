import type { LegalDocument } from '@/content/legal';
import type { Locale } from '@/i18n';
import { PageContainer } from './page-container';

const slug = (heading: string, index: number) =>
  `${index + 1}-${heading
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}`;

/** Renders a legal text (terms, privacy, contact): intro, numbered contents, sections with anchors. */
export function LegalDocumentView({ doc, locale }: { doc: LegalDocument; locale: Locale }) {
  const updated = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${doc.updated}T00:00:00Z`),
  );
  const updatedLabel = locale === 'pt-BR' ? 'Última atualização' : 'Last updated';
  const contentsLabel = locale === 'pt-BR' ? 'Conteúdo' : 'Contents';

  return (
    <>
      <section className="bg-hero text-white">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <h1 className="text-3xl font-bold sm:text-4xl">{doc.title}</h1>
          <p className="mt-2 text-sm text-slate-300">
            {updatedLabel}: {updated}
          </p>
        </div>
      </section>
      <PageContainer>
        <div className="mx-auto max-w-3xl">
          <div className="space-y-4 text-slate-700">
            {doc.intro.map((p) => (
              <p key={p}>{linkify(p)}</p>
            ))}
          </div>

          <nav
            aria-label={contentsLabel}
            className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 text-sm"
          >
            <p className="mb-2 font-semibold text-navy-900">{contentsLabel}</p>
            <ol className="columns-1 gap-6 sm:columns-2">
              {doc.sections.map((s, i) => (
                <li key={s.heading} className="py-0.5">
                  <a href={`#${slug(s.heading, i)}`} className="text-brand-600 hover:underline">
                    {i + 1}. {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-10 space-y-10">
            {doc.sections.map((s, i) => (
              <section key={s.heading} id={slug(s.heading, i)} className="scroll-mt-24">
                <h2 className="text-xl font-semibold text-navy-900">
                  {i + 1}. {s.heading}
                </h2>
                <div className="mt-3 space-y-3 text-slate-700">
                  {s.paragraphs?.map((p) => (
                    <p key={p}>{linkify(p)}</p>
                  ))}
                  {s.bullets && (
                    <ul className="list-disc space-y-2 pl-5">
                      {s.bullets.map((b) => (
                        <li key={b}>{linkify(b)}</li>
                      ))}
                    </ul>
                  )}
                  {s.after?.map((p) => (
                    <p key={p}>{linkify(p)}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </PageContainer>
    </>
  );
}

const EMAIL = /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i;

/** Turns an e-mail address inside a sentence into a mailto link. */
function linkify(text: string) {
  const parts = text.split(EMAIL);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={`mailto:${part}`} className="font-medium text-brand-600 hover:underline">
        {part}
      </a>
    ) : (
      part
    ),
  );
}
