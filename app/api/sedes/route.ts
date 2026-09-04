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
  } catch (err) {
    return apiError(err);
  }
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    const rows = await query('SELECT * FROM public.sedes ORDER BY name ASC');
    return NextResponse.json({ rows });
  } catch (err) {
    return apiError(err);
  }
}