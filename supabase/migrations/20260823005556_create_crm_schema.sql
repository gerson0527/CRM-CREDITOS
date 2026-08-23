/*
# Create CRM schema for Credilibranzas JG

## Overview
This migration creates the complete database schema for a credit outsourcing CRM.
Supports roles (admin, supervisor, asesor), clients, credit applications,
documents, follow-ups, financial entities, and audit history.

## New Tables
1. profiles — extends auth.users with role, status, team info
2. financial_entities — banks/funds receiving credit applications
3. credit_types — catalog of credit types with config
4. clients — people applying for credit
5. credits — the main credit application record
6. credit_status_history — audit trail of status changes
7. documents — uploaded files for a credit application
8. follow_ups — contact notes and reminders

## Security (RLS)
- RLS enabled on every table
- profiles: self-read, admin-read-all, supervisor-read-team
- credits/clients/documents/follow_ups: admin all, supervisor team, asesor own
*/

-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'asesor' CHECK (role IN ('admin','supervisor','asesor')),
  status text NOT NULL DEFAULT 'pendiente_aprobacion' CHECK (status IN ('pendiente_aprobacion','activo','rechazado','inactivo')),
  supervisor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  monthly_goal numeric DEFAULT 0,
  commission_rate numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "select_all_profiles_admin" ON public.profiles;
CREATE POLICY "select_all_profiles_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "select_team_profiles_supervisor" ON public.profiles;
CREATE POLICY "select_team_profiles_supervisor" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'supervisor')
    AND supervisor_id = auth.uid()
  );

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_any_profile_admin" ON public.profiles;
CREATE POLICY "update_any_profile_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "insert_profile_admin" ON public.profiles;
CREATE POLICY "insert_profile_admin" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============================================================
-- FINANCIAL ENTITIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.financial_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  credit_types text[] DEFAULT '{}',
  avg_response_days integer DEFAULT 7,
  contact_name text,
  contact_phone text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.financial_entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_financial_entities" ON public.financial_entities;
CREATE POLICY "select_financial_entities" ON public.financial_entities
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_financial_entities_admin" ON public.financial_entities;
CREATE POLICY "insert_financial_entities_admin" ON public.financial_entities
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "update_financial_entities_admin" ON public.financial_entities;
CREATE POLICY "update_financial_entities_admin" ON public.financial_entities
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "delete_financial_entities_admin" ON public.financial_entities;
CREATE POLICY "delete_financial_entities_admin" ON public.financial_entities
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============================================================
-- CREDIT TYPES TABLE
-- ============================================================
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

ALTER TABLE public.credit_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_credit_types" ON public.credit_types;
CREATE POLICY "select_credit_types" ON public.credit_types
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_credit_types_admin" ON public.credit_types;
CREATE POLICY "insert_credit_types_admin" ON public.credit_types
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "update_credit_types_admin" ON public.credit_types;
CREATE POLICY "update_credit_types_admin" ON public.credit_types
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "delete_credit_types_admin" ON public.credit_types;
CREATE POLICY "delete_credit_types_admin" ON public.credit_types
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============================================================
-- CLIENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  document_number text NOT NULL,
  phone text,
  email text,
  address text,
  city text,
  reported_income numeric DEFAULT 0,
  personal_refs jsonb DEFAULT '[]',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_clients_admin" ON public.clients;
