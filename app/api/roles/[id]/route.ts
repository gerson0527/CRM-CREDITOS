import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const supabaseAuth = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function requireAdmin(request: Request) {
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada.' },
      { status: 500 }
    );
  }
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
  }
  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') {
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

  const body = await request.json();
  const { name, description, permissions, is_default } = body;

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('roles')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 });
  }

  if (is_default && !existing.is_default) {
    await supabaseAdmin
      .from('roles')
      .update({ is_default: false })
      .neq('id', params.id);
  }

  const update: Record<string, unknown> = {};
  if (typeof name === 'string' && name.trim()) update.name = name.trim();
  if (typeof description === 'string') update.description = description || null;
  if (Array.isArray(permissions)) update.permissions = permissions;
  if (typeof is_default === 'boolean') update.is_default = is_default;

  const { data, error } = await supabaseAdmin
    .from('roles')
    .update(update)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ role: data });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('roles')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 });
  }

  if (existing.is_system) {
    return NextResponse.json(
      { error: 'Los roles del sistema no se pueden eliminar' },
      { status: 400 }
    );
  }

  const { count: usersCount } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role_id', params.id);

  if ((usersCount ?? 0) > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: ${usersCount} usuario(s) tienen este rol. Reasígnalos primero.` },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin.from('roles').delete().eq('id', params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}