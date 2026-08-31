import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { query, queryOne } from '@/lib/db/pg';
import { getVisibleAsesorIds } from '@/lib/auth/visibility';

type Table =
  | 'roles'
  | 'profiles'
  | 'financial_entities'
  | 'credit_types'
  | 'clients'
  | 'credits'
  | 'credit_status_history'
  | 'documents'
  | 'follow_ups';

const TABLE_LIST: Table[] = [
  'roles',
  'profiles',
  'financial_entities',
  'credit_types',
  'clients',
  'credits',
  'credit_status_history',
  'documents',
  'follow_ups',
];

const ALLOWED_COLUMNS: Record<Table, string[]> = {
  roles: ['id', 'slug', 'name', 'description', 'permissions', 'is_system', 'is_default', 'created_at'],
  profiles: ['id', 'full_name', 'phone', 'email', 'role', 'role_id', 'status', 'supervisor_id', 'monthly_goal', 'commission_rate', 'created_at', 'updated_at'],
  financial_entities: ['id', 'name', 'credit_types', 'avg_response_days', 'contact_name', 'contact_phone', 'active', 'created_at', 'credit_min_amount', 'credit_max_amount'],
  credit_types: ['id', 'name', 'min_amount', 'max_amount', 'default_rate', 'required_documents', 'active', 'created_at'],
  clients: ['id', 'first_name', 'last_name', 'document_number', 'phone', 'email', 'address', 'city', 'reported_income', 'personal_refs', 'created_by', 'created_at'],
  credits: ['id', 'client_id', 'asesor_id', 'entity_id', 'credit_type_id', 'status', 'requested_amount', 'approved_amount', 'term_months', 'rate', 'rejection_reason', 'created_at', 'updated_at', 'status_changed_at'],
  credit_status_history: ['id', 'credit_id', 'previous_status', 'new_status', 'changed_by', 'changed_at', 'comment'],
  documents: ['id', 'credit_id', 'document_type', 'file_url', 'status', 'uploaded_by', 'uploaded_at', 'reviewed_by', 'reviewed_at'],
  follow_ups: ['id', 'credit_id', 'asesor_id', 'channel', 'comment', 'contact_date', 'next_action_date', 'next_action_note', 'completed', 'created_at'],
};

const ALIASES: Record<string, string> = {
  client: 'clients',
  asesor: 'profiles',
  entity: 'financial_entities',
  credit_type: 'credit_types',
};

function isTable(s: string): s is Table {
  return TABLE_LIST.includes(s as Table);
}

/**
 * Verifica si el usuario tiene permiso para acceder o mutar un registro específico.
 */
async function verifyRecordAccess(tableKey: Table, recordId: string, user: { id: string; role: string }): Promise<boolean> {
  if (user.role === 'admin') return true;

  const visibleAsesorIds = await getVisibleAsesorIds(user as any);

  if (tableKey === 'profiles') {
    if (user.role === 'supervisor') {
      const target = await queryOne<{ id: string; supervisor_id: string | null }>(
        `SELECT id, supervisor_id FROM public.profiles WHERE id = $1`,
        [recordId]
      );
      return target?.id === user.id || target?.supervisor_id === user.id;
    }
    return recordId === user.id;
  }

  if (tableKey === 'clients') {
    const client = await queryOne<{ created_by: string | null }>(
      `SELECT created_by FROM public.clients WHERE id = $1`,
      [recordId]
    );
    if (!client || !client.created_by) return false;
    return visibleAsesorIds.includes(client.created_by);
  }

  if (tableKey === 'credits') {
    const credit = await queryOne<{ asesor_id: string | null }>(
      `SELECT asesor_id FROM public.credits WHERE id = $1`,
      [recordId]
    );
    if (!credit || !credit.asesor_id) return false;
    return visibleAsesorIds.includes(credit.asesor_id);
  }

  if (tableKey === 'follow_ups') {
    const followUp = await queryOne<{ asesor_id: string | null }>(
      `SELECT asesor_id FROM public.follow_ups WHERE id = $1`,
      [recordId]
    );
    if (!followUp || !followUp.asesor_id) return false;
    return visibleAsesorIds.includes(followUp.asesor_id);
  }

  if (tableKey === 'documents') {
    const doc = await queryOne<{ credit_id: string | null; uploaded_by: string | null }>(
      `SELECT credit_id, uploaded_by FROM public.documents WHERE id = $1`,
      [recordId]
    );
    if (!doc) return false;
    if (doc.uploaded_by && doc.uploaded_by === user.id) return true;
    if (doc.credit_id) {
      return verifyRecordAccess('credits', doc.credit_id, user);
    }
    return false;
  }

  if (tableKey === 'financial_entities' || tableKey === 'credit_types' || tableKey === 'roles') {
    return true; // Lectura pública para usuarios autenticados
  }

  return false;
}

