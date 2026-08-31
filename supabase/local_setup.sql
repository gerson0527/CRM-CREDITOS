-- ============================================================
-- CREDILIBRANZAS JG — SETUP LOCAL COMPLETO
-- Base de datos: credilibranzasjg
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- TABLAS
-- ============================================================

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
  id uuid PRIMARY KEY,
  full_name text NOT NULL,
  phone text,
  email text UNIQUE,
  role text NOT NULL DEFAULT 'asesor' CHECK (role IN ('admin','supervisor','asesor')),
  role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'activo' CHECK (status IN ('pendiente_aprobacion','activo','rechazado','inactivo')),
  supervisor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  monthly_goal numeric DEFAULT 0,
  commission_rate numeric DEFAULT 0,
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

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_supervisor ON public.profiles(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients(created_by);
CREATE INDEX IF NOT EXISTS idx_credits_asesor ON public.credits(asesor_id);
CREATE INDEX IF NOT EXISTS idx_credits_client ON public.credits(client_id);
CREATE INDEX IF NOT EXISTS idx_credits_status ON public.credits(status);
CREATE INDEX IF NOT EXISTS idx_credits_created ON public.credits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_followups_asesor ON public.follow_ups(asesor_id);
CREATE INDEX IF NOT EXISTS idx_followups_completed ON public.follow_ups(completed);

-- ============================================================
-- LOCAL: RLS deshabilitado (sin Supabase Auth)
-- En producción (Supabase) se aplican las políticas de
-- supabase/migrations/20260823005556_create_crm_schema.sql
-- ============================================================
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_entities DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_status_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- SEED: ROLES
-- ============================================================
INSERT INTO public.roles (slug, name, description, permissions, is_system, is_default) VALUES
  ('admin','Administrador','Acceso total al sistema. Es el rol por defecto al crear usuarios nuevos.',
   '["dashboard","kanban","calendario","clientes","creditos","creditos.nuevo","reportes","solicitudes","usuarios","roles"]'::jsonb,
   true, true),
  ('supervisor','Supervisor','Gestiona el equipo de asesores a su cargo.',
   '["dashboard","kanban","calendario","clientes","creditos","creditos.nuevo","reportes"]'::jsonb,
   true, false),
  ('asesor','Asesor','Asesor comercial. Solo ve sus propios clientes, creditos y seguimientos.',
   '["dashboard","kanban","calendario","clientes","creditos","creditos.nuevo","reportes"]'::jsonb,
   true, false)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  is_system = EXCLUDED.is_system,
  is_default = EXCLUDED.is_default;

-- ============================================================
-- SEED: USUARIOS DEMO
-- ============================================================
DO $$
DECLARE
  v_admin_id uuid := gen_random_uuid();
  v_supervisor_id uuid := gen_random_uuid();
  v_asesor1_id uuid := gen_random_uuid();
  v_asesor2_id uuid := gen_random_uuid();
  v_asesor3_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role, status, phone, monthly_goal, commission_rate)
  VALUES (v_admin_id, 'Administrador Principal', 'admin@credilibranzas.com', 'admin', 'activo', '3000000000', 0, 0)
  ON CONFLICT (email) DO UPDATE SET role = 'admin', status = 'activo';
  UPDATE public.profiles SET role_id = (SELECT id FROM public.roles WHERE slug='admin') WHERE email = 'admin@credilibranzas.com';

  INSERT INTO public.profiles (id, full_name, email, role, status, phone, monthly_goal, commission_rate)
  VALUES (v_supervisor_id, 'Supervisor de Ventas', 'supervisor@credilibranzas.com', 'supervisor', 'activo', '3000000001', 0, 0)
  ON CONFLICT (email) DO UPDATE SET role = 'supervisor', status = 'activo';
  UPDATE public.profiles SET role_id = (SELECT id FROM public.roles WHERE slug='supervisor') WHERE email = 'supervisor@credilibranzas.com';

  INSERT INTO public.profiles (id, full_name, email, role, status, supervisor_id, phone, monthly_goal, commission_rate)
  VALUES (v_asesor1_id, 'Juan Perez', 'asesor1@credilibranzas.com', 'asesor', 'activo', v_supervisor_id, '3000000002', 50000000, 1.5)
  ON CONFLICT (email) DO UPDATE SET role = 'asesor', status = 'activo';
  UPDATE public.profiles SET role_id = (SELECT id FROM public.roles WHERE slug='asesor') WHERE email = 'asesor1@credilibranzas.com';

  INSERT INTO public.profiles (id, full_name, email, role, status, supervisor_id, phone, monthly_goal, commission_rate)
  VALUES (v_asesor2_id, 'Maria Rodriguez', 'asesor2@credilibranzas.com', 'asesor', 'activo', v_supervisor_id, '3000000003', 45000000, 1.5)
  ON CONFLICT (email) DO UPDATE SET role = 'asesor', status = 'activo';
  UPDATE public.profiles SET role_id = (SELECT id FROM public.roles WHERE slug='asesor') WHERE email = 'asesor2@credilibranzas.com';

  INSERT INTO public.profiles (id, full_name, email, role, status, supervisor_id, phone, monthly_goal, commission_rate)
  VALUES (v_asesor3_id, 'Asesor Pendiente', 'asesor3@credilibranzas.com', 'asesor', 'pendiente_aprobacion', v_supervisor_id, '3000000004', 30000000, 1.2)
  ON CONFLICT (email) DO UPDATE SET role = 'asesor', status = 'pendiente_aprobacion';
  UPDATE public.profiles SET role_id = (SELECT id FROM public.roles WHERE slug='asesor') WHERE email = 'asesor3@credilibranzas.com';
