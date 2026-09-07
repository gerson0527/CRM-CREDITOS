# Auditoría OWASP API Security Top 10 (2023)

**Alcance:** `app/api/**` (excepto `app/creditos/page.tsx` y `app/usuarios/page.tsx`), `lib/auth/*`, `lib/api-error.ts`, `next.config.js`, `supabase/migration_user_sessions.sql`, `package.json`.
**Stack real:** Next.js 13.5 (App Router) · PostgreSQL 18 (driver `pg`) · bcryptjs 3 · cookies de sesión HMAC-SHA256 con server-side revocation table.
**Resultado:** 0 CRÍTICAS · 4 ALTAS · 8 MEDIAS · 7 BAJAS.

---

## 1 · ALTA · API1:2023 — BOLA en `confirm` de uploads

**Ubicación:** `app/api/uploads/confirm/route.ts:21-58`
**OWASP:** API1:2023 (Broken Object Level Authorization)

**Escenario real:**
Un asesor autenticado envía `POST /api/uploads/confirm` con `credit_id = "<uuid-de-credito-de-otro-asesor>"`. El handler solo verifica `getSessionUser()` y hace `INSERT INTO public.documents` con ese `credit_id` arbitrario, sin comprobar que el crédito pertenece a su scope (asesor_id = yo o visibleAsesorIds). El documento queda asociado al crédito ajeno con `uploaded_by` NULL y `status='pendiente'`. Después cualquier supervisor del crédito ajeno (o el propio dueño) lo verá en su lista y podrá aprobarlo.

**Código actual (extracto, líneas 21-58):**
```ts
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  // ...
  const { credit_id, files } = body;
  // ⚠️ No ownership check sobre credit_id
  await query(
    `INSERT INTO public.documents (credit_id, document_type, file_url, status) VALUES ...`,
    values
  );
}
```

**Solución propuesta:**
```ts
import { canAccessCredit } from '@/lib/auth/visibility';
// ...
if (!(await canAccessCredit(user, credit_id))) {
  return NextResponse.json({ error: 'No autorizado sobre este crédito' }, { status: 403 });
}
// además, también validar que el prefijo del storage key coincide con credit_id
const creditIdInKey = creditIdFromKey(f.key);
if (creditIdInKey && creditIdInKey !== 'temp' && creditIdInKey !== credit_id) {
  return NextResponse.json({ error: 'storage key no coincide con credit_id' }, { status: 400 });
}
```

**Cómo prevenir el patrón:** Centralizar la verificación de visibilidad (ya existe `canAccessCredit` en `lib/auth/visibility.ts`) e invocarla en TODA ruta que reciba un `credit_id` o `client_id` del cliente, antes de cualquier escritura. Regla: ninguna ruta POST/PATCH/DELETE puede confiar en IDs ajenos al usuario sin pasar por un guard.

---

## 2 · ALTA · API3:2023 — Mass assignment en `POST /api/db/[table]` (credits / clients / follow_ups / documents)

**Ubicación:** `app/api/db/[table]/route.ts:231-285`
**OWASP:** API3:2023 (Broken Object Property Level Authorization)

**Escenario real:**
Cualquier asesor autenticado hace `POST /api/db/credits` con body `{"client_id":"...","entity_id":"...","credit_type_id":"...","requested_amount":1000,"asesor_id":"<uuid-de-otra-persona>"}`. El handler hace fallback a `user.id` si el campo no viene, pero **si el cliente lo envía, lo respeta** (líneas 257-264). El crédito queda asignado a otro asesor — robo/encubrimiento de leads. Mismo patrón en `clients.created_by` (línea 253) y `follow_ups.asesor_id` (línea 261). En `documents` no hay ninguna asignación automática (línea 245-249 acepta cualquier `uploaded_by`, `credit_id`, `reviewed_by`).

**Código actual (líneas 245-264):**
```ts
for (const [k, v] of Object.entries(body)) {
  if (allowedCols.includes(k)) {
    cols.push(k);
    values.push(v);          // ⚠️ acepta cualquier valor permitido
  }
}
if (tableKey === 'clients' && !body.created_by) {
  cols.push('created_by'); values.push(user.id);
}
if (tableKey === 'credits' && !body.asesor_id) {
  cols.push('asesor_id'); values.push(user.id);
}
```