export async function GET(_req: Request, { params }: { params: { table: string; id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const tableKey = (ALIASES[params.table] ?? params.table) as string;
  if (!isTable(tableKey)) return NextResponse.json({ error: 'Tabla no soportada' }, { status: 400 });
  
  if (tableKey === 'roles' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores pueden ver configuración de roles' }, { status: 403 });
  }

  const hasAccess = await verifyRecordAccess(tableKey, params.id, user);
  if (!hasAccess) {
    return NextResponse.json({ error: 'No tienes permiso para ver este registro' }, { status: 403 });
  }

  const allowedCols = ALLOWED_COLUMNS[tableKey as Table];
  const sql = `SELECT ${allowedCols.map((c) => `${tableKey}.${c}`).join(', ')} FROM public.${tableKey} WHERE ${tableKey}.id = $1 LIMIT 1`;

  try {
    const row = await queryOne(sql, [params.id]);
    return NextResponse.json({ row: row ?? null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: { table: string; id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const tableKey = (ALIASES[params.table] ?? params.table) as string;
  if (!isTable(tableKey)) return NextResponse.json({ error: 'Tabla no soportada' }, { status: 400 });

  // Solo administradores pueden modificar tablas maestras
  if ((tableKey === 'roles' || tableKey === 'financial_entities' || tableKey === 'credit_types') && user.role !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores pueden modificar este recurso' }, { status: 403 });
  }

  // Verificar propiedad/jerarquía sobre el registro
  const hasAccess = await verifyRecordAccess(tableKey, params.id, user);
  if (!hasAccess) {
    return NextResponse.json({ error: 'No tienes permiso para modificar este registro' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  // Protección contra escalamiento de privilegios en perfiles
  if (tableKey === 'profiles' && user.role !== 'admin') {
    const forbiddenFields = ['role', 'role_id', 'status', 'supervisor_id', 'commission_rate'];
    for (const field of forbiddenFields) {
      if (field in body) {
        return NextResponse.json(
          { error: `No tienes permisos para modificar el campo '${field}'` },
          { status: 403 }
        );
      }
    }
  }

  const allowedCols = ALLOWED_COLUMNS[tableKey as Table];
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(body)) {
    if (allowedCols.includes(k) && k !== 'id') {
      sets.push(`${k} = $${i++}`);
      values.push(v);
    }
  }
  if (sets.length === 0) return NextResponse.json({ error: 'Sin campos válidos para actualizar' }, { status: 400 });

  values.push(params.id);
  const sql = `UPDATE public.${tableKey} SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`;

  try {
    const rows = await query(sql, values);
    return NextResponse.json({ row: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { table: string; id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const tableKey = (ALIASES[params.table] ?? params.table) as string;
  if (!isTable(tableKey)) return NextResponse.json({ error: 'Tabla no soportada' }, { status: 400 });

  // Tablas críticas restringidas estrictamente a administradores
  if (
    (tableKey === 'roles' || tableKey === 'profiles' || tableKey === 'financial_entities' || tableKey === 'credit_types' || tableKey === 'credits') &&
    user.role !== 'admin'
  ) {
    return NextResponse.json({ error: 'Solo administradores pueden eliminar estos registros' }, { status: 403 });
  }

  // Verificar propiedad para clientes, documentos y follow_ups
  const hasAccess = await verifyRecordAccess(tableKey, params.id, user);
  if (!hasAccess) {
    return NextResponse.json({ error: 'No tienes permiso para eliminar este registro' }, { status: 403 });
  }

  try {
    await query(`DELETE FROM public.${tableKey} WHERE id = $1`, [params.id]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}