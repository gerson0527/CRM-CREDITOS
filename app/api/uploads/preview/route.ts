import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { getSessionUser } from '@/lib/auth/session';
import { canAccessCredit, creditIdFromKey } from '@/lib/auth/visibility';
import { getDownloadUrl } from '@/lib/storage';

/**
 * Genera una URL firmada a partir de un key directo (sin DB).
 * Usado por FileUpload (preview del thumb) e ImagePreview.
 * Verifica ownership del crédito salvo para subidas en curso (`temp`).
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  const expires = Math.min(parseInt(searchParams.get('expires') || '3600', 10) || 3600, 3600);

  if (!key) {
    return NextResponse.json({ error: 'Falta el parámetro key' }, { status: 400 });
  }

  const creditId = creditIdFromKey(key);
  if (creditId && creditId !== 'temp' && !(await canAccessCredit(user, creditId))) {
    return NextResponse.json({ error: 'No tienes permiso para ver este archivo' }, { status: 403 });
  }

  try {
    const url = await getDownloadUrl(key, expires);
    return NextResponse.json({ url, expiresInSeconds: expires });
  } catch (err) {
    return apiError(err);
  }
}