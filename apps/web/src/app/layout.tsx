import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth-provider';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { ToastProvider } from '@/components/toasts';
import { LocaleProvider } from '@/i18n/client';
import { getLocale } from '@/i18n/server';
import { BRAND } from '@/lib/brand';
import { CartProvider } from '@/lib/cart-store';
import { RealtimeProvider } from '@/lib/realtime';
import './globals.css';

export const metadata: Metadata = {
  title: { default: `${BRAND.name} · ${BRAND.tagline}`, template: `%s · ${BRAND.name}` },
  description: BRAND.description,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body id="top" className="flex min-h-screen flex-col bg-surface">
        <LocaleProvider locale={locale}>
          <AuthProvider>
            <ToastProvider>
              <RealtimeProvider>
                <CartProvider>
                  <SiteHeader />
                  <div className="flex flex-1 flex-col">{children}</div>
                  <SiteFooter />
                </CartProvider>
              </RealtimeProvider>
            </ToastProvider>
          </AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
