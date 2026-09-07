import { NextResponse } from 'next/server';

function sanitizeErrorMessage(msg: string): string {
  // Redactar direcciones de email (PII)
  const redactedEmail = msg.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
  // Redactar cadenas de conexión o passwords en URLs de DB
  const redactedUrl = redactedEmail.replace(/postgres(?:ql)?:\/\/[^@]+@/gi, 'postgres://[REDACTED_CREDS]@');
  return redactedUrl;
}

/**
 * Manejo centralizado de errores de API.
 * Detecta violaciones de restricciones de base de datos (claves duplicadas, llaves foráneas)
 * y devuelve mensajes comprensibles para el usuario con códigos HTTP 409 / 400 en lugar de un error 500 genérico.
 */
export function apiError(err: unknown, fallback = 'Error interno. Intenta nuevamente.'): NextResponse {
  const pgErr = err as { code?: string; constraint?: string; message?: string; detail?: string };
  const rawMsg = pgErr?.message || (err instanceof Error ? err.message : String(err));
  const constraint = pgErr?.constraint || '';
  const code = pgErr?.code;

  // Llave duplicada / Unique constraint (PostgreSQL 23505)
  if (code === '23505' || /llave duplicada|unique constraint|duplicate key/i.test(rawMsg)) {
    if (constraint.includes('document_number') || /document_number|clients_document_number/i.test(rawMsg)) {
      return NextResponse.json(
        { error: 'Ya existe un cliente registrado con ese número de documento.' },
        { status: 409 }
      );
    }
    if (constraint.includes('email') || /email|users_email/i.test(rawMsg)) {
      return NextResponse.json(
        { error: 'El correo electrónico ya se encuentra registrado.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Ya existe un registro con estos datos únicos en el sistema.' },
      { status: 409 }
    );
  }

  // Clave foránea inexistente (PostgreSQL 23503)
  if (code === '23503' || /violates foreign key|llave foránea/i.test(rawMsg)) {
    return NextResponse.json(
      { error: 'La referencia indicada no existe o no es válida.' },
      { status: 400 }
    );
  }

  // Not Null violation (PostgreSQL 23502)
  if (code === '23502' || /violates not-null|valor nulo/i.test(rawMsg)) {
    return NextResponse.json(
      { error: 'Faltan campos obligatorios para guardar el registro.' },
      { status: 400 }
    );
  }

  console.error('[api-error]', sanitizeErrorMessage(rawMsg));
  return NextResponse.json({ error: fallback }, { status: 500 });
}
