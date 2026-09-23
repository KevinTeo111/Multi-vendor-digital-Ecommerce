'use client';

import { DashboardShell, type NavItem } from '@/components/dashboard-shell';
import { RequireRole } from '@/components/require-role';

const nav: NavItem[] = [
  { href: '/vendor', label: 'Dashboard', icon: 'chart' },
  { href: '/vendor/products', label: 'Products', icon: 'box' },
  { href: '/vendor/sales', label: 'Orders', icon: 'receipt' },
  { href: '/vendor/finance', label: 'Earnings', icon: 'wallet' },
  { href: '/vendor/subscription', label: 'Plan', icon: 'card' },
  { href: '/vendor/settings', label: 'Store Settings', icon: 'settings' },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={['VENDOR']}>
      <DashboardShell title="Seller Dashboard" nav={nav}>
        {children}
      </DashboardShell>
    </RequireRole>
  );
}
