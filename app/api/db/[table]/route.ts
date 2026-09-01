import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { query } from '@/lib/db/pg';
import { buildClientsWhere, buildCreditsWhere, buildFollowUpsWhere } from '@/lib/auth/visibility';

type Table =
  | 'roles'
  | 'profiles'
  | 'financial_entities'
  | 'credit_types'
  | 'clients'
  | 'credits'
  | 'credit_status_history'
  | 'documents'
  | 'follow_ups'
  | 'sedes';

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
  'sedes',
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
  sedes: ['id', 'name', 'code', 'address', 'city', 'phone', 'manager_id', 'active', 'created_at'],
};

const ALIASES: Record<string, string> = {
  client: 'clients',
  asesor: 'profiles',
  entity: 'financial_entities',
  credit_type: 'credit_types',
};

const TABLE_NAME_TO_REAL: Record<string, string> = {
  credits: 'credits',
  follow_ups: 'follow_ups',
  documents: 'documents',
  credit_status_history: 'credit_status_history',
  profiles: 'profiles',
  clients: 'clients',
  financial_entities: 'financial_entities',
  credit_types: 'credit_types',
  roles: 'roles',
};

interface JoinRule {
  alias: string;
  table: Table;
  on: { source: string; target: string };
  columns: string[];
}

const JOIN_CONFIG: Partial<Record<Table, JoinRule[]>> = {
  credits: [
    { alias: 'client', table: 'clients', on: { source: 'client_id', target: 'id' }, columns: ['id', 'first_name', 'last_name', 'document_number', 'phone', 'email', 'city'] },
    { alias: 'asesor', table: 'profiles', on: { source: 'asesor_id', target: 'id' }, columns: ['id', 'full_name', 'phone'] },
    { alias: 'entity', table: 'financial_entities', on: { source: 'entity_id', target: 'id' }, columns: ['id', 'name'] },
    { alias: 'credit_type', table: 'credit_types', on: { source: 'credit_type_id', target: 'id' }, columns: ['id', 'name'] },
  ],
  follow_ups: [
    { alias: 'credit', table: 'credits', on: { source: 'credit_id', target: 'id' }, columns: ['id', 'status'] },
  ],
  documents: [
    { alias: 'credit', table: 'credits', on: { source: 'credit_id', target: 'id' }, columns: ['id'] },
  ],
  credit_status_history: [
    { alias: 'credit', table: 'credits', on: { source: 'credit_id', target: 'id' }, columns: ['id'] },
    { alias: 'changed_by_profile', table: 'profiles', on: { source: 'changed_by', target: 'id' }, columns: ['id', 'full_name'] },
  ],
  clients: [
    { alias: 'asesor', table: 'profiles', on: { source: 'created_by', target: 'id' }, columns: ['id', 'full_name'] },
  ],
  profiles: [
    { alias: 'role_config', table: 'roles', on: { source: 'role_id', target: 'id' }, columns: ['id', 'slug', 'name', 'permissions'] },
  ],
};

function isTable(s: string): s is Table {
  return TABLE_LIST.includes(s as Table);
}

