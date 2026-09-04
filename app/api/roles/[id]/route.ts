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

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const body = await request.json().catch(() => ({}));
  const { name, description, permissions, is_default } = body;

  const existing = await queryOne<{ id: string; is_default: boolean }>(
    `SELECT id, is_default FROM public.roles WHERE id = $1`,
    [params.id]
  );

  if (!existing) {
    return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 });
  }

  try {
    if (is_default && !existing.is_default) {
      await query(`UPDATE public.roles SET is_default = false WHERE id != $1`, [params.id]);
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (typeof name === 'string' && name.trim()) {
      sets.push(`name = $${i++}`);
      values.push(name.trim());
    }
    if (typeof description === 'string') {
      sets.push(`description = $${i++}`);
      values.push(description.trim() || null);
    }
    if (Array.isArray(permissions)) {
      sets.push(`permissions = $${i++}::jsonb`);
      values.push(JSON.stringify(permissions));
    }
    if (typeof is_default === 'boolean') {
      sets.push(`is_default = $${i++}`);
      values.push(is_default);
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'Sin cambios para actualizar' }, { status: 400 });
    }

    values.push(params.id);
    const updated = await queryOne(
      `UPDATE public.roles SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );

    return NextResponse.json({ role: updated });
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

  const existing = await queryOne<{ id: string; is_system: boolean }>(
    `SELECT id, is_system FROM public.roles WHERE id = $1`,
    [params.id]
  );

  if (!existing) {
    return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 });
  }

  if (existing.is_system) {
    return NextResponse.json(
      { error: 'Los roles del sistema no se pueden eliminar' },
      { status: 400 }
    );
  }

  const usersCountRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM public.profiles WHERE role_id = $1`,
    [params.id]
  );
  const usersCount = parseInt(usersCountRow?.count ?? '0', 10);

  if (usersCount > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: ${usersCount} usuario(s) tienen este rol. Reasígnalos primero.` },
      { status: 400 }
    );
  }

  try {
    await query(`DELETE FROM public.roles WHERE id = $1`, [params.id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return apiError(err);
  }
}