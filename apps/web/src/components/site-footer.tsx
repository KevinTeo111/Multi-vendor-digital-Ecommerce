'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/i18n/client';
import { BRAND } from '@/lib/brand';
import { ArrowRightIcon } from './icons';
import { LanguageToggle } from './language-toggle';
import { Logo } from './logo';

export function SiteFooter() {
  const pathname = usePathname();
  const t = useT();
  if (pathname.startsWith('/vendor') || pathname.startsWith('/admin')) return null;

  const columns = [
    { title: t('nav.footerBrowse'), links: [{ href: '/', label: t('nav.home') }, { href: '/products', label: t('nav.browse') }, { href: '/plans', label: t('nav.sellerPlans') }] },
    { title: t('nav.footerSell'), links: [{ href: '/register?role=VENDOR', label: t('nav.openStore') }, { href: '/plans', label: t('nav.sellerPlans') }] },
    { title: t('nav.footerAccount'), links: [{ href: '/login', label: t('common.signIn') }, { href: '/register', label: t('nav.createAccount') }, { href: '/orders', label: t('nav.orders') }] },
  ];

  return (
    <footer className="mt-auto bg-navy-900 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.2fr_2fr]">
          <div>
            <Logo light />
            <p className="mt-4 max-w-xs text-sm text-slate-400">{BRAND.description}</p>
            <div className="mt-5">
              <LanguageToggle dark />
            </div>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {columns.map((col) => (
              <div key={col.title}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">{col.title}</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {col.links.map((l) => (
                    <li key={l.href + l.label}>
                      <Link href={l.href} className="group inline-flex items-center gap-1 hover:text-white">
                        <ArrowRightIcon size={12} className="arrow-nudge text-brand-500" /> {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} {BRAND.name}. {t('nav.rights')}
          </span>
          <div className="flex items-center gap-5">
            <span>{t('nav.privacy')}</span>
            <span>{t('nav.terms')}</span>
            <span>{t('nav.contact')}</span>
            <a href="#top" className="group inline-flex items-center gap-1 text-brand-500 hover:text-cyan-400">
              {t('nav.pageTop')} <ArrowRightIcon size={12} className="-rotate-90" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
