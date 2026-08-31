import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl!, serviceRoleKey!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const supabaseAuth = createClient(supabaseUrl!, anonKey!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface CreateUserBody {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'supervisor' | 'asesor' | string;
  role_id?: string | null;
  supervisor_id?: string | null;
  monthly_goal?: number;
  commission_rate?: number;
  phone?: string | null;
}

export async function POST(request: Request) {
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor. Agrega la clave en .env.local y reinicia el servidor.' },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return NextResponse.json({ error: 'No autorizado: token faltante' }, { status: 401 });
  }

  const { data: { user: caller }, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !caller) {
    return NextResponse.json({ error: 'Sesión inválida o expirada' }, { status: 401 });
  }

  const { data: callerProfile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single();

  if (callerProfile?.role !== 'admin') {
    return NextResponse.json(
      { error: 'Solo administradores pueden crear usuarios' },
      { status: 403 }
    );
  }

  let body: CreateUserBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON inválido' }, { status: 400 });
  }

  const { email, password, full_name, role, role_id, supervisor_id, monthly_goal, commission_rate, phone } = body;

  if (!email || !password || !full_name || !role) {
    return NextResponse.json(
      { error: 'Faltan campos requeridos: email, password, full_name, role' },
      { status: 400 }
    );
  }

  let resolvedRoleId = role_id;
  if (!resolvedRoleId) {
    const { data: roleData } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('slug', role)
      .maybeSingle();
    resolvedRoleId = roleData?.id || null;
  }

  if (role === 'asesor' && !supervisor_id) {
    return NextResponse.json(
      { error: 'Los asesores deben tener un supervisor asignado' },
      { status: 400 }
    );
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (createError || !created?.user) {
    return NextResponse.json(
      { error: createError?.message || 'Error al crear el usuario de autenticación' },
      { status: 400 }
    );
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: created.user.id,
    email,
    full_name,
    role,
    role_id: resolvedRoleId,
    supervisor_id: role === 'asesor' ? supervisor_id : null,
    monthly_goal: monthly_goal ?? 0,
    commission_rate: commission_rate ?? 0,
    phone: phone || null,
    status: 'activo',
  });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json(
      { error: `Error al crear el perfil: ${profileError.message}` },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    user: {
      id: created.user.id,
      email,
      full_name,
      role,
    },
  });
}