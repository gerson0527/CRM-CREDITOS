import { NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth/session';
import { getDownloadUrl } from '@/lib/storage';

/**
 * Genera una URL de descarga a partir del key (sin pasar por DB).
 * Usado por ImagePreview para abrir/descargar el archivo original.
 */
export async function GET(request: Request) {
  const userId = getSessionUserFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  if (!key) {
    return NextResponse.json({ error: 'Falta key' }, { status: 400 });
  }

  try {
    const downloadUrl = await getDownloadUrl(key, 3600);
    return NextResponse.json({ downloadUrl, key });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}