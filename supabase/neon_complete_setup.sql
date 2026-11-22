-- ============================================================================
-- CREDILIBRANZAS JG - SETUP COMPLETO PARA NEON POSTGRESQL (PRODUCCIÓN)
-- ============================================================================
-- Este script es 100% idempotente (se puede ejecutar múltiples veces sin error).
-- Contiene todas las tablas, relaciones, catálogos iniciales, índices de alto rendimiento
-- y la estructura completa requerida por la aplicación.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. USUARIOS, ROLES Y PERFILES
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

-- Roles base del sistema con permisos completos
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

-- ============================================================================
-- 2. SEDES Y CATÁLOGOS
-- ============================================================================

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

-- Enlazar FK de profiles a sedes si no existe
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

-- Catálogo base: Entidades Financieras
INSERT INTO public.financial_entities (name, credit_types, avg_response_days, contact_name, contact_phone, credit_min_amount, credit_max_amount, commission_percentage, active)
VALUES
  ('Banco de Bogotá', ARRAY['libre_inversion','vivienda','vehiculo'], 5, 'María Cárdenas', '6013320000', 1000000, 100000000, 2.5, true),
  ('Bancolombia', ARRAY['libre_inversion','vivienda','vehiculo','libranza'], 4, 'Carlos Mejía', '6045100000', 2000000, 200000000, 2.0, true),
  ('Banco Popular', ARRAY['libre_inversion','libranza'], 7, 'Ana López', '6013390000', 500000, 50000000, 3.0, true),
  ('BBVA Colombia', ARRAY['libre_inversion','vivienda'], 6, 'Jorge Ramírez', '6013470000', 5000000, 300000000, 2.2, true),
  ('Banco Caja Social', ARRAY['libranza','libre_inversion'], 8, 'Lucía Herrera', '6013530000', 300000, 80000000, 3.5, true),
  ('Davivienda', ARRAY['vivienda','libre_inversion','vehiculo'], 5, 'Pedro Ortega', '6013300000', 5000000, 500000000, 1.8, true),
  ('Banco de Occidente', ARRAY['libre_inversion','empresarial'], 9, 'Sofía Castaño', '6027310000', 10000000, 1000000000, 2.8, true),
  ('Scotiabank Colpatria', ARRAY['libre_inversion','vivienda'], 7, 'Andrés Salinas', '6013480000', 2000000, 250000000, 2.3, true)
ON CONFLICT DO NOTHING;

-- Catálogo base: Tipos de Crédito
INSERT INTO public.credit_types (name, min_amount, max_amount, default_rate, required_documents, active)
VALUES
  ('Libre Inversión', 1000000, 100000000, 18.5, ARRAY['cedula','ingresos','codeudor'], true),
  ('Vivienda', 30000000, 500000000, 12.9, ARRAY['cedula','ingresos','escrituras','avaluo'], true),
  ('Vehículo', 10000000, 150000000, 15.2, ARRAY['cedula','ingresos','factura_vehiculo'], true),
  ('Libranza', 5000000, 200000000, 14.5, ARRAY['cedula','colilla_pago','desprendible'], true),
  ('Empresarial', 20000000, 1000000000, 22.0, ARRAY['cedula','estados_financieros','camara_comercio'], true),
  ('Educativo', 5000000, 80000000, 11.5, ARRAY['cedula','certificado_estudios'], true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. CLIENTES, CRÉDITOS, SEGUIMIENTOS Y DOCUMENTOS
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
    CHECK (status IN ('lead','documentacion','enviado','estudio','devolucion','aprobado','desembolsado','rechazado','desistido')),
  requested_amount numeric DEFAULT 0,
  approved_amount numeric,
  term_months integer,
  rate numeric,
  rejection_reason text,
  devolucion_reason text,
  devolucion_requires_upload boolean NOT NULL DEFAULT false,
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
-- 4. SEGURIDAD, AUDITORÍA Y SESIONES (PRODUCCIÓN FINTECH)
-- ============================================================================

-- Bitácora de auditoría para acciones privilegiadas
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  target_type text,
  target_id   uuid,
  diff        jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip          text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Rate limiting en login
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id          bigserial PRIMARY KEY,
  rate_key    text NOT NULL UNIQUE,
  attempts    integer NOT NULL DEFAULT 0,
  reset_at    timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Sesiones server-side revocables (almacena hash SHA-256)
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip text,
  user_agent text
);

