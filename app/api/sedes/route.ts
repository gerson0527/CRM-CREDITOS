import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/pg';
import { getSessionUser, getSessionUserFromRequest, type SessionUser } from '@/lib/auth/session';

async function requireAdmin(req: Request) {
  let user = await getSessionUser();
  if (!user) {
    const userId = getSessionUserFromRequest(req);
    if (userId) {
      user = await queryOne<SessionUser>(
        `SELECT u.id, u.email, u.status, p.role, p.full_name
         FROM public.users u
         LEFT JOIN public.profiles p ON p.user_id = u.id OR p.id = u.id
         WHERE u.id = $1 OR p.id = $1`,
        [userId]
      );
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'No autorizado: Sesión no encontrada' }, { status: 401 });
  }

  // Verificar rol admin en sesión o directamente en profiles
  if (user.role !== 'admin') {
    const prof = await queryOne<{ role: string }>(
      `SELECT role FROM public.profiles WHERE id = $1 OR user_id = $1 OR email = $2`,
      [user.id, user.email]
    );
    if (prof?.role !== 'admin') {
      return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
    }
  }

  return null;
}

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const body = await request.json().catch(() => ({}));
  const { name, code, address, city, phone } = body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
  }

  try {
    const created = await queryOne<{ id: string }>(
      `INSERT INTO public.sedes (name, code, address, city, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [name.trim(), code?.trim() || null, address?.trim() || null, city?.trim() || null, phone?.trim() || null]
    );
    return NextResponse.json({ id: created?.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const rows = await query('SELECT * FROM public.sedes ORDER BY name ASC');
    return NextResponse.json({ rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}