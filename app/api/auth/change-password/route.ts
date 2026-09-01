import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';
import { getSessionUserId, getSessionUserFromRequest } from '@/lib/auth/session';
import { queryOne } from '@/lib/db/pg';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAuth = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function requireUser(req: Request): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (token) {
    const { data } = await supabaseAuth.auth.getUser(token);
    return data.user?.id ?? null;
  }
  return getSessionUserFromRequest(req);
}

export async function POST(request: Request) {
  const userId = await requireUser(request);
  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { currentPassword, newPassword, confirmPassword } = body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json(
      { error: 'Todos los campos son obligatorios' },
      { status: 400 }
    );
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: 'La nueva contraseña debe tener al menos 8 caracteres' },
      { status: 400 }
    );
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { error: 'La nueva contraseña y la confirmación no coinciden' },
      { status: 400 }
    );
  }

  if (newPassword === currentPassword) {
    return NextResponse.json(
      { error: 'La nueva contraseña debe ser diferente a la actual' },
      { status: 400 }
    );
  }

  const profile = await queryOne<{ password_hash: string | null; must_change_password: boolean }>(
    'SELECT password_hash, must_change_password FROM public.profiles WHERE id = $1',
    [userId]
  );

  if (!profile || !profile.password_hash) {
    return NextResponse.json(
      { error: 'No se encontró la cuenta' },
      { status: 404 }
    );
  }

  const ok = await bcrypt.compare(currentPassword, profile.password_hash);
  if (!ok) {
    return NextResponse.json(
      { error: 'La contraseña actual es incorrecta' },
      { status: 401 }
    );
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await queryOne(
    `UPDATE public.profiles
     SET password_hash = $1, must_change_password = false, updated_at = now()
     WHERE id = $2`,
    [newHash, userId]
  );

  return NextResponse.json({ success: true });
}