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
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

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

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const rows = await query('SELECT * FROM public.roles ORDER BY name ASC');
    return NextResponse.json({ roles: rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const body = await request.json().catch(() => ({}));
  const { slug, name, description, permissions, is_default } = body;

  if (!slug || !name) {
    return NextResponse.json({ error: 'slug y name son requeridos' }, { status: 400 });
  }

  const validPerms = JSON.stringify(Array.isArray(permissions) ? permissions : []);
  
  try {
    if (is_default) {
      await query(`UPDATE public.roles SET is_default = false`);
    }

    const created = await queryOne(
      `INSERT INTO public.roles (slug, name, description, permissions, is_system, is_default)
       VALUES ($1, $2, $3, $4::jsonb, false, $5)
       RETURNING *`,
      [slug.toLowerCase().trim(), name.trim(), description || null, validPerms, !!is_default]
    );

    return NextResponse.json({ role: created });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}