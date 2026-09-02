-- =====================================================================
-- MIGRACIÓN COMPLETA A PRODUCCIÓN (Supabase)
-- Ejecutar en: https://supabase.com/dashboard/project/uwipfcohcznvuramomiu/sql
-- =====================================================================
-- IMPORTANTE:
-- - Script idempotente: seguro ejecutarlo varias veces.
-- - RLS queda DESHABILITADO en todas las tablas porque la app usa
--   autenticación propia (cookies firmadas con HMAC) y NO Supabase Auth.
--   El control de acceso se hace en /api/db con lib/auth/visibility.ts.
--   Si migras a Supabase Auth (auth.users + JWT) en el futuro, reactiva RLS
--   con políticas basadas en auth.uid() (ver bloque comentado al final).

-- =====================================================================
-- 1. ESQUEMA BASE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL,
  phone text,
  email text UNIQUE,
  role text NOT NULL DEFAULT 'asesor' CHECK (role IN ('admin','supervisor','asesor')),
  role_id uuid,
  status text NOT NULL DEFAULT 'activo' CHECK (status IN ('pendiente_aprobacion','activo','rechazado','inactivo')),
  supervisor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  monthly_goal numeric DEFAULT 0,
  commission_rate numeric DEFAULT 0,
  password_hash text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financial_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credit_types text[] DEFAULT '{}',
  avg_response_days int DEFAULT 7,
  contact_name text,
  contact_phone text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  min_amount numeric DEFAULT 0,
  max_amount numeric DEFAULT 0,
  default_rate numeric DEFAULT 0,
  required_documents text[] DEFAULT '{}',
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  document_number text NOT NULL UNIQUE,
  phone text,
  email text,
  address text,
  city text,
  reported_income numeric DEFAULT 0,
  personal_refs jsonb DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  asesor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  entity_id uuid REFERENCES public.financial_entities(id) ON DELETE SET NULL,
  credit_type_id uuid REFERENCES public.credit_types(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'lead' CHECK (status IN ('lead','documentacion','enviado','estudio','aprobado','desembolsado','rechazado','desistido')),
  requested_amount numeric DEFAULT 0,
  approved_amount numeric,
  term_months int,
  rate numeric,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  status_changed_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id uuid NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at timestamptz DEFAULT now(),
  comment text
);

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id uuid NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_url text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','validado','rechazado')),
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at timestamptz DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id uuid NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
  asesor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  channel text DEFAULT 'llamada' CHECK (channel IN ('llamada','whatsapp','visita','email')),
  comment text NOT NULL,
  contact_date timestamptz DEFAULT now(),
  next_action_date date,
  next_action_note text,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- =====================================================================
-- 2. SISTEMA DE ROLES (permisos configurables)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Agregar columnas nuevas a profiles (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='profiles' AND column_name='role_id') THEN
    ALTER TABLE public.profiles ADD COLUMN role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='profiles' AND column_name='sede_id') THEN
    ALTER TABLE public.profiles ADD COLUMN sede_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='profiles' AND column_name='must_change_password') THEN
    ALTER TABLE public.profiles ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
  END IF;
END$$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON public.profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_profiles_sede_id ON public.profiles(sede_id);
CREATE INDEX IF NOT EXISTS idx_credits_asesor ON public.credits(asesor_id);
CREATE INDEX IF NOT EXISTS idx_credits_client ON public.credits(client_id);
CREATE INDEX IF NOT EXISTS idx_credits_status ON public.credits(status);
CREATE INDEX IF NOT EXISTS idx_credits_created ON public.credits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients(created_by);
CREATE INDEX IF NOT EXISTS idx_followups_asesor ON public.follow_ups(asesor_id);
CREATE INDEX IF NOT EXISTS idx_followups_completed ON public.follow_ups(completed);
CREATE INDEX IF NOT EXISTS idx_followups_next ON public.follow_ups(next_action_date);

