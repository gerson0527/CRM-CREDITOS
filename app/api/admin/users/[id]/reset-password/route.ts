import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSessionUser } from '@/lib/auth/session';
import { queryOne, withTransaction } from '@/lib/db/pg';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const caller = await getSessionUser();
  if (!caller) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (caller.role !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores pueden cambiar contraseñas' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { newPassword, mustChangePassword = true } = body;

  if (!params.id || !newPassword) {
    return NextResponse.json({ error: 'userId y newPassword requeridos' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Mínimo 8 caracteres' }, { status: 400 });
  }

  const target = await queryOne<{ id: string }>(
    'SELECT id FROM public.users WHERE id = $1',
    [params.id]
  );
  if (!target) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  const hash = await bcrypt.hash(newPassword, 10);

  await withTransaction(async (client) => {
    await client.query('UPDATE public.users SET password_hash = $1 WHERE id = $2', [hash, params.id]);
    await client.query(
      'UPDATE public.profiles SET must_change_password = $1 WHERE user_id = $2',
      [!!mustChangePassword, params.id]
    );
    await client.query(
      'UPDATE public.user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [params.id]
    );
  });

  return NextResponse.json({ success: true });
}
