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