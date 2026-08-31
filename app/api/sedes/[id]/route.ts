import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { query } from '@/lib/db/pg';
import { getSessionUserFromRequest } from '@/lib/auth/session';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAuth = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function requireAdmin(req: Request) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  let userId: string | null = null;
  if (token) {
    const { data } = await supabaseAuth.auth.getUser(token);
    userId = data.user?.id ?? null;
  } else {
    userId = getSessionUserFromRequest(req);
  }
  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  if (profile?.role !== 'admin') {
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