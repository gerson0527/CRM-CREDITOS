import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSessionUserFromRequest } from '@/lib/auth/session';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function POST(request: Request) {
  // Verificar que el llamador sea admin
  const callerId = getSessionUserFromRequest(request);
  if (!callerId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { data: caller } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', callerId)
    .single();
  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores pueden cambiar contraseñas' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { userId, newPassword, mustChangePassword = true } = body;

  if (!userId || !newPassword) {
    return NextResponse.json({ error: 'userId y newPassword requeridos' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Mínimo 8 caracteres' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Marcar que debe cambiar en próximo login
  await supabaseAdmin
    .from('profiles')
    .update({ must_change_password: mustChangePassword })
    .eq('id', userId);

  // También actualizar en public.users.password_hash
  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.hash(newPassword, 10);
  await supabaseAdmin
    .from('users')
    .update({ password_hash: hash, must_change_password: mustChangePassword })
    .eq('id', userId);

  return NextResponse.json({ success: true });
}