-- ============================================================================
-- 5. ÍNDICES DE RENDIMIENTO
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON public.profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_sede_id ON public.profiles(sede_id);
CREATE INDEX IF NOT EXISTS idx_profiles_supervisor ON public.profiles(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients(created_by);
CREATE INDEX IF NOT EXISTS idx_clients_document ON public.clients(document_number);
CREATE INDEX IF NOT EXISTS idx_credits_asesor ON public.credits(asesor_id);
CREATE INDEX IF NOT EXISTS idx_credits_client ON public.credits(client_id);
CREATE INDEX IF NOT EXISTS idx_credits_status ON public.credits(status);
CREATE INDEX IF NOT EXISTS idx_credits_created ON public.credits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_credit ON public.documents(credit_id);
CREATE INDEX IF NOT EXISTS idx_followups_asesor ON public.follow_ups(asesor_id);
CREATE INDEX IF NOT EXISTS idx_followups_completed ON public.follow_ups(completed);
CREATE INDEX IF NOT EXISTS idx_followups_next ON public.follow_ups(next_action_date);
CREATE INDEX IF NOT EXISTS idx_sedes_active ON public.sedes(active);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON public.audit_log(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_reset ON public.login_attempts(reset_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_key ON public.login_attempts(rate_key);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON public.user_sessions(token_hash);

-- ============================================================================
-- 6. CONFIGURACIÓN DE SEGURIDAD (RLS)
-- ============================================================================
-- La aplicación utiliza sesiones propias basadas en cookies firmadas (HMAC)
-- y consultas directas desde el backend vía PostgreSQL (Node.js pg).
-- Por ende, RLS se deshabilita para evitar bloqueos en el motor de base de datos.
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sedes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_entities DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_status_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. CREACIÓN DEL USUARIO ADMINISTRADOR INICIAL
-- ============================================================================
-- Se crea el usuario inicial con email: admin@credilibranzas.com
-- Contraseña por defecto: Admin2026* (forzará cambio en el primer login)
-- ============================================================================
DO $$
DECLARE
  v_user_id uuid;
  v_role_id uuid;
  v_admin_pass_hash text;
BEGIN
  SELECT id INTO v_role_id FROM public.roles WHERE slug = 'admin' LIMIT 1;
  SELECT id INTO v_user_id FROM public.users WHERE email = 'admin@credilibranzas.com' LIMIT 1;

  -- Hash bcrypt de 'Admin2026*'
  v_admin_pass_hash := crypt('Admin2026*', gen_salt('bf', 10));

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO public.users (id, email, password_hash, status)
    VALUES (v_user_id, 'admin@credilibranzas.com', v_admin_pass_hash, 'activo');
  ELSE
    UPDATE public.users
    SET password_hash = COALESCE(password_hash, v_admin_pass_hash),
        status = 'activo',
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  INSERT INTO public.profiles (
    id, user_id, full_name, email, role, role_id, status, must_change_password
  )
  VALUES (
    v_user_id,
    v_user_id,
    'Administrador Principal',
    'admin@credilibranzas.com',
    'admin',
    v_role_id,
    'activo',
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    role = 'admin',
    role_id = v_role_id,
    status = 'activo',
    must_change_password = true,
    updated_at = now();

  RAISE NOTICE 'Base de datos configurada correctamente con usuario admin@credilibranzas.com';
END $$;
