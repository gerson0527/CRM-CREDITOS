import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSessionUser } from '@/lib/auth/session';
import { queryOne } from '@/lib/db/pg';

export async function POST(request: Request) {
  // Ruta de remediación: permite sesión con cambio pendiente (para eso existe).
  const session = await getSessionUser({ allowStalePassword: true });
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const userId = session.id;

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

  // Fuente única de verdad para login: public.users.password_hash
  const account = await queryOne<{ password_hash: string | null }>(
    'SELECT password_hash FROM public.users WHERE id = $1',
    [userId]
  );

  if (!account || !account.password_hash) {
    return NextResponse.json(
      { error: 'No se encontró la cuenta' },
      { status: 404 }
    );
  }

  const ok = await bcrypt.compare(currentPassword, account.password_hash);
  if (!ok) {
    return NextResponse.json(
      { error: 'La contraseña actual es incorrecta' },
      { status: 401 }
    );
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await queryOne(
    `UPDATE public.users SET password_hash = $1 WHERE id = $2`,
    [newHash, userId]
  );
  await queryOne(
    `UPDATE public.profiles SET must_change_password = false, updated_at = now() WHERE user_id = $1`,
    [userId]
  );

  return NextResponse.json({ success: true });
}