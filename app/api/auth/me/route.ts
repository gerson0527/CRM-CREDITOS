import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { queryOne } from '@/lib/db/pg';

export async function GET() {
  console.log('[BACK /api/auth/me] ▶ request received');
  const session = await getSessionUser();
  console.log('[BACK /api/auth/me] session:', session ? { id: session.id, role: session.role, status: session.status } : 'NO SESSION');

  if (!session) {
    console.log('[BACK /api/auth/me] ◀ 200 user=null (no session)');
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const profile = await queryOne<{
    id: string;
    user_id: string;
    email: string;
    full_name: string;
    phone: string | null;
    role: 'admin' | 'supervisor' | 'asesor';
    role_id: string | null;
    status: string;
    supervisor_id: string | null;
    monthly_goal: number;
    commission_rate: number;
    permissions: string[];
  }>(
    `SELECT p.id, p.user_id, u.email, p.full_name, p.phone, p.role, p.role_id, u.status,
            p.supervisor_id, p.monthly_goal, p.commission_rate,
            COALESCE(r.permissions, '[]'::jsonb) AS permissions
     FROM public.profiles p
     JOIN public.users u ON u.id = p.user_id
     LEFT JOIN public.roles r ON r.id = p.role_id
     WHERE p.user_id = $1`,
    [session.id]
  );

  console.log('[BACK /api/auth/me] profile loaded:', profile ? {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    permissions_count: profile.permissions?.length || 0,
  } : 'NO PROFILE');

  return NextResponse.json({ user: profile });
}