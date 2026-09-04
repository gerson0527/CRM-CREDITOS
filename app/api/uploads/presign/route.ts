import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { getSessionUser } from '@/lib/auth/session';
import { getUploadUrl, generateKey, isAllowedMimeType, isImage } from '@/lib/storage';

interface PresignBody {
  filename: string;
  contentType: string;
  documentType: string;
  entityId?: string;
  variant?: 'thumb' | 'main';
  rootFolder?: string;
}

const MAX_FILE_SIZE = parseInt(process.env.STORAGE_MAX_FILE_SIZE_MB || '10', 10) * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: PresignBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });
  }

  const { filename, contentType, documentType, entityId, variant, rootFolder = 'creditos' } = body;

  if (!filename || !contentType || !documentType) {
    return NextResponse.json(
      { error: 'filename, contentType y documentType son requeridos' },
      { status: 400 }
    );
  }

  if (!isAllowedMimeType(contentType)) {
    return NextResponse.json(
      { error: `Tipo de archivo no permitido: ${contentType}. Solo se aceptan imágenes (jpg/png/webp) y PDF.` },
      { status: 400 }
    );
  }

  const key = generateKey({
    rootFolder,
    documentType,
    filename,
    entityId,
    variant,
  });

  try {
    const presigned = await getUploadUrl(key, contentType, 300);
    return NextResponse.json({
      ...presigned,
      maxSize: MAX_FILE_SIZE,
      isImage: isImage(contentType),
    });
  } catch (err) {
    return apiError(err, 'Error al generar URL de subida.');
  }
}