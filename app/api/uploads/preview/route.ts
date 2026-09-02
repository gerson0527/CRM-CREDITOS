import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { getDownloadUrl } from '@/lib/storage';

/**
 * Genera una URL firmada a partir de un key directo (sin DB).
 * Usado por FileUpload (preview del thumb) e ImagePreview.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  const expires = parseInt(searchParams.get('expires') || '3600', 10);

  if (!key) {
    return NextResponse.json({ error: 'Falta el parámetro key' }, { status: 400 });
  }

  try {
    const url = await getDownloadUrl(key, expires);
    return NextResponse.json({ url, expiresInSeconds: expires });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}