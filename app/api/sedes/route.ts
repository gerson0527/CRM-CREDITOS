import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { query, queryOne } from '@/lib/db/pg';
import { getSessionUserId, getSessionUserFromRequest } from '@/lib/auth/session';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAuth = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  const cookieHeader = req.headers.get('cookie') ?? '';
  let userId: string | null = null;
  if (token) {
    const { data } = await supabaseAuth.auth.getUser(token);
    userId = data.user?.id ?? null;
  } else if (cookieHeader) {
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