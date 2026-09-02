-- ============================================================================
-- CREDILIBRANZAS JG - MIGRACION COMPLETA DE PRODUCCION
-- ============================================================================
-- Ejecutar en Supabase SQL Editor.
-- Idempotente: puede ejecutarse mas de una vez.
--
-- La aplicacion usa autenticacion propia con cookies HMAC y PostgreSQL.
-- Por eso RLS queda deshabilitado y la autorizacion se aplica en la API.
-- NO contiene contrasenas, usuarios demo ni claves de almacenamiento.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. USUARIOS Y ROLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text,
  status text NOT NULL DEFAULT 'activo'
    CHECK (status IN ('pendiente_aprobacion','activo','rechazado','inactivo')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  email text UNIQUE,
  role text NOT NULL DEFAULT 'asesor'
    CHECK (role IN ('admin','supervisor','asesor')),
  role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'activo'
    CHECK (status IN ('pendiente_aprobacion','activo','rechazado','inactivo')),
  supervisor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sede_id uuid,
  monthly_goal numeric DEFAULT 0,
  commission_rate numeric DEFAULT 0,
  password_hash text,
  must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Compatibilidad con bases donde las tablas ya existian.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='user_id') THEN
    ALTER TABLE public.profiles ADD COLUMN user_id uuid REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='role_id') THEN
    ALTER TABLE public.profiles ADD COLUMN role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='sede_id') THEN
    ALTER TABLE public.profiles ADD COLUMN sede_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='must_change_password') THEN
    ALTER TABLE public.profiles ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Migra perfiles antiguos a users usando el mismo UUID.
INSERT INTO public.users (id, email, password_hash, status)
SELECT p.id, p.email, p.password_hash, p.status
FROM public.profiles p
WHERE p.email IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = COALESCE(EXCLUDED.password_hash, public.users.password_hash),
  status = EXCLUDED.status;

UPDATE public.profiles p
SET user_id = u.id
FROM public.users u
WHERE p.user_id IS NULL AND p.email = u.email;

INSERT INTO public.roles (slug, name, description, permissions, is_system, is_default) VALUES
  ('admin', 'Administrador', 'Acceso total al sistema.',
   '["dashboard","kanban","calendario","clientes","creditos","creditos.nuevo","reportes","solicitudes","usuarios","roles","sedes","entidades"]'::jsonb,
   true, true),
  ('supervisor', 'Supervisor', 'Gestiona el equipo de asesores a su cargo.',
   '["dashboard","kanban","calendario","clientes","creditos","creditos.nuevo","reportes"]'::jsonb,
   true, false),
  ('asesor', 'Asesor', 'Asesor comercial.',
   '["dashboard","kanban","calendario","clientes","creditos","creditos.nuevo","reportes"]'::jsonb,
   true, false)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  is_system = EXCLUDED.is_system,
  is_default = EXCLUDED.is_default;

UPDATE public.profiles p
SET role_id = r.id
FROM public.roles r
WHERE p.role_id IS NULL AND p.role = r.slug;

-- ============================================================================
-- 2. CATALOGOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.financial_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credit_types text[] DEFAULT '{}',
  avg_response_days integer DEFAULT 7,
  contact_name text,
  contact_phone text,
  credit_min_amount numeric,
  credit_max_amount numeric,
  commission_percentage numeric DEFAULT 0,
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='financial_entities' AND column_name='credit_min_amount') THEN
    ALTER TABLE public.financial_entities ADD COLUMN credit_min_amount numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='financial_entities' AND column_name='credit_max_amount') THEN
    ALTER TABLE public.financial_entities ADD COLUMN credit_max_amount numeric;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='financial_entities' AND column_name='commission_percentage') THEN
    ALTER TABLE public.financial_entities ADD COLUMN commission_percentage numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='sede_id') THEN
    ALTER TABLE public.profiles ADD COLUMN sede_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_sede_id_fkey'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_sede_id_fkey
      FOREIGN KEY (sede_id) REFERENCES public.sedes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 3. OPERACION DE CREDITOS
-- ============================================================================

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
  status text NOT NULL DEFAULT 'lead'
    CHECK (status IN ('lead','documentacion','enviado','estudio','aprobado','desembolsado','rechazado','desistido')),
  requested_amount numeric DEFAULT 0,
  approved_amount numeric,
  term_months integer,
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
  status text NOT NULL DEFAULT 'pendiente'
    CHECK (status IN ('pendiente','validado','rechazado')),
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at timestamptz DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id uuid NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
  asesor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  channel text DEFAULT 'llamada'
    CHECK (channel IN ('llamada','whatsapp','visita','email')),
  comment text NOT NULL,
  contact_date timestamptz DEFAULT now(),
  next_action_date date,
  next_action_note text,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 4. INDICES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON public.profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_sede_id ON public.profiles(sede_id);
CREATE INDEX IF NOT EXISTS idx_profiles_supervisor ON public.profiles(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients(created_by);
CREATE INDEX IF NOT EXISTS idx_credits_asesor ON public.credits(asesor_id);
CREATE INDEX IF NOT EXISTS idx_credits_client ON public.credits(client_id);
CREATE INDEX IF NOT EXISTS idx_credits_status ON public.credits(status);
CREATE INDEX IF NOT EXISTS idx_credits_created ON public.credits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_credit ON public.documents(credit_id);
CREATE INDEX IF NOT EXISTS idx_followups_asesor ON public.follow_ups(asesor_id);
CREATE INDEX IF NOT EXISTS idx_followups_completed ON public.follow_ups(completed);
CREATE INDEX IF NOT EXISTS idx_followups_next ON public.follow_ups(next_action_date);
CREATE INDEX IF NOT EXISTS idx_sedes_active ON public.sedes(active);

-- ============================================================================
-- 5. SEGURIDAD
-- ============================================================================
-- La app autentica con cookie HMAC propia, no con auth.uid() de Supabase.
-- RLS habilitado bloquearia las consultas del servidor porque no reciben JWT.

ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_entities DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sedes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_status_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  RAISE NOTICE 'Migracion completa ejecutada correctamente.';
  RAISE NOTICE 'Tablas: users, roles, profiles, financial_entities, credit_types, sedes, clients, credits, credit_status_history, documents, follow_ups.';
  RAISE NOTICE 'RLS deshabilitado: la app usa autenticacion propia HMAC.';
END $$;