END $$;

-- ============================================================
-- SEED: ENTIDADES FINANCIERAS
-- ============================================================
INSERT INTO public.financial_entities (name, credit_types, avg_response_days, contact_name, contact_phone, active) VALUES
  ('Banco de Bogota', ARRAY['libre_inversion','vivienda','vehiculo'], 5, 'Maria Cardenas', '6013320000', true),
  ('Bancolombia', ARRAY['libre_inversion','vivienda','vehiculo','libranza'], 4, 'Carlos Mejia', '6045100000', true),
  ('Banco Popular', ARRAY['libre_inversion','libranza'], 7, 'Ana Lopez', '6013390000', true),
  ('BBVA Colombia', ARRAY['libre_inversion','vivienda'], 6, 'Jorge Ramirez', '6013470000', true),
  ('Banco Caja Social', ARRAY['libranza','libre_inversion'], 8, 'Lucia Herrera', '6013530000', true),
  ('Davivienda', ARRAY['vivienda','libre_inversion','vehiculo'], 5, 'Pedro Ortega', '6013300000', true),
  ('Banco de Occidente', ARRAY['libre_inversion','empresarial'], 9, 'Sofia Castano', '6027310000', true),
  ('Scotiabank Colpatria', ARRAY['libre_inversion','vivienda'], 7, 'Andres Salinas', '6013480000', true);

-- ============================================================
-- SEED: TIPOS DE CREDITO
-- ============================================================
INSERT INTO public.credit_types (name, min_amount, max_amount, default_rate, required_documents, active) VALUES
  ('Libre Inversion', 1000000, 100000000, 18.5, ARRAY['cedula','ingresos','codeudor'], true),
  ('Vivienda', 30000000, 500000000, 12.9, ARRAY['cedula','ingresos','escrituras','avaluo'], true),
  ('Vehiculo', 10000000, 150000000, 15.2, ARRAY['cedula','ingresos','factura_vehiculo'], true),
  ('Libranza', 5000000, 200000000, 14.5, ARRAY['cedula','colilla_pago','desprendible'], true),
  ('Empresarial', 20000000, 1000000000, 22.0, ARRAY['cedula','estados_financieros','camara_comercio'], true),
  ('Educativo', 5000000, 80000000, 11.5, ARRAY['cedula','certificado_estudios'], true);

-- ============================================================
-- SEED: CLIENTES
-- ============================================================
DO $$
DECLARE
  v_asesor1 uuid;
  v_asesor2 uuid;
  v_admin uuid;
BEGIN
  SELECT id INTO v_asesor1 FROM public.profiles WHERE email = 'asesor1@credilibranzas.com';
  SELECT id INTO v_asesor2 FROM public.profiles WHERE email = 'asesor2@credilibranzas.com';
  SELECT id INTO v_admin FROM public.profiles WHERE email = 'admin@credilibranzas.com';

  INSERT INTO public.clients (first_name, last_name, document_number, phone, email, address, city, reported_income, created_by) VALUES
    ('Carlos', 'Ramirez Lopez', '79123456', '3104567890', 'carlos.ramirez@example.com', 'Calle 100 #15-20', 'Bogota', 4500000, v_asesor1),
    ('Maria', 'Gonzalez Perez', '52123456', '3115678901', 'maria.gonzalez@example.com', 'Carrera 15 #93-50', 'Bogota', 6800000, v_asesor1),
    ('Jorge', 'Hernandez Castro', '80123456', '3126789012', 'jorge.h@example.com', 'Calle 72 #10-15', 'Medellin', 5200000, v_asesor2),
    ('Ana', 'Martinez Ruiz', '52345678', '3137890123', 'ana.martinez@example.com', 'Avenida 6N #23-45', 'Cali', 3900000, v_asesor1),
    ('Luis', 'Garcia Vargas', '10234567', '3148901234', 'luis.garcia@example.com', 'Calle 50 #25-30', 'Barranquilla', 7100000, v_asesor2),
    ('Patricia', 'Lopez Mendoza', '52456789', '3159012345', 'patricia.lopez@example.com', 'Carrera 7 #45-67', 'Bogota', 4800000, v_asesor1),
    ('Roberto', 'Sanchez Ortiz', '79456789', '3160123456', 'r.sanchez@example.com', 'Calle 85 #12-34', 'Bogota', 8200000, v_asesor2),
    ('Carolina', 'Ramirez Vega', '52567890', '3171234567', 'carolina.r@example.com', 'Carrera 11 #93-12', 'Bogota', 5500000, v_asesor1),
    ('Empresa', 'Inversiones Global SAS', '900123456-1', '6017654321', 'contacto@inversionesglobal.com', 'Calle 26 #68-23', 'Bogota', 25000000, v_admin),
    ('Diego', 'Morales Castro', '79678901', '3182345678', 'diego.morales@example.com', 'Carrera 15 #45-12', 'Medellin', 4300000, v_asesor2)
  ON CONFLICT (document_number) DO NOTHING;
