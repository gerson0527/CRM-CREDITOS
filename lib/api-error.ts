import { NextResponse } from 'next/server';

/**
 * Respuesta de error genérica para fallos internos (DB, storage, etc.).
 * Registra el detalle solo en el log del servidor para no filtrar
 * estructura de tablas, constraints ni connection strings al cliente.
 */
export function apiError(err: unknown, fallback = 'Error interno. Intenta nuevamente.'): NextResponse {
  console.error('[api-error]', err instanceof Error ? err.message : err);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
