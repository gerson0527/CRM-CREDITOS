import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { query, queryOne } from '@/lib/db/pg';
import { getSessionUser } from '@/lib/auth/session';

async function requireAdmin(_req: Request) {
  // getSessionUser ya valida firma, expiración, cap absoluto de 7d,
  // estado activo y bloqueo por cambio de contraseña pendiente.
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores' }, { status: 403 });
  }

  return null;
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const rows = await query('SELECT * FROM public.roles ORDER BY name ASC');
    return NextResponse.json({ roles: rows });
  } catch (err) {
    return apiError(err);
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
  } catch (err) {
    return apiError(err);
  }
}