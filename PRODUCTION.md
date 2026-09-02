# Producción

## 1. Aplicar migración a la base de datos

Ve a [Supabase SQL Editor](https://supabase.com/dashboard/project/uwipfcohcznvuramomiu/sql/new) y pega el contenido de `supabase/production_migration.sql`.

Es idempotente — puedes ejecutarlo varias veces sin romper nada.

## 2. Cambiar la connection string

En `.env.local` (y en tu hosting — Netlify / Vercel / etc.):

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.uwipfcohcznvuramomiu.supabase.co:5432/postgres
```

Reemplaza `[PASSWORD]` con la contraseña del proyecto Supabase. La encuentras en:
**Supabase Dashboard → Project Settings → Database → Connection string → URI**.

## 3. Crear los primeros usuarios

Desde la app, entra como admin (`admin@credilibranzas.com` / `Credi123456!`) y ve a **Gestión de Usuarios → Crear usuario**.

Los nuevos usuarios que crees tendrán `must_change_password = true`, así que se les mostrará el diálogo de cambio de contraseña en su primer login.

## 4. (Opcional) Sembrar datos de demo

Si quieres datos de prueba, ejecuta el script de seed en producción:

```bash
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.uwipfcohcznvuramomiu.supabase.co:5432/postgres \
  node scripts/seed_credits.mjs
```

Esto crea 80 créditos, 263 entradas de historial, 41 seguimientos, 102 documentos.

## Notas sobre RLS

El script de migración **deja RLS deshabilitado** en todas las tablas porque:
- La app usa autenticación propia (cookies firmadas con HMAC, no Supabase Auth)
- El control de acceso por rol se hace en la capa de API (`/api/db` con `lib/auth/visibility.ts`)
- Habilitar RLS con `auth.uid()` rompería las queries del servidor

Si en el futuro migras a **Supabase Auth + JWT** (auth.users, RLS basado en auth.uid()), el script tiene un bloque comentado al final con las políticas listas para descomentar. Solo necesitarás:
1. Cambiar `profiles.id` para referenciar `auth.users(id)`
2. Eliminar `password_hash` (redundante)
3. Crear usuarios via `supabase.auth.admin.createUser` en vez de INSERT directo

## 5. Deploy del código

El proyecto es Next.js 13 (App Router). Las opciones son:

### Netlify
```bash
npm install -g netlify-cli
netlify login
netlify link  # conectar al sitio
netlify env:set DATABASE_URL postgresql://...
netlify env:set SESSION_SECRET ...
netlify env:set STORAGE_* ...
netlify deploy --prod
```

### Vercel
```bash
npm install -g vercel
vercel login
vercel link
vercel env add DATABASE_URL postgresql://...
vercel env add SESSION_SECRET ...
vercel env add STORAGE_* ...
vercel --prod
```

El `netlify.toml` ya está configurado con el plugin de Next.js.

## Variables de entorno necesarias

Ver `.env.example` para la lista completa. Las críticas son:

```env
DATABASE_URL=                  # Connection string de Supabase
SESSION_SECRET=               # Generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
STORAGE_ENDPOINT=             # https://... o http://localhost:9000 (MinIO)
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY=            # Tu access key
STORAGE_SECRET_KEY=            # Tu secret key
STORAGE_BUCKET=creditos
NEXT_PUBLIC_SUPABASE_URL=      # Mantener para compatibilidad con código legacy
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Checklist pre-deploy

- [ ] Migración ejecutada en Supabase
- [ ] `DATABASE_URL` configurado con la connection string de Supabase
- [ ] `SESSION_SECRET` generado y configurado
- [ ] Variables `STORAGE_*` configuradas (o comentadas si aún no usas upload)
- [ ] Primer usuario admin creado desde la app
- [ ] (Opcional) Seed ejecutado
- [ ] Deploy a Netlify / Vercel
- [ ] Probar login + creación de crédito + drag&drop kanban + reportes
