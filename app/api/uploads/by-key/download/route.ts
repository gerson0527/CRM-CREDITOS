import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { getSessionUser } from '@/lib/auth/session';
import { getDownloadUrl } from '@/lib/storage';

/**
 * Genera una URL de descarga a partir del key (sin pasar por DB).
 * Usado por ImagePreview para abrir/descargar el archivo original.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Solo el administrador puede descargar archivos' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'Falta key' }, { status: 400 });
  }

  try {
    const downloadUrl = await getDownloadUrl(key, 3600);
    return NextResponse.json({ downloadUrl, key });
  } catch (err) {
    return apiError(err);
  }
}