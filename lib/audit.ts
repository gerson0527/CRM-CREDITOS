import { query } from '@/lib/db/pg';

export type AuditAction =
  | 'credit.status_change'
  | 'user.password_reset'
  | 'user.created'
  | 'user.role_change'
  | 'user.deleted'
  | 'sede.created'
  | 'sede.deleted'
  | 'sede.updated'
  | 'session.revoked_all'
  | 'auth.failed_login';

export interface AuditParams {
  /** Usuario que ejecuta la accion. null si fue un evento del sistema. */
  actor: { id: string } | null;
  action: AuditAction;
  /** Recurso afectado por la accion. */
  target?: { type: string; id: string };
  /** Datos relevantes del cambio (before/after, payload, etc). */
  diff?: Record<string, unknown>;
  /** Request opcional para extraer ip + user-agent. */
  request?: Request;
}

/**
 * Registra una entrada en public.audit_log.
 *
 * Fire-and-forget: nunca lanza errores al caller para no bloquear el
 * flujo principal. Si falla la insercion se loguea en consola pero la
 * operacion del usuario no se ve afectada (el commit en la DB objetivo
 * ya ocurrio o se hace en la misma transaccion por el caller).
 */
export async function audit(params: AuditParams): Promise<void> {
  const ip = params.request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? params.request?.headers.get('x-real-ip')
    ?? null;
  const userAgent = params.request?.headers.get('user-agent') ?? null;

  try {
    await query(
      `INSERT INTO public.audit_log
        (actor_id, action, target_type, target_id, diff, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [
        params.actor?.id ?? null,
        params.action,
        params.target?.type ?? null,
        params.target?.id ?? null,
        JSON.stringify(params.diff ?? {}),
        ip,
        userAgent,
      ]
    );
  } catch (err) {
    // No interrumpir el flujo principal si falla la auditoria.
    console.error('[audit] failed to write audit_log entry:', err);
  }
}
