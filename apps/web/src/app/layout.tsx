import type { Metadata } from 'next';
import { AuthProvider } from '@/components/auth-provider';
import { SiteHeader } from '@/components/site-header';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Digital Marketplace', template: '%s · Digital Marketplace' },
  description: 'Buy and sell digital products from independent creators.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased dark:bg-slate-950">
        <AuthProvider>
          <SiteHeader />
          <div className="mx-auto w-full max-w-6xl px-4 py-6">{children}</div>
          <footer className="mt-12 border-t border-slate-200 py-6 text-center text-xs text-slate-500 dark:border-slate-800">
            Digital Marketplace · Multi-vendor platform for digital products
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
