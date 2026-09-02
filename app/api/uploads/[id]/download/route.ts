import { NextResponse } from 'next/server';
import { getSessionUserFromRequest } from '@/lib/auth/session';
import { getDownloadUrl } from '@/lib/storage';
import { queryOne } from '@/lib/db/pg';

/**
 * Genera una URL firmada de descarga a partir del ID de un documento.
 * Busca el `file_url` en la DB y genera la URL on-demand.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const userId = getSessionUserFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const doc = await queryOne<{ file_url: string; credit_id: string }>(
    `SELECT file_url, credit_id FROM public.documents WHERE id = $1 LIMIT 1`,
    [params.id]
  );

  if (!doc || !doc.file_url) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  }

  let key = doc.file_url;
  try {
    const parsed = JSON.parse(doc.file_url);
    if (parsed && typeof parsed === 'object' && 'original' in parsed) {
      key = parsed.original;
    }
  } catch {
    // Not JSON, treat as direct key
  }

  try {
    const downloadUrl = await getDownloadUrl(key, 3600);
    return NextResponse.json({ downloadUrl, key });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}