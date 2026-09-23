'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from './auth-provider';
import { Loading } from './ui';
import type { Role } from '@/lib/types';

/** Client-side gate for dashboard areas. The API enforces roles independently. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    else if (!roles.includes(user.role)) router.replace('/');
  }, [loading, user, roles, router]);

  if (loading || !user || !roles.includes(user.role)) return <Loading />;
  return <>{children}</>;
}
