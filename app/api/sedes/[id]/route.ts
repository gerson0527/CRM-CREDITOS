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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}