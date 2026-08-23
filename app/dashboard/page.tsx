'use client';

import dynamic from 'next/dynamic';
import { useAuth } from '@/components/providers/auth-provider';
import { AppLayout } from '@/components/app-layout';

const AdminDashboard = dynamic(() => import('./admin-dashboard'), { ssr: false });
const SupervisorDashboard = dynamic(() => import('./supervisor-dashboard'), { ssr: false });
const AsesorDashboard = dynamic(() => import('./asesor-dashboard'), { ssr: false });

export default function DashboardPage() {
  const { profile } = useAuth();

  return (
    <AppLayout>
      {!profile ? (
        <div className="flex h-96 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : profile.role === 'admin' ? (
        <AdminDashboard />
      ) : profile.role === 'supervisor' ? (
        <SupervisorDashboard />
      ) : (
        <AsesorDashboard />
      )}
    </AppLayout>
  );
}
