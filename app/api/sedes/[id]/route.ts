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

const ALLOWED = ['name', 'code', 'address', 'city', 'phone', 'active', 'manager_id'];

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const body = await request.json().catch(() => ({}));
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED.includes(k)) {
      sets.push(`${k} = $${i++}`);
      values.push(v);
    }
  }
  if (sets.length === 0) {
    return NextResponse.json({ error: 'Sin campos para actualizar' }, { status: 400 });
  }
  values.push(params.id);

  try {
    await query(
      `UPDATE public.sedes SET ${sets.join(', ')} WHERE id = $${i}`,
      values
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  try {
    // Detach users from this sede (set NULL) before deleting
    await query(`UPDATE public.profiles SET sede_id = NULL WHERE sede_id = $1`, [params.id]);
    await query(`DELETE FROM public.sedes WHERE id = $1`, [params.id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError(err);
  }
}