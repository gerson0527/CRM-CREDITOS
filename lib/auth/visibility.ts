import type { SessionUser } from '@/lib/auth/session';
import { queryOne } from '@/lib/db/pg';

/**
 * Devuelve los IDs de asesores visibles para el usuario actual.
 * - admin: ve todos
 * - supervisor: ve su equipo
 * - asesor: se ve solo a sí mismo
 */
export async function getVisibleAsesorIds(user: SessionUser): Promise<string[]> {
  if (user.role === 'admin') {
    const rows = await queryOne<{ ids: string[] }>(
      `SELECT array_agg(id) AS ids FROM public.profiles WHERE role = 'asesor' AND status = 'activo'`
    );
    return rows?.ids ?? [];
  }
  if (user.role === 'supervisor') {
    const rows = await queryOne<{ ids: string[] }>(
      `SELECT array_agg(id) AS ids FROM public.profiles WHERE supervisor_id = $1 AND status = 'activo'`,
      [user.id]
    );
    return [user.id, ...(rows?.ids ?? [])];
  }
  return [user.id];
}

/**
 * Construye la cláusula WHERE para `clients.created_by` según el rol.
 */
export async function buildClientsWhere(user: SessionUser, params: unknown[] = []): Promise<{ sql: string; params: unknown[] }> {
  const ids = await getVisibleAsesorIds(user);
  if (user.role === 'admin') return { sql: '1=1', params };
  if (ids.length === 0) return { sql: '1=0', params };
  return { sql: `created_by = ANY($${params.length + 1}::uuid[])`, params: [...params, ids] };
}

/**
 * Construye la cláusula WHERE para `credits.asesor_id` según el rol.
 */
export async function buildCreditsWhere(user: SessionUser, params: unknown[] = []): Promise<{ sql: string; params: unknown[] }> {
  const ids = await getVisibleAsesorIds(user);
  if (user.role === 'admin') return { sql: '1=1', params };
  if (ids.length === 0) return { sql: '1=0', params };
  return { sql: `asesor_id = ANY($${params.length + 1}::uuid[])`, params: [...params, ids] };
}

/**
 * Construye la cláusula WHERE para `follow_ups.asesor_id` según el rol.
 */
export async function buildFollowUpsWhere(user: SessionUser, params: unknown[] = []): Promise<{ sql: string; params: unknown[] }> {
  const ids = await getVisibleAsesorIds(user);
  if (user.role === 'admin') return { sql: '1=1', params };
  if (ids.length === 0) return { sql: '1=0', params };
  return { sql: `asesor_id = ANY($${params.length + 1}::uuid[])`, params: [...params, ids] };
}

/**
 * Construye la cláusula WHERE para tablas que cuelgan de un crédito
 * (documents, credit_status_history). Se filtra por créditos visibles:
 * si el crédito pertenece a un asesor del scope, sus documentos son visibles.
 */
export async function buildCreditChildWhere(user: SessionUser, params: unknown[] = []): Promise<{ sql: string; params: unknown[] }> {
  const ids = await getVisibleAsesorIds(user);
  if (user.role === 'admin') return { sql: '1=1', params };
  if (ids.length === 0) return { sql: '1=0', params };
  return {
    sql: `credit_id IN (SELECT id FROM public.credits WHERE asesor_id = ANY($${params.length + 1}::uuid[]))`,
    params: [...params, ids],
  };
}

/**
 * ¿Puede este usuario ver un crédito concreto? (para firmar URLs de archivos).
 * Las keys con segmento `temp` son subidas en curso (UUID de 128 bits,
 * no adivinables) y se permiten a cualquier usuario autenticado.
 */
export async function canAccessCredit(user: SessionUser, creditId: string): Promise<boolean> {
  if (user.role === 'admin') return true;
  const ids = await getVisibleAsesorIds(user);
  if (ids.length === 0) return false;
  const row = await queryOne<{ ok: string }>(
    `SELECT 1 AS ok FROM public.credits WHERE id = $1 AND asesor_id = ANY($2::uuid[])`,
    [creditId, ids]
  );
  return !!row;
}

/** Extrae el creditId de un storage key `creditos/{creditId|temp}/...`. */
export function creditIdFromKey(key: string): string | null {
  const m = /^creditos\/([^/]+)\//.exec(key);
  return m ? m[1] : null;
}