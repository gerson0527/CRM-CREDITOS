# CRM Credilibranzas JG

Sistema CRM para gestión de créditos, clientes, asesores y entidades financieras.

Stack: Next.js 13 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · PostgreSQL 18 (local) · Framer Motion.

## Inicio rápido (desarrollo local)

```bash
# 1. Crear base de datos (PostgreSQL 18+)
psql -h localhost -U postgres -c "CREATE DATABASE credilibranzasjg;"

# 2. Instalar dependencias
npm install

# 3. Variables de entorno (.env.local)
DATABASE_URL=postgresql://postgres@localhost:5432/credilibranzasjg
SESSION_SECRET=<genera-uno-aleatorio-de-32-bytes>

# 4. Aplicar migraciones + seed
psql -h localhost -U postgres -d credilibranzasjg -f supabase/local_setup.sql
psql -h localhost -U postgres -d credilibranzasjg -f supabase/migration_sedes.sql
psql -h localhost -U postgres -d credilibranzasjg -f supabase/migration_entities_extra.sql
psql -h localhost -U postgres -d credilibranzasjg -f supabase/migration_users_split.sql
psql -h localhost -U postgres -d credilibranzasjg -f supabase/migration_admin_perms.sql

# 5. Asignar contraseñas bcrypt a usuarios demo
node scripts/seed_passwords.mjs

# 6. Insertar créditos de ejemplo
node scripts/seed_credits.mjs

# 7. Levantar el servidor
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en el navegador.

### Cuentas demo (solo desarrollo local)

No se publican contraseñas en este repositorio. Para desarrollo local:

1. Crea los usuarios demo con el script de seed (no imprime ni guarda contraseñas en git).
2. Define tu propia contraseña local con la variable de entorno `SEED_DEMO_PASSWORD` (nunca la commitees):

```bash
# PowerShell
$env:SEED_DEMO_PASSWORD="una-contraseña-local-fuerte-que-solo-vive-en-tu-máquina"
node scripts/seed_passwords.mjs
```

Roles de ejemplo: `Administrador`, `Supervisor`, `Asesor` (ver `supabase/seed_demo_users.sql` para los correos de ejemplo).

> Nunca uses estas cuentas demo en producción. Crea usuarios reales desde **Gestión de Usuarios** y rota cualquier credencial que haya estado expuesta.

## Arquitectura

- **Frontend**: React 18, shadcn/ui, Tailwind CSS, Framer Motion, recharts (gráficos)
- **Backend**: API Routes de Next.js con `pg` directo (sin Supabase JS)
- **Auth**: Cookies firmadas con HMAC, bcrypt para passwords
- **Visibilidad por rol**: Implementada en `lib/auth/visibility.ts` (asesor ve solo lo suyo, supervisor ve su equipo, admin ve todo)
- **Base de datos**: PostgreSQL 18 con tablas relacionales

## Estructura

```
app/
├── (rutas)              # Páginas: dashboard, kanban, calendario, clientes, créditos…
│   ├── api/             # API Routes (auth, db genérico, admin, etc.)
│   └── (páginas con PageHeader + Pagination)
├── components/          # Componentes reutilizables (KpiCard, Pagination, etc.)
├── lib/
│   ├── auth/            # Sesiones, visibilidad, hash
│   ├── db/              # Pool de pg
│   └── supabase/        # Shim compatible con la API antigua
└── supabase/            # Migraciones SQL
```

## Funcionalidades

- **Dashboard por rol** con KPIs personalizados
- **Kanban de créditos** con drag & drop para cambiar estado
- **Calendario** de seguimientos con eventos por día
- **Gestión de clientes** con estadísticas de colocación
- **Gestión de créditos** con filtros (asesor, estado, entidad, tipo)
- **Gestión de usuarios** con CRUD completo, asignación de sede
- **Roles y permisos** configurables desde la UI
- **Sedes** y **entidades financieras** gestionables
- **Reportes** con filtros de fecha y KPIs detallados
- **Cambio de contraseña obligatorio** para usuarios creados por admin
