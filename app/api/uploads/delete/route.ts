import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { getSessionUser } from '@/lib/auth/session';
import { canAccessCredit, creditIdFromKey } from '@/lib/auth/visibility';
import { deleteObjects } from '@/lib/storage';

/**
 * Borra objetos de S3 cuando el usuario quita un archivo del formulario.
 * Valida sesión y propiedad del key antes de borrar.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const keys = body.keys;
  if (!Array.isArray(keys) || keys.length === 0 || keys.length > 10) {
    return NextResponse.json({ error: 'keys inválidos' }, { status: 400 });
  }

  for (const key of keys) {
    if (typeof key !== 'string' || !key.startsWith('creditos/') || key.includes('..')) {
      return NextResponse.json({ error: 'Storage key inválido' }, { status: 400 });
    }
    const creditId = creditIdFromKey(key);
    if (!creditId) {
      return NextResponse.json({ error: 'Storage key inválido' }, { status: 400 });
    }
    if (creditId !== 'temp' && !(await canAccessCredit(user, creditId))) {
      return NextResponse.json({ error: 'No autorizado para borrar este archivo' }, { status: 403 });
    }
  }

  try {
    await deleteObjects(keys);
    return NextResponse.json({ ok: true, deleted: keys.length });
  } catch (err) {
    return apiError(err, 'Error al borrar el archivo.');
  }
}
