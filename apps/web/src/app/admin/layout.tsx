'use client';

import { DashboardShell, type NavItem } from '@/components/dashboard-shell';
import { RequireRole } from '@/components/require-role';
import { useT } from '@/i18n/client';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const nav: NavItem[] = [
    { href: '/admin', label: t('dashboard.navDashboard'), icon: 'chart' },
    { href: '/admin/products', label: t('dashboard.navProductReview'), icon: 'check' },
    { href: '/admin/withdrawals', label: t('dashboard.navWithdrawals'), icon: 'wallet' },
    { href: '/admin/orders', label: t('dashboard.navOrders'), icon: 'receipt' },
    { href: '/admin/vendors', label: t('dashboard.navSellers'), icon: 'store' },
    { href: '/admin/users', label: t('dashboard.navUsers'), icon: 'users' },
    { href: '/admin/plans', label: t('dashboard.navPlans'), icon: 'card' },
    { href: '/admin/categories', label: t('dashboard.navCategories'), icon: 'layers' },
    { href: '/admin/settings', label: t('dashboard.navSettings'), icon: 'settings' },
  ];
  return (
    <RequireRole roles={['ADMIN']}>
      <DashboardShell title={t('dashboard.admin')} nav={nav}>
        {children}
      </DashboardShell>
    </RequireRole>
  );
}
