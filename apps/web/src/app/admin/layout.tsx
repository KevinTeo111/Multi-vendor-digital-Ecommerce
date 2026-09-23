'use client';

import { DashboardShell, type NavItem } from '@/components/dashboard-shell';
import { RequireRole } from '@/components/require-role';

const nav: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: 'chart' },
  { href: '/admin/products', label: 'Product Review', icon: 'check' },
  { href: '/admin/withdrawals', label: 'Withdrawals', icon: 'wallet' },
  { href: '/admin/orders', label: 'Orders', icon: 'receipt' },
  { href: '/admin/vendors', label: 'Sellers', icon: 'store' },
  { href: '/admin/users', label: 'Users', icon: 'users' },
  { href: '/admin/plans', label: 'Plans', icon: 'card' },
  { href: '/admin/categories', label: 'Categories', icon: 'layers' },
  { href: '/admin/settings', label: 'Settings', icon: 'settings' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={['ADMIN']}>
      <DashboardShell title="Admin Panel" nav={nav}>
        {children}
      </DashboardShell>
    </RequireRole>
  );
}