**Solución propuesta:**
```ts
const OWNERSHIP_FIELDS: Record<Table, string[]> = {
  clients: ['created_by'],
  credits: ['asesor_id'],
  follow_ups: ['asesor_id'],
  documents: ['uploaded_by', 'reviewed_by'],
  // profiles, roles, sedes, financial_entities, credit_types: forzar admin en otro guard
};

const forceFields = OWNERSHIP_FIELDS[tableKey] ?? [];
for (const f of forceFields) {
  if (!allowedCols.includes(f)) continue;
  // ⚠️ siempre SOBREESCRIBIR, no respetar body:
  cols.push(f); values.push(user.id);
}
// limpiar del body cualquier asignación que el cliente haya intentado:
const safeBody = Object.fromEntries(Object.entries(body).filter(([k]) => !forceFields.includes(k)));
// luego iterar safeBody en lugar de body
```

Para `documents`, además validar `credit_id` con `canAccessCredit` (ver hallazgo #1).

**Cómo prevenir el patrón:** Whitelist explícito de campos "owner-controlled" que SIEMPRE se sobrescriben con el `user.id`. Prohibir cualquier override desde el body. Aplicar en build-time con un test que itere todas las rutas POST y verifique el patrón.

---

## 3 · ALTA · API8:2023 — Recolección ilimitada de datos (sin paginación)

**Ubicación:** `app/api/db/[table]/route.ts:111-225`
**OWASP:** API8:2023 (Security Misconfiguration) / API4:2023 (Unrestricted Resource Consumption)

**Escenario real:**
Un asesor autenticado hace `GET /api/db/credits?limit=500` y recibe **todos** los créditos visibles en una sola respuesta (sin `offset`/cursor). A 80 créditos no pasa nada; con 80k, la respuesta pesa MB y satura memoria, conexión DB y red. Combinado con ausencia de rate limit en GET, un atacante puede enumerar la base de clientes completa con un solo request por página.

**Código actual (líneas 111-225):**
```ts
const limit = parseInt(searchParams.get('limit') ?? '200', 10);
// ...
sql += ` LIMIT ${Math.min(limit, 500)}`;
// ⚠️ sin OFFSET ni cursor; sin rate limit
```

**Solución propuesta:**
```ts
const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 200);
const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);
// alternativa cursor-based con (created_at, id) para estabilidad
sql += ` LIMIT ${limit} OFFSET ${offset}`;
// además devolver total para que el front construya el paginador
return NextResponse.json({ rows, total, limit, offset });
```
Y en `next.config.js` o un middleware: rate limit por usuario para endpoints GET sensibles (p.ej. 60 req/min).

**Cómo prevenir el patrón:** Cualquier endpoint que devuelva una colección debe (a) tener un cap absoluto de página (50-200), (b) usar paginación cursor o offset, (c) loggear si un usuario pide el cap repetidamente. Plantilla: `paginate(query, default=50, max=200)`.

---

## 4 · ALTA · API2:2023 — `reset-password` no transaccional + revoke prematuro

**Ubicación:** `app/api/admin/users/[id]/reset-password/route.ts:25-42`
**OWASP:** API2:2023 (Broken Authentication)

**Escenario real:**
Un admin resetea la contraseña de un usuario. La línea 34 actualiza `public.users.password_hash`. Si la línea 36-38 (UPDATE `public.profiles`) o la línea 40 (`revokeAllSessions`) fallan por timeout de DB o constraint, el usuario queda con: contraseña cambiada, `must_change_password` aún en su valor anterior (true o false), y todas sus sesiones previas revocadas o no según dónde haya cortado. El operador no recibe señal clara del fallo parcial.

**Código actual (líneas 33-40):**
```ts
const hash = await bcrypt.hash(newPassword, 10);
await query('UPDATE public.users SET password_hash = $1 WHERE id = $2', [hash, params.id]);
await query(
  'UPDATE public.profiles SET must_change_password = $1 WHERE user_id = $2',
  [!!mustChangePassword, params.id]
);
await revokeAllSessions(params.id);   // ⚠️ aunque algo haya fallado arriba
```

**Solución propuesta:**
```ts
const hash = await bcrypt.hash(newPassword, 10);
const client = await getPool().connect();
try {
  await client.query('BEGIN');
  await client.query('UPDATE public.users SET password_hash = $1 WHERE id = $2', [hash, params.id]);
  await client.query(
    'UPDATE public.profiles SET must_change_password = $1 WHERE user_id = $2',
    [!!mustChangePassword, params.id]
  );
  await client.query(
    `UPDATE public.user_sessions SET revoked_at = now()
       WHERE user_id = $1 AND revoked_at IS NULL`,
    [params.id]
  );
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
// auditoría: insertar en public.audit_log (admin_id, action='reset_password', target_id, ip, ts)
```

**Cómo prevenir el patrón:** Toda mutación que toque más de una tabla o que invalide sesiones debe ir en una transacción. Plantilla: `withTx(async (c) => { ... })` en `lib/db/pg.ts`. Audit log para acciones privilegiadas.

---

## 5 · MEDIA · API2:2023 — Rate limiter de login es in-memory y no escala

**Ubicación:** `app/api/auth/login/route.ts:11-56`
**OWASP:** API2:2023 (Broken Authentication)

**Escenario real:**
El `Map<string, RateLimitEntry>` se reinicia con el proceso y no se comparte entre instancias. En producción con Vercel/Netlify o múltiples workers, cada réplica tiene su propio contador → un atacante distribuye 5*N requests en N instancias y evade el cap. Además la entrada nunca se elimina al expirar → la memoria crece monótonamente.

**Código actual (líneas 11-56):**
```ts
const loginAttempts = new Map<string, RateLimitEntry>();
function recordFailedAttempt(key: string) {
  // sin cleanup del entry expirado al fallar de nuevo
}
```

**Solución propuesta:**
Migrar a una tabla `public.login_attempts (key text, attempts int, reset_at timestamptz, PRIMARY KEY(key))` con UPSERT y `WHERE reset_at > now()`. Limpiar con un cron cada hora. Ventajas: stateless para el proceso, consistente entre réplicas, auditable.

Adicional: añadir `Retry-After` header también en 200 responses que limpian el cap para no romper health checks.

**Cómo prevenir el patrón:** Cualquier rate limit en producción debe vivir en un store compartido (Redis o tabla SQL). Documentar en `lib/rate-limit.ts` con interfaz `rateLimit(key, limit, window)`.

---

## 6 · MEDIA · API1:2023 — `change-password` permite cambio con sesión revocada aún válida

**Ubicación:** `app/api/auth/change-password/route.ts:9-12`, `lib/auth/session.ts:151-200`
**OWASP:** API1:2023 / API2:2023

**Escenario real:**
Un usuario tiene cookie robada y `must_change_password=true`. Un atacante (con cookie) entra a `change-password`, valida `currentPassword` (que ya conoce por otro vector o por phishing), pone nueva clave, y pasa `must_change_password=false`. Su sesión sigue siendo válida (correcto). Pero: si la cookie del atacante está revocada en `user_sessions.revoked_at` pero la cookie robada aún no ha sido detectada y revocada, el atacante puede cambiar la contraseña sin que el usuario legítimo lo sepa. Además `getSessionUser({ allowStalePassword: true })` en línea 9 hace bypass completo del check de `must_change_password`, lo cual es necesario para esta ruta pero peligroso si se reutiliza.

**Código actual (líneas 7-12):**
```ts
export async function POST(request: Request) {
  const session = await getSessionUser({ allowStalePassword: true });
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
```

**Solución propuesta:**
- Añadir a `getSessionUser` un parámetro `requireNonRevoked` o crear un helper `getStrictSessionUser` que **no** permita `allowStalePassword`.
- En `change-password`, verificar adicionalmente que la sesión actual no tiene más de N minutos de antigüedad desde `last_seen_at`. Si tiene más de X minutos, forzar re-login con la contraseña actual (defensa contra cookie robada dormida).
- Loggear cada `change-password` en `public.audit_log` con IP, UA, timestamp.

**Cómo prevenir el patrón:** Toda ruta privilegiada debe pedir explícitamente el nivel de sesión que necesita. Marcar `allowStalePassword` como API peligrosa y exigir revisión para su uso.

---

## 7 · MEDIA · API3:2023 — `POST /api/users` no es transaccional y acepta role arbitrario

**Ubicación:** `app/api/users/route.ts:82-117`
**OWASP:** API3:2023 / API8:2023

**Escenario real:**
Línea 87-92 inserta en `public.users`; si la línea 99-117 (insert en `public.profiles`) falla, el usuario queda sin perfil. `getSessionUser()` lo aceptará porque hace LEFT JOIN, pero `caller.role` será `null` → `requireAdmin` lo niega en otras rutas → usuario huérfano que no puede hacer login significativo. Además `role_id` se acepta sin validar que exista en `public.roles` ni que `slug=role` (línea 66-73). Un admin puede asignar un `role_id` que apunte a un rol "asesor" pero con `role: 'admin'` en el string, creando inconsistencia entre `p.role` (usado para auth) y `r.permissions` (usado para permisos granulares).

**Código actual (líneas 66-117):**
```ts
let resolvedRoleId = role_id;
if (!resolvedRoleId) {
  const roleData = await queryOne(`SELECT id FROM public.roles WHERE slug = $1`, [role]);
  resolvedRoleId = roleData?.id || null;
}
// ⚠️ si role_id viene del body, no se valida que exista ni que coincida con role
```

**Solución propuesta:**
```ts
// transacción:
const client = await getPool().connect();
try {
  await client.query('BEGIN');
  await client.query(`INSERT INTO public.users (email, password_hash, status) VALUES ($1,$2,'activo') RETURNING id`, [...]);
  // validar role_id ↔ slug:
  if (role_id) {
    const r = await client.query(`SELECT slug FROM public.roles WHERE id = $1`, [role_id]);
    if (!r.rows[0] || r.rows[0].slug !== role) throw new Error('role_id inconsistente con role');
  }
  await client.query(`INSERT INTO public.profiles (...) VALUES (...)`, [...]);
  await client.query('COMMIT');
} catch (e) { await client.query('ROLLBACK'); throw e; }
finally { client.release(); }
```

**Cómo prevenir el patrón:** Cualquier creación de usuario en dos tablas debe ir en `withTx`. Validar integridad referencial y semántica de los campos de role ANTES de escribir.

---

## 8 · MEDIA · API8:2023 — `lib/auth/session.ts` no limpia secrets deprecados ni migra hash de sesión al rotar `SESSION_SECRET`

**Ubicación:** `lib/auth/session.ts:5-12`
**OWASP:** API8:2023 (Security Misconfiguration) / A02:2021 (Cryptographic Failures)

**Escenario real:**
Si en producción se rota `SESSION_SECRET` (rotación de secrets, recuperación de incidente), TODAS las cookies en vuelo se invalidan de golpe (logout masivo). En el peor caso, si la rotación se hace en caliente y el proceso no se reinicia completamente, dos pods podrían firmar con secretos distintos durante minutos. Además, no hay forma de marcar sesiones viejas para invalidación selectiva.

**Código actual (líneas 5-12):**
```ts
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET no está configurado...');
  }
  console.warn('...usando secreto solo para desarrollo...');
}
const SECRET = SESSION_SECRET || 'dev-only-insecure-fallback-never-use-in-production';
```

**Solución propuesta:**
- Soporte de múltiples secrets con `kid` (key id): `SECRETS=kid1:secret1,kid2:secret2`. El firmador usa el primero, el verificador intenta todos (compatibilidad durante rotación).
- Endpoint admin para invalidar todas las sesiones por `user_id` o global (`UPDATE public.user_sessions SET revoked_at=now() WHERE revoked_at IS NULL`).
- Documentar `INVENTORY` de secretos en `docs/runbooks/secret-rotation.md`.

**Cómo prevenir el patrón:** Cualquier secreto usado para firmar tokens debe diseñarse con rotación en mente desde el día 1.

---

## 9 · MEDIA · API8:2023 — Logs pueden filtrar datos sensibles a stdout

**Ubicación:** `lib/api-error.ts:8-11`
**OWASP:** API8:2023 / A09:2021 (Logging Failures)

**Escenario real:**
`console.error('[api-error]', err instanceof Error ? err.message : err)`. Si los logs se reenvían a Datadog/Sentry/CloudWatch sin scrubbing, los `err.message` de Postgres pueden contener valores (p.ej. `duplicate key value violates unique constraint "users_email_key" DETAIL: Key (email)=(admin@x.com) already exists.`) → fuga de emails a un agregador que no esperaba PII.

**Código actual:**
```ts
export function apiError(err: unknown, fallback = 'Error interno...'): NextResponse {
  console.error('[api-error]', err instanceof Error ? err.message : err);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
```

**Solución propuesta:**
- Usar un logger con niveles (`pino` o `winston`) que:
  - tenga un `redact` list de paths (`email`, `password`, `token`, `cookie`, `authorization`),
  - escriba a stdout en JSON estructurado,
  - NO loguee el `err` completo en rutas de auth/registro, solo el `code` y `stack` separado.
- Para Postgres, loguear `err.code` (23505 unique_violation, 23503 fk_violation) en vez del `message`.

**Cómo prevenir el patrón:** Política: ningún log puede contener PII sin enmascarar. Plantilla `logger.error({ event, code, userId }, err)`.

---

## 10 · MEDIA · API3:2023 — `PATCH /api/sedes/[id]` permite cambiar `manager_id` a UUID arbitrario

**Ubicación:** `app/api/sedes/[id]/route.ts:21-54`
**OWASP:** API3:2023

**Escenario real:**
`ALLOWED = ['name','code','address','city','phone','active','manager_id']`. Un admin puede asignar `manager_id = '<uuid-de-usuario-que-no-existe-o-que-es-cliente>'` sin validación referencial. Resultado: sede "huérfana" que rompe el módulo de reportes por sede, o un cliente promovido indirectamente a manager.

**Código actual (líneas 21-39):**
```ts
const ALLOWED = ['name','code','address','city','phone','active','manager_id'];
// ...
for (const [k, v] of Object.entries(body)) {
  if (ALLOWED.includes(k)) {
    sets.push(`${k} = $${i++}`);
    values.push(v);
  }
}
```

**Solución propuesta:**
```ts
if (body.manager_id !== undefined) {
  const m = await queryOne(`SELECT id FROM public.profiles WHERE id = $1 AND role IN ('supervisor','admin')`, [body.manager_id]);
  if (!m) return NextResponse.json({ error: 'manager_id inválido' }, { status: 400 });
}
```
Y validación de FK adicional a nivel DB con `REFERENCES public.profiles(id) ON DELETE SET NULL`.

**Cómo prevenir el patrón:** Toda columna `*_id` en un whitelist de PATCH debe tener (a) FK en el schema, (b) validación de existencia+rol en el handler.

---

## 11 · MEDIA · API1:2023 — `DELETE /api/db/[table]/[id]` no verifica visibilidad para todas las tablas

**Ubicación:** `app/api/db/[table]/[id]/route.ts:205-232`
**OWASP:** API1:2023

**Escenario real:**
`verifyRecordAccess` para `credits`, `roles`, `profiles`, `financial_entities`, `credit_types` se cortocircuita a `admin only` en DELETE (línea 213-218), pero **no** para `clients`, `follow_ups`, `documents`. Si la lógica de `verifyRecordAccess` cambia (refactor), se rompe la garantía. Además, `clients` y `follow_ups` SÍ pasan por `verifyRecordAccess` (línea 220-224), pero `financial_entities` y `credit_types` también — y en GET (línea 115-117) están marcados como "lectura pública para usuarios autenticados". Si esa misma intención se replica en DELETE sin querer, sería un privilege escalation.

**Código actual (líneas 205-224):**
```ts
if (
  (tableKey === 'roles' || tableKey === 'profiles' || ...) &&
  user.role !== 'admin'
) {
  return NextResponse.json({ error: 'Solo administradores...' }, { status: 403 });
}
const hasAccess = await verifyRecordAccess(tableKey, params.id, user);
```

**Solución propuesta:**
Consolidar la lógica en `verifyRecordAccess` mismo: que la función devuelva `{ allowed: boolean, reason: 'admin-only' | 'not-owner' | 'ok' }` y que la ruta DELETE decida según `reason` en vez de tener dos checks paralelos que pueden divergir.

**Cómo prevenir el patrón:** Una sola fuente de verdad para "puede el usuario X operar sobre el registro Y de la tabla T". Test unitario que recorra el cross-product.

---

## 12 · MEDIA · API4:2023 — `presign` no tiene rate limit ni ownership check

**Ubicación:** `app/api/uploads/presign/route.ts:17-64`
**OWASP:** API4:2023

**Escenario real:**
Cualquier usuario autenticado puede pedir N URLs pre-firmadas (300s de expiración) con cualquier `entityId`, `documentType`, `filename`. No hay límite por minuto. Un atacante puede generar 1000 URLs/minuto apuntando a keys que no controla todavía pero que después intenta usar en `confirm` con un `credit_id` arbitrario (ver hallazgo #1). El bucket S3 puede llenarse de objetos huérfanos (DoS de storage).

**Código actual:**
```ts
const user = await getSessionUser();
if (!user) return ...;
// ⚠️ sin rate limit, sin validación de que el user puede operar sobre entityId/creditId
```

**Solución propuesta:**
```ts
// rate limit: 30 presign requests / 5min / user
await rateLimit(`presign:${user.id}`, 30, 5 * 60_000);
// además si body trae creditId implícito en entityId, validar canAccessCredit
```

**Cómo prevenir el patrón:** Cualquier endpoint que aloca recursos del lado del proveedor (S3, DB rows, emails) debe tener rate limit y ownership check.

---

## 13 · BAJA · API8:2023 — `next.config.js` no fuerza CSP

**Ubicación:** `next.config.js:11-25`
**OWASP:** API8:2023 / A05:2021

**Escenario real:**
HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy están bien. **Falta Content-Security-Policy**. Aunque la app es server-rendered y la mayoría de endpoints son JSON, el front-end `app/login/page.tsx` y otros forms pueden ser objetivo de XSS reflected/stored si alguna vez se renderiza HTML de usuario (comentarios de follow-ups, observaciones de créditos, etc.).

**Solución propuesta:**
```js
{
  key: 'Content-Security-Policy',
  value: "default-src 'self'; img-src 'self' data: blob: https://*.s3.amazonaws.com; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'self'; form-action 'self'; base-uri 'self'"
}
```
Ajustar `'unsafe-inline'` si se migra a nonces.

**Cómo prevenir el patrón:** Política de seguridad de headers por defecto en CI con `securityheaders.com` scan en cada PR.

---

## 14 · BAJA · API2:2023 — Hardcoded fallback de `SESSION_SECRET`

**Ubicación:** `lib/auth/session.ts:12`
**OWASP:** API2:2023

**Escenario real:**
Si alguien exporta `NODE_ENV=production` por error en una máquina de desarrollo sin `SESSION_SECRET`, el código lanza (línea 8). Bien. Pero si se ejecuta `next build` sin `NODE_ENV` (caso real de algunos pipelines), se cae al fallback `'dev-only-insecure-fallback-never-use-in-production'`. Si esa imagen se deploya sin el env, todas las sesiones son firmadas con un secreto público.

**Código actual:**
```ts
const SECRET = SESSION_SECRET || 'dev-only-insecure-fallback-never-use-in-production';
```

**Solución propuesta:**
```ts
if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET es obligatorio incluso en desarrollo.');
}
```
Forzar siempre. Si en CI no se quiere usar secreto real, generar uno efímero: `crypto.randomBytes(32).toString('hex')` al inicio del proceso de dev.

**Cómo prevenir el patrón:** Fail-closed siempre. Ningún secreto hardcoded como fallback.

---

## 15 · BAJA · API4:2023 — `Map` de rate limit crece sin bound

**Ubicación:** `app/api/auth/login/route.ts:20`
**OWASP:** API4:2023

**Escenario real:**
`loginAttempts` se limpia solo cuando se consulta (`isRateLimited` línea 30) y cuando se limpia explícitamente (`clearRateLimit` línea 54). Las entradas que se crearon pero nunca más se consultaron (IP que intentó una vez y se fue) permanecen 15 min. Con tráfico moderado se acumulan miles de entries.

**Solución propuesta:**
Job de cleanup cada 5 min que recorra el Map y borre `entry.resetTime < now`. O migrar a tabla SQL (ver hallazgo #5).

**Cómo prevenir el patrón:** Toda estructura in-memory con TTL debe tener un sweeper o usar una estructura TTL nativa (lru-cache con `ttl`).

---

## 16 · BAJA · API1:2023 — `GET /api/uploads/by-key/download` aplica `admin only` además de ownership

**Ubicación:** `app/api/uploads/by-key/download/route.ts:16-18`
**OWROP:** API1:2023

**Escenario real:**
```ts
if (user.role !== 'admin') {
  return NextResponse.json({ error: 'Solo el administrador puede descargar archivos' }, { status: 403 });
}
```
Esta restricción es **estricta de más**: un supervisor o el propio asesor del crédito no puede descargar, aunque `canAccessCredit` les daría acceso. Probablemente es intencional (auditoría legal), pero debería documentarse. Si la intención es "auditoría estricta", el `audit_log` debe registrar cada descarga.

**Solución propuesta:**
- Documentar en el README de la API por qué se fuerza admin-only.
- Si se relaja: añadir `if (user.role !== 'admin' && !(await canAccessCredit(user, creditId))) ...`.
- En cualquier caso, `audit_log` con `(user_id, action='download', document_id, ip, ts)`.

**Cómo prevenir el patrón:** Cuando una autorización es más estricta que el modelo, añadir un test que verifique la regla Y un comentario de intención.

---

## 17 · BAJA · API3:2023 — `PATCH /api/db/[table]/[id]` permite cambiar `email` del propio perfil

**Ubicación:** `app/api/db/[table]/[id]/route.ts:170-203`
**OWASP:** API3:2023

**Escenario real:**
`ALLOWED_COLUMNS.profiles` incluye `email`. Un asesor puede hacer `PATCH /api/db/profiles/<su-uuid>` con `{"email":"new@x.com"}`. Si el email ya existe en `public.users` de OTRO usuario, el UPDATE falla por unique constraint (bien). Si no existe, cambia su email en `public.profiles` y luego el `JOIN` en `getSessionUser` (línea 170-176 de session.ts) usa `u.email` de `public.users`, así que el email del perfil queda desincronizado con el email de login.

**Solución propuesta:**
Quitar `email` de `ALLOWED_COLUMNS.profiles` (el email debe cambiarse por un flujo admin separado que actualice ambas tablas en una transacción con verificación de unicidad).

**Cómo prevenir el patrón:** Ningún endpoint que toque una sola tabla (`profiles`) debe poder cambiar campos que tienen espejo en otra (`users.email`). Centralizar cambios de identidad.

---

## 18 · BAJA · API8:2023 — `pg_hba.conf` y `postgres@123` aún referenciados en docs

**Ubicación:** `README.md`, scripts de seed
**OWASP:** API8:2023 / A07:2021 (Identification and Authentication Failures)

**Escenario real:**
De la sesión previa se rotó la contraseña de `postgres@123` a `scram-sha-256`, pero si esa nueva contraseña aparece en README/scripts committeados, queda en el historial de git para siempre. Verificar `git log -p README.md | grep -i password`.

**Solución propuesta:**
- Búsqueda retrospectiva: `git log --all -p | rg -i "password\s*[:=]\s*['\"]"`.
- Cambiar la contraseña actual por una nueva por si quedó filtrada.
- Mover todas las credenciales a `.env.local` (gitignored) y a Doppler/Vault.

**Cómo prevenir el patrón:** Política: ningún secreto en el repo, ni siquiera en `.env.example`. CI con `gitleaks`/`trufflehog` en cada push.

---

## 19 · BAJA · API6:2023 — Sin audit log para acciones privilegiadas

**Ubicación:** transversal (`reset-password`, `users/route.ts`, `roles/route.ts`, `sedes/route.ts`)
**OWASP:** API6:2023 / A09:2021

**Escenario real:**
Reset de contraseña, creación de usuarios, cambios de roles, eliminación de sedes — todo ocurre sin dejar rastro auditable más allá de `updated_at`. Para una fintech de créditos esto es crítico para compliance (mínimo SOC2, GDPR art. 30).

**Solución propuesta:**
Tabla `public.audit_log(id, actor_user_id, action text, target_table text, target_id text, diff jsonb, ip text, ua text, ts timestamptz)`. Helper `audit(c, actor, action, target, diff)` invocado desde cada handler privilegiado.

**Cómo prevenir el patrón:** Toda acción que no sea CRUD de datos del propio usuario debe ir al audit log. Plantilla: `withAudit(c, async () => { ... })`.

---

## Resumen priorizado

| # | Sev | OWASP | Archivo:línea | Hallazgo |
|---|-----|-------|----------------|----------|
| 1 | ALTA | API1 | `app/api/uploads/confirm/route.ts:21-58` | Falta ownership check sobre `credit_id` → BOLA permite inyectar docs en créditos ajenos |
| 2 | ALTA | API3 | `app/api/db/[table]/route.ts:231-285` | Mass assignment: `asesor_id`, `created_by`, `uploaded_by` se respetan del body en vez de forzarse |
| 3 | ALTA | API8/4 | `app/api/db/[table]/route.ts:111-225` | Sin paginación (limit/offset) → recolección ilimitada de datos |
| 4 | ALTA | API2 | `app/api/admin/users/[id]/reset-password/route.ts:33-40` | Reset no transaccional + revoke prematuro → estado inconsistente |
| 5 | MEDIA | API2 | `app/api/auth/login/route.ts:11-56` | Rate limit in-memory, no escala entre réplicas |
| 6 | MEDIA | API1/2 | `app/api/auth/change-password/route.ts:9-12` | `allowStalePassword` demasiado permisivo; sin antigüedad mínima |
| 7 | MEDIA | API3/8 | `app/api/users/route.ts:66-117` | Creación no transaccional + role_id no validado contra `role` slug |
| 8 | MEDIA | API8 | `lib/auth/session.ts:5-12` | Rotación de `SESSION_SECRET` no soportada → logout masivo en rotación |
| 9 | MEDIA | API8 | `lib/api-error.ts:8-11` | `console.error(err.message)` puede filtrar PII a agregadores de logs |
| 10 | MEDIA | API3 | `app/api/sedes/[id]/route.ts:21-54` | `manager_id` sin validación referencial ni de rol |
| 11 | MEDIA | API1 | `app/api/db/[table]/[id]/route.ts:205-232` | DELETE: doble check (admin-only + verifyRecordAccess) puede divergir en refactor |
| 12 | MEDIA | API4 | `app/api/uploads/presign/route.ts:17-64` | Sin rate limit ni ownership check → abuso de bucket S3 |
| 13 | BAJA | API8 | `next.config.js:11-25` | Falta Content-Security-Policy |
| 14 | BAJA | API2 | `lib/auth/session.ts:12` | Fallback hardcoded de `SESSION_SECRET` si NODE_ENV ≠ production |
| 15 | BAJA | API4 | `app/api/auth/login/route.ts:20` | Map de intentos crece sin bound |
| 16 | BAJA | API1 | `app/api/uploads/by-key/download/route.ts:16-18` | Admin-only más estricto que el modelo; sin audit log |
| 17 | BAJA | API3 | `app/api/db/[table]/[id]/route.ts:170-203` | Cambio de `email` desincroniza `profiles.email` y `users.email` |
| 18 | BAJA | API8 | repo-wide | Verificar que la contraseña rotada de Postgres no quedó en git history |
| 19 | BAJA | API6 | transversal | Sin audit log para acciones privilegiadas |

## Próximos pasos (orden sugerido)

1. **Inmediato (esta semana):** 1, 2, 3, 4 — wrap en `withTx`, forzar ownership fields, paginación, validar credit_id en confirm.
2. **Corto plazo (2 semanas):** 5, 6, 7, 10, 12 — rate limit SQL-backed, validaciones de role_id, FK en sedes.
3. **Mediano plazo (mes):** 8, 9, 11, 13, 19 — logger estructurado, rotación de secrets, audit log, CSP.
4. **Bajo / hardening continuo:** 14-18 — fail-closed, sweeper de Map, audit log de descargas, gitleaks en CI.
