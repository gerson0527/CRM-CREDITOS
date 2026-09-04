import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { getSessionUser } from '@/lib/auth/session';
import { query } from '@/lib/db/pg';

interface ConfirmBody {
  credit_id: string;
  files: Array<{
    document_type: string;
    key: string;
    thumbKey?: string;
  }>;
}

/**
 * Persiste la metadata de los archivos subidos al crear un crédito.
 * En el modelo actual de `documents` (que ya existe) usamos el campo `file_url`
 * para guardar un JSON con {original, thumb}. Ajusta el esquema si tienes
 * campos separados como `storage_key` y `thumbnail_key`.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: ConfirmBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 });
  }

  const { credit_id, files } = body;
  if (!credit_id || !Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: 'credit_id y files requeridos' }, { status: 400 });
  }

  try {
    const values: unknown[] = [];
    const placeholders: string[] = [];
    files.forEach((f, i) => {
      const base = i * 4;
      placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`);
      values.push(
        credit_id,
        f.document_type,
        JSON.stringify({ original: f.key, thumb: f.thumbKey }),
        'pendiente'
      );
    });

    await query(
      `INSERT INTO public.documents (credit_id, document_type, file_url, status)
       VALUES ${placeholders.join(', ')}`,
      values
    );

    return NextResponse.json({ success: true, count: files.length });
  } catch (err) {
    return apiError(err);
  }
}