CREATE POLICY "select_clients_admin" ON public.clients
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "select_clients_supervisor" ON public.clients;
CREATE POLICY "select_clients_supervisor" ON public.clients
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'supervisor')
    AND EXISTS (
      SELECT 1 FROM public.profiles team
      WHERE team.id = clients.created_by AND team.supervisor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "select_clients_own" ON public.clients;
CREATE POLICY "select_clients_own" ON public.clients
  FOR SELECT TO authenticated
  USING (created_by = auth.uid());

DROP POLICY IF EXISTS "insert_clients" ON public.clients;
CREATE POLICY "insert_clients" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "insert_clients_admin" ON public.clients;
CREATE POLICY "insert_clients_admin" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "update_clients_own" ON public.clients;
CREATE POLICY "update_clients_own" ON public.clients
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "update_clients_admin" ON public.clients;
CREATE POLICY "update_clients_admin" ON public.clients
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (true);

-- ============================================================
-- CREDITS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  asesor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  entity_id uuid REFERENCES public.financial_entities(id) ON DELETE SET NULL,
  credit_type_id uuid REFERENCES public.credit_types(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'lead' CHECK (status IN ('lead','documentacion','enviado','estudio','aprobado','desembolsado','rechazado','desistido')),
  requested_amount numeric DEFAULT 0,
  approved_amount numeric,
  term_months integer,
  rate numeric,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  status_changed_at timestamptz DEFAULT now()
);

ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_credits_admin" ON public.credits;
CREATE POLICY "select_credits_admin" ON public.credits
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "select_credits_supervisor" ON public.credits;
CREATE POLICY "select_credits_supervisor" ON public.credits
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'supervisor')
    AND EXISTS (
      SELECT 1 FROM public.profiles team
      WHERE team.id = credits.asesor_id AND team.supervisor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "select_credits_own" ON public.credits;
CREATE POLICY "select_credits_own" ON public.credits
  FOR SELECT TO authenticated
  USING (asesor_id = auth.uid());

DROP POLICY IF EXISTS "insert_credits_own" ON public.credits;
CREATE POLICY "insert_credits_own" ON public.credits
  FOR INSERT TO authenticated
  WITH CHECK (asesor_id = auth.uid());

DROP POLICY IF EXISTS "insert_credits_admin" ON public.credits;
CREATE POLICY "insert_credits_admin" ON public.credits
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "update_credits_own" ON public.credits;
CREATE POLICY "update_credits_own" ON public.credits
  FOR UPDATE TO authenticated
  USING (asesor_id = auth.uid())
  WITH CHECK (asesor_id = auth.uid());

DROP POLICY IF EXISTS "update_credits_supervisor" ON public.credits;
CREATE POLICY "update_credits_supervisor" ON public.credits
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'supervisor')
    AND EXISTS (
      SELECT 1 FROM public.profiles team
      WHERE team.id = credits.asesor_id AND team.supervisor_id = auth.uid()
    )
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS "update_credits_admin" ON public.credits;
CREATE POLICY "update_credits_admin" ON public.credits
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (true);

-- ============================================================
-- CREDIT STATUS HISTORY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.credit_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id uuid NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at timestamptz DEFAULT now(),
  comment text
);

ALTER TABLE public.credit_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_history_admin" ON public.credit_status_history;
CREATE POLICY "select_history_admin" ON public.credit_status_history
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "select_history_supervisor" ON public.credit_status_history;
CREATE POLICY "select_history_supervisor" ON public.credit_status_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'supervisor')
    AND EXISTS (
      SELECT 1 FROM public.credits c
      JOIN public.profiles team ON team.id = c.asesor_id
      WHERE c.id = credit_status_history.credit_id AND team.supervisor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "select_history_own" ON public.credit_status_history;
CREATE POLICY "select_history_own" ON public.credit_status_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.credits c WHERE c.id = credit_status_history.credit_id AND c.asesor_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_history_own" ON public.credit_status_history;
CREATE POLICY "insert_history_own" ON public.credit_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.credits c WHERE c.id = credit_status_history.credit_id AND c.asesor_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_history_supervisor" ON public.credit_status_history;
CREATE POLICY "insert_history_supervisor" ON public.credit_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'supervisor')
    AND EXISTS (
      SELECT 1 FROM public.credits c
      JOIN public.profiles team ON team.id = c.asesor_id
      WHERE c.id = credit_status_history.credit_id AND team.supervisor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_history_admin" ON public.credit_status_history;
CREATE POLICY "insert_history_admin" ON public.credit_status_history
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============================================================
-- DOCUMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id uuid NOT NULL REFERENCES public.credits(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_url text NOT NULL,
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','validado','rechazado')),
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at timestamptz DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_documents_admin" ON public.documents;
CREATE POLICY "select_documents_admin" ON public.documents
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "select_documents_supervisor" ON public.documents;
CREATE POLICY "select_documents_supervisor" ON public.documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'supervisor')
    AND EXISTS (
      SELECT 1 FROM public.credits c
      JOIN public.profiles team ON team.id = c.asesor_id
      WHERE c.id = documents.credit_id AND team.supervisor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "select_documents_own" ON public.documents;
CREATE POLICY "select_documents_own" ON public.documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.credits c WHERE c.id = documents.credit_id AND c.asesor_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_documents_own" ON public.documents;
CREATE POLICY "insert_documents_own" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.credits c WHERE c.id = documents.credit_id AND c.asesor_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_documents_admin" ON public.documents;
CREATE POLICY "insert_documents_admin" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "update_documents_admin" ON public.documents;
CREATE POLICY "update_documents_admin" ON public.documents
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "update_documents_supervisor" ON public.documents;
CREATE POLICY "update_documents_supervisor" ON public.documents
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'supervisor')
    AND EXISTS (
      SELECT 1 FROM public.credits c
      JOIN public.profiles team ON team.id = c.asesor_id
      WHERE c.id = documents.credit_id AND team.supervisor_id = auth.uid()
    )
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS "update_documents_own" ON public.documents;
CREATE POLICY "update_documents_own" ON public.documents
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.credits c WHERE c.id = documents.credit_id AND c.asesor_id = auth.uid())
  )
  WITH CHECK (true);

