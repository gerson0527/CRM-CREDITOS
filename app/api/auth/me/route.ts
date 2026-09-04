import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { queryOne } from '@/lib/db/pg';

export async function GET() {
  // allowStalePassword: /me debe responder aunque el usuario tenga cambio
  // de contraseña pendiente (el cliente muestra el diálogo con este flag).
  const session = await getSessionUser({ allowStalePassword: true });

  if (!session) {
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
    must_change_password: boolean;
  }>(
    `SELECT p.id, p.user_id, u.email, p.full_name, p.phone, p.role, p.role_id, u.status,
            p.supervisor_id, p.monthly_goal, p.commission_rate,
            p.must_change_password,
            COALESCE(r.permissions, '[]'::jsonb) AS permissions
     FROM public.profiles p
     JOIN public.users u ON u.id = p.user_id
     LEFT JOIN public.roles r ON r.id = p.role_id
     WHERE p.user_id = $1`,
    [session.id]
  );

  return NextResponse.json({ user: profile });
}
