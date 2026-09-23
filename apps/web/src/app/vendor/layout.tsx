'use client';

import { DashboardShell } from '@/components/dashboard-shell';
import { RequireRole } from '@/components/require-role';

const nav = [
  { href: '/vendor', label: 'Overview' },
  { href: '/vendor/products', label: 'Products' },
  { href: '/vendor/sales', label: 'Sales' },
  { href: '/vendor/finance', label: 'Finance' },
  { href: '/vendor/subscription', label: 'Plan' },
  { href: '/vendor/settings', label: 'Store settings' },
];

export default function VendorLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole roles={['VENDOR']}>
      <DashboardShell title="Vendor" nav={nav}>
        {children}
      </DashboardShell>
    </RequireRole>
  );
}