-- Seed roles del sistema
INSERT INTO public.roles (slug, name, description, permissions, is_system, is_default) VALUES
  ('admin','Administrador','Acceso total. Es el rol por defecto al crear usuarios nuevos.',
   '["dashboard","kanban","calendario","clientes","creditos","creditos.nuevo","reportes","solicitudes","usuarios","roles","sedes","entidades"]'::jsonb,
   true, true),
  ('supervisor','Supervisor','Gestiona el equipo de asesores a su cargo.',
   '["dashboard","kanban","calendario","clientes","creditos","creditos.nuevo","reportes"]'::jsonb,
   true, false),
  ('asesor','Asesor','Asesor comercial. Solo ve sus propios clientes, créditos y seguimientos.',
   '["dashboard","kanban","calendario","clientes","creditos","creditos.nuevo","reportes"]'::jsonb,
   true, false)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  is_system = EXCLUDED.is_system,
  is_default = EXCLUDED.is_default;

-- Backfill role_id en profiles existentes (basado en role slug)
UPDATE public.profiles p
SET role_id = r.id
FROM public.roles r
WHERE r.slug = p.role AND p.role_id IS NULL;

-- =====================================================================
-- 3. SEDES (sucursales / oficinas)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.sedes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  address text,
  city text,
  phone text,
  manager_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sedes_active ON public.sedes(active);

-- Seed de ejemplo (opcional - ajustar a tus sedes reales)
INSERT INTO public.sedes (id, name, code, address, city, phone, active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Sede Centro', 'BOG-CENT', 'Cra 7 #32-15', 'Bogotá', '6017432100', true),
  ('22222222-2222-2222-2222-222222222222', 'Sede Norte', 'BOG-NORT', 'Calle 116 #19-30', 'Bogotá', '6017432200', true),
  ('33333333-3333-3333-3333-333333333333', 'Sede Sur', 'BOG-SUR', 'Av. 1 de Mayo #50-12', 'Bogotá', '6017432300', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =====================================================================
-- RLS queda DESHABILITADO en todas las tablas porque:
-- 1. La app usa auth propia (cookies firmadas) y NO Supabase Auth
-- 2. La visibilidad por rol se hace en la capa de API (/api/db con
--    lib/auth/visibility.ts)
-- 3. Habilitar RLS rompería las queries del servidor porque la sesión
--    viene en cookies, no en auth.uid() de Postgres
--
-- Si en el futuro migras a Supabase Auth (auth.users + JWT), puedes
-- descomentar el bloque RLS de abajo y eliminar este.

ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_entities DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_status_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sedes DISABLE ROW LEVEL SECURITY;

/*
-- =====================================================================
-- RLS BASADO EN SUPABASE AUTH (comentado, solo si migras a auth.users)
-- =====================================================================
-- Para activar cuando uses Supabase Auth + JWT:
-- 1. profiles.id debe referenciar auth.users(id)
-- 2. Reemplazar las políticas 'auth.uid()' con auth.uid()
-- 3. Eliminar el campo password_hash (redundante con auth.users)
-- 4. Crear usuarios via supabase.auth.admin.createUser en vez de INSERT directo

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.role IN ('admin','supervisor'))
  );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Repetir para cada tabla: roles, financial_entities, credit_types, sedes,
-- clients, credits, credit_status_history, documents, follow_ups
-- (Ver production_migration_original.sql para las políticas completas)
*/

-- =====================================================================
-- 5. RESUMEN
-- =====================================================================
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'MIGRACIÓN A PRODUCCIÓN COMPLETADA';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Tablas creadas: profiles, financial_entities, credit_types,';
  RAISE NOTICE '               clients, credits, credit_status_history,';
  RAISE NOTICE '               documents, follow_ups, roles, sedes';
  RAISE NOTICE '';
  RAISE NOTICE 'Roles seed: admin (por defecto), supervisor, asesor';
  RAISE NOTICE 'Sedes seed: 3 de ejemplo (BOG-CENT, BOG-NORT, BOG-SUR)';
  RAISE NOTICE 'RLS: DESHABILITADO (auth propia del CRM)';
  RAISE NOTICE '';
  RAISE NOTICE 'Próximos pasos:';
  RAISE NOTICE '  1. Crear usuarios desde la app en /usuarios (Crear usuario)';
  RAISE NOTICE '  2. Cambiar DATABASE_URL en .env.local a la connection string';
  RAISE NOTICE '     de Supabase (DATABASE_URL=postgresql://postgres:[PASSWORD]@db.uwipfcohcznvuramomiu.supabase.co:5432/postgres)';
  RAISE NOTICE '  3. Hacer deploy a Netlify / Vercel';
  RAISE NOTICE '  4. Configurar las variables de entorno en producción';
  RAISE NOTICE '============================================================';
END $$;