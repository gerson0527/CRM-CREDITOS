'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import type { UserRole, UserStatus } from '@/lib/types';

interface RouteGuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function RouteGuard({ children, allowedRoles }: RouteGuardProps) {
  const { session, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!session) {
      router.replace('/login');
      return;
    }

    if (profile) {
      const status: UserStatus = profile.status;
      if (status !== 'activo') {
        router.replace('/login?blocked=' + status);
        return;
      }

      if (allowedRoles && !allowedRoles.includes(profile.role)) {
        router.replace('/dashboard');
        return;
      }
    }
  }, [session, profile, loading, router, allowedRoles]);

  if (loading || !session || !profile || profile.status !== 'activo') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return null;
  }

  return <>{children}</>;
}