export async function GET(request: Request, { params }: { params: { table: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const rawTable = params.table;
  const tableKey = ALIASES[rawTable] ?? rawTable;
  if (!isTable(tableKey)) {
    return NextResponse.json({ error: 'Tabla no soportada' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const selectCols = searchParams.get('select') || '*';
  const limit = parseInt(searchParams.get('limit') ?? '200', 10);
  const orderBy = searchParams.get('order_by');
  const orderDir = (searchParams.get('order') ?? 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const eq: Record<string, string> = {};
  searchParams.forEach((v, k) => {
    if (k.startsWith('eq.')) eq[k.slice(3)] = v;
  });

  const allowedCols = ALLOWED_COLUMNS[tableKey];

  // Parse select: puede incluir joins tipo "client:clients(*)" o "asesor:profiles!fk(id,full_name)"
  // Split por comas respetando paréntesis
  const selectParts: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of selectCols) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      if (buf.trim()) selectParts.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) selectParts.push(buf.trim());

  const selectColsOnly: string[] = [];
  const joins: JoinRule[] = [];
  const joinAliases: string[] = [];

  for (const part of selectParts) {
    if (part === '*') {
      selectColsOnly.push('*');
      continue;
    }
    const joinMatch = part.match(/^([a-z_][a-z0-9_]*):([a-z_][a-z0-9_]*)(?:!([a-z_][a-z0-9_]*))?\(([^)]*)\)$/);
    if (joinMatch) {
      const [, alias, table, , colsStr] = joinMatch;
      const realTable = ALIASES[table] ?? table;
      if (!isTable(realTable)) continue;
      const cols = colsStr === '*' ? ALLOWED_COLUMNS[realTable as Table] : colsStr.split(',').map((c) => c.trim()).filter(Boolean);
      const filtered = cols.filter((c) => ALLOWED_COLUMNS[realTable as Table].includes(c));
      const config = (JOIN_CONFIG[tableKey as Table] ?? []).find((j) => j.alias === alias);
      if (!config) continue;
      joins.push({ alias, table: realTable as Table, on: config.on, columns: filtered.length > 0 ? filtered : config.columns });
      joinAliases.push(alias);
    } else if (allowedCols.includes(part)) {
      selectColsOnly.push(part);
    }
  }

  // Construir SQL
  const baseSelect = selectColsOnly.length > 0
    ? (selectColsOnly.includes('*') ? `${tableKey}.*` : selectColsOnly.map((c) => `${tableKey}.${c}`).join(', '))
    : `${tableKey}.*`;

  const joinSelects: string[] = [];
  const joinClauses: string[] = [];
  for (const j of joins) {
    const jsonBuild = `json_build_object(${j.columns.map((c) => `'${c}', ${j.table}.${c}`).join(', ')}) AS ${j.alias}`;
    joinSelects.push(jsonBuild);
    joinClauses.push(`LEFT JOIN public.${j.table} AS ${j.table} ON ${tableKey}.${j.on.source} = ${j.table}.${j.on.target}`);
  }

  const selectSql = [baseSelect, ...joinSelects].filter(Boolean).join(', ');

  let whereSql = '1=1';
  const sqlParams: unknown[] = [];

  if (tableKey === 'clients') {
    const w = await buildClientsWhere(user, sqlParams);
    whereSql = w.sql;
    sqlParams.push(...w.params);
  } else if (tableKey === 'credits' || tableKey === 'credit_status_history' || tableKey === 'documents') {
    const w = await buildCreditsWhere(user, sqlParams);
    whereSql = w.sql;
    sqlParams.push(...w.params);
  } else if (tableKey === 'follow_ups') {
    const w = await buildFollowUpsWhere(user, sqlParams);
    whereSql = w.sql;
    sqlParams.push(...w.params);
  }

  if (tableKey === 'profiles' && user.role !== 'admin') {
    if (user.role === 'supervisor') {
      whereSql += ` AND (${tableKey}.id = $${sqlParams.length + 1} OR ${tableKey}.supervisor_id = $${sqlParams.length + 1})`;
      sqlParams.push(user.id);
    } else {
      whereSql += ` AND ${tableKey}.id = $${sqlParams.length + 1}`;
      sqlParams.push(user.id);
    }
  }
  if (tableKey === 'roles' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Solo admin puede ver roles' }, { status: 403 });
  }

  for (const [col, val] of Object.entries(eq)) {
    if (!allowedCols.includes(col)) continue;
    whereSql += ` AND ${tableKey}.${col} = $${sqlParams.length + 1}`;
    sqlParams.push(val);
  }

  let sql = `SELECT ${selectSql} FROM public.${tableKey} ${joinClauses.join(' ')} WHERE ${whereSql}`;
  if (orderBy && allowedCols.includes(orderBy)) {
    sql += ` ORDER BY ${tableKey}.${orderBy} ${orderDir}`;
  }
  if (!Number.isNaN(limit) && limit > 0) {
    sql += ` LIMIT ${Math.min(limit, 500)}`;
  }

  try {
    const rows = await query(sql, sqlParams);
    return NextResponse.json({ rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: { table: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const rawTable = params.table;
  const tableKey = ALIASES[rawTable] ?? rawTable;
  if (!isTable(tableKey)) {
    return NextResponse.json({ error: 'Tabla no soportada' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const allowedCols = ALLOWED_COLUMNS[tableKey];
  const cols: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(body)) {
    if (allowedCols.includes(k)) {
      cols.push(k);
      values.push(v);
    }
  }

  // Restricciones: clients se asignan a sí mismo
  if (tableKey === 'clients' && !body.created_by) {
    cols.push('created_by');
    values.push(user.id);
  }
  if (tableKey === 'credits' && !body.asesor_id) {
    cols.push('asesor_id');
    values.push(user.id);
  }
  if (tableKey === 'follow_ups' && !body.asesor_id) {
    cols.push('asesor_id');
    values.push(user.id);
  }

  // Bloquear creación de roles/permisos a no-admin
  if (tableKey === 'roles' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Solo admin' }, { status: 403 });
  }

  if (cols.length === 0) {
    return NextResponse.json({ error: 'Sin campos para insertar' }, { status: 400 });
  }

  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO public.${tableKey} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`;

  try {
    const rows = await query(sql, values);
    return NextResponse.json({ row: rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}