END $$;

-- ============================================================
-- SEED: CREDITOS
-- ============================================================
DO $$
DECLARE
  v_asesor1 uuid;
  v_asesor2 uuid;
  v_entity_bog uuid;
  v_entity_ban uuid;
  v_entity_pop uuid;
  v_type_libre uuid;
  v_client record;
BEGIN
  SELECT id INTO v_asesor1 FROM public.profiles WHERE email = 'asesor1@credilibranzas.com';
  SELECT id INTO v_asesor2 FROM public.profiles WHERE email = 'asesor2@credilibranzas.com';
  SELECT id INTO v_entity_bog FROM public.financial_entities WHERE name = 'Banco de Bogota';
  SELECT id INTO v_entity_ban FROM public.financial_entities WHERE name = 'Bancolombia';
  SELECT id INTO v_entity_pop FROM public.financial_entities WHERE name = 'Banco Popular';
  SELECT id INTO v_type_libre FROM public.credit_types WHERE name = 'Libre Inversion';

  FOR v_client IN SELECT id FROM public.clients ORDER BY created_at LIMIT 8 LOOP
    INSERT INTO public.credits (client_id, asesor_id, entity_id, credit_type_id, status, requested_amount, approved_amount, term_months, rate)
    VALUES (
      v_client.id,
      CASE WHEN random() < 0.5 THEN v_asesor1 ELSE v_asesor2 END,
      CASE (random() * 3)::int WHEN 0 THEN v_entity_bog WHEN 1 THEN v_entity_ban ELSE v_entity_pop END,
      v_type_libre,
      (ARRAY['lead','documentacion','enviado','estudio','aprobado','desembolsado'])[(random() * 6)::int + 1],
      (random() * 50 + 5)::int * 1000000,
      CASE WHEN random() < 0.5 THEN (random() * 50 + 5)::int * 1000000 ELSE NULL END,
      (ARRAY[24,36,48,60])[(random() * 4)::int + 1],
      15.0 + (random() * 8)::numeric
    );
  END LOOP;
END $$;

-- ============================================================
-- SEED: SEGUIMIENTOS
-- ============================================================
DO $$
DECLARE
  v_credit record;
BEGIN
  FOR v_credit IN SELECT id FROM public.credits LIMIT 5 LOOP
    INSERT INTO public.follow_ups (credit_id, asesor_id, channel, comment, next_action_date, next_action_note)
    SELECT
      v_credit.id,
      (SELECT asesor_id FROM public.credits WHERE id = v_credit.id),
      (ARRAY['llamada','whatsapp','visita','email'])[(random() * 4)::int + 1],
      'Confirmar documentacion pendiente del cliente',
      CURRENT_DATE + (random() * 7)::int,
      'Llamar para verificar estado del credito';
  END LOOP;
END $$;

-- ============================================================
-- RESUMEN
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'SETUP COMPLETADO';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Roles:           %', (SELECT count(*) FROM public.roles);
  RAISE NOTICE 'Usuarios:        %', (SELECT count(*) FROM public.profiles);
  RAISE NOTICE 'Entidades:       %', (SELECT count(*) FROM public.financial_entities);
  RAISE NOTICE 'Tipos credito:   %', (SELECT count(*) FROM public.credit_types);
  RAISE NOTICE 'Clientes:        %', (SELECT count(*) FROM public.clients);
  RAISE NOTICE 'Creditos:        %', (SELECT count(*) FROM public.credits);
  RAISE NOTICE 'Seguimientos:    %', (SELECT count(*) FROM public.follow_ups);
END $$;