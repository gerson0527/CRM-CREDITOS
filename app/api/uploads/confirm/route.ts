import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { getSessionUser } from '@/lib/auth/session';
import { query } from '@/lib/db/pg';
import { canAccessCredit, creditIdFromKey } from '@/lib/auth/visibility';

interface ConfirmBody {
  credit_id: string;
  files: Array<{
    document_type: string;
    key: string;
    thumbKey?: string;
  }>;
}

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

  // Verificación de autorización BOLA (API1:2023)
  const hasAccess = await canAccessCredit(user, credit_id);
  if (!hasAccess) {
    return NextResponse.json(
      { error: 'No autorizado sobre este crédito' },
      { status: 403 }
    );
  }

  // Validar coincidencia de storage key con credit_id si aplica
  for (const f of files) {
    const keyCreditId = creditIdFromKey(f.key);
    if (keyCreditId && keyCreditId !== 'temp' && keyCreditId !== credit_id) {
      return NextResponse.json(
        { error: 'La clave de almacenamiento no coincide con el crédito indicado' },
        { status: 400 }
      );
    }
  }

  try {
    const values: unknown[] = [];
    const placeholders: string[] = [];
    files.forEach((f, i) => {
      const base = i * 5;
      placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
      values.push(
        credit_id,
        f.document_type,
        JSON.stringify({ original: f.key, thumb: f.thumbKey }),
        'pendiente',
        user.id
      );
    });

    await query(
      `INSERT INTO public.documents (credit_id, document_type, file_url, status, uploaded_by)
       VALUES ${placeholders.join(', ')}`,
      values
    );

    return NextResponse.json({ success: true, count: files.length });
  } catch (err) {
    return apiError(err);
  }
}