-- ============================================================
-- FOLLOW UPS TABLE
-- ============================================================
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

ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_followups_admin" ON public.follow_ups;
CREATE POLICY "select_followups_admin" ON public.follow_ups
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "select_followups_supervisor" ON public.follow_ups;
CREATE POLICY "select_followups_supervisor" ON public.follow_ups
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'supervisor')
    AND EXISTS (
      SELECT 1 FROM public.credits c
      JOIN public.profiles team ON team.id = c.asesor_id
      WHERE c.id = follow_ups.credit_id AND team.supervisor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "select_followups_own" ON public.follow_ups;
CREATE POLICY "select_followups_own" ON public.follow_ups
  FOR SELECT TO authenticated
  USING (asesor_id = auth.uid());

DROP POLICY IF EXISTS "insert_followups_own" ON public.follow_ups;
CREATE POLICY "insert_followups_own" ON public.follow_ups
  FOR INSERT TO authenticated
  WITH CHECK (asesor_id = auth.uid());

DROP POLICY IF EXISTS "update_followups_own" ON public.follow_ups;
CREATE POLICY "update_followups_own" ON public.follow_ups
  FOR UPDATE TO authenticated
  USING (asesor_id = auth.uid())
  WITH CHECK (asesor_id = auth.uid());

DROP POLICY IF EXISTS "delete_followups_own" ON public.follow_ups;
CREATE POLICY "delete_followups_own" ON public.follow_ups
  FOR DELETE TO authenticated
  USING (asesor_id = auth.uid());

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_credits_asesor ON public.credits(asesor_id);
CREATE INDEX IF NOT EXISTS idx_credits_status ON public.credits(status);
CREATE INDEX IF NOT EXISTS idx_credits_client ON public.credits(client_id);
CREATE INDEX IF NOT EXISTS idx_credits_entity ON public.credits(entity_id);
CREATE INDEX IF NOT EXISTS idx_documents_credit ON public.documents(credit_id);
CREATE INDEX IF NOT EXISTS idx_followups_credit ON public.follow_ups(credit_id);
CREATE INDEX IF NOT EXISTS idx_followups_asesor ON public.follow_ups(asesor_id);
CREATE INDEX IF NOT EXISTS idx_history_credit ON public.credit_status_history(credit_id);
CREATE INDEX IF NOT EXISTS idx_profiles_supervisor ON public.profiles(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients(created_by);

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Nuevo usuario'),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TRIGGER: update updated_at and status_changed_at on credits
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_credit_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credits_updated ON public.credits;
CREATE TRIGGER trg_credits_updated
  BEFORE UPDATE ON public.credits
  FOR EACH ROW EXECUTE FUNCTION public.update_credit_timestamp();
