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

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const { data, error } = await supabaseAdmin
    .from('roles')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ roles: data || [] });
}

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const body = await request.json();
  const { slug, name, description, permissions, is_default } = body;

  if (!slug || !name) {
    return NextResponse.json({ error: 'slug y name son requeridos' }, { status: 400 });
  }

  const validPerms = Array.isArray(permissions) ? permissions : [];
  if (is_default) {
    await supabaseAdmin
      .from('roles')
      .update({ is_default: false })
      .neq('id', '00000000-0000-0000-0000-000000000000');
  }

  const { data, error } = await supabaseAdmin
    .from('roles')
    .insert({
      slug: slug.toLowerCase().trim(),
      name: name.trim(),
      description: description || null,
      permissions: validPerms,
      is_system: false,
      is_default: !!is_default,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ role: data });
}