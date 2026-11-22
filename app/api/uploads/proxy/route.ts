import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { getSessionUser } from '@/lib/auth/session';
import { canAccessCredit, creditIdFromKey } from '@/lib/auth/visibility';
import { isAllowedMimeType, uploadObject } from '@/lib/storage';

const MAX_SIZE = parseInt(process.env.STORAGE_MAX_FILE_SIZE_MB || '10', 10) * 1024 * 1024;

/**
 * Subida alternativa cuando el bucket S3 no tiene CORS configurado: el
 * navegador envía el archivo a esta ruta (mismo origen) y el servidor hace
 * el PUT al bucket con las credenciales de la app.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const key = request.headers.get('x-upload-key');
  const contentType = (request.headers.get('content-type') || '').split(';')[0].trim();
  if (!key || !contentType) {
    return NextResponse.json({ error: 'Faltan x-upload-key o Content-Type' }, { status: 400 });
  }
  if (!isAllowedMimeType(contentType)) {
    return NextResponse.json({ error: `Tipo de archivo no permitido: ${contentType}` }, { status: 400 });
  }

  const creditId = creditIdFromKey(key);
  if (!creditId) {
    return NextResponse.json({ error: 'Storage key inválido' }, { status: 400 });
  }
  if (creditId !== 'temp' && !(await canAccessCredit(user, creditId))) {
    return NextResponse.json({ error: 'No autorizado para subir archivos a este crédito' }, { status: 403 });
  }

  const body = new Uint8Array(await request.arrayBuffer());
  if (body.length > MAX_SIZE) {
    return NextResponse.json({ error: 'Archivo demasiado grande' }, { status: 413 });
  }

  try {
    await uploadObject(key, body, contentType);
    return NextResponse.json({ ok: true, key });
  } catch (err) {
    return apiError(err, 'Error al subir el archivo.');
  }
}
