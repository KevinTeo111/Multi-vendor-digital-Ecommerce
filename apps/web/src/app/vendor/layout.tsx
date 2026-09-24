'use client';

import { DashboardShell, type NavItem } from '@/components/dashboard-shell';
import { RequireRole } from '@/components/require-role';
import { useT } from '@/i18n/client';

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const nav: NavItem[] = [
    { href: '/vendor', label: t('dashboard.navDashboard'), icon: 'chart' },
    { href: '/vendor/products', label: t('dashboard.navProducts'), icon: 'box' },
    { href: '/vendor/sales', label: t('dashboard.navOrders'), icon: 'receipt' },
    { href: '/vendor/finance', label: t('dashboard.navEarnings'), icon: 'wallet' },
    { href: '/vendor/subscription', label: t('dashboard.navPlan'), icon: 'card' },
    { href: '/vendor/settings', label: t('dashboard.navStoreSettings'), icon: 'settings' },
  ];
  return (
    <RequireRole roles={['VENDOR']}>
      <DashboardShell title={t('dashboard.seller')} nav={nav}>
        {children}
      </DashboardShell>
    </RequireRole>
  );
}
