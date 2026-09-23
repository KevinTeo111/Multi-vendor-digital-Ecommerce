'use client';

import { DashboardShell } from '@/components/dashboard-shell';
import { RequireRole } from '@/components/require-role';

const nav = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/products', label: 'Product review' },
  { href: '/admin/withdrawals', label: 'Withdrawals' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/vendors', label: 'Vendors' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/plans', label: 'Plans' },
  { href: '/admin/categories', label: 'Categories' },
  { href: '/admin/settings', label: 'Settings' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={['ADMIN']}>
      <DashboardShell title="Admin" nav={nav}>
        {children}
      </DashboardShell>
    </RequireRole>
  );
}
