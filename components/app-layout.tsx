'use client';

import { AppShell } from '@/components/app-shell';
import { RouteGuard } from '@/components/providers/route-guard';
import type { UserRole } from '@/lib/types';

interface AppLayoutProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function AppLayout({ children, allowedRoles }: AppLayoutProps) {
  return (
    <RouteGuard allowedRoles={allowedRoles}>
      <AppShell>{children}</AppShell>
    </RouteGuard>
  );
}
