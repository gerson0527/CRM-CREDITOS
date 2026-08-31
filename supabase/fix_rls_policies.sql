-- ============================================================
-- SCRIPT DEFINITIVO DE CORRECCIÓN RLS (Error 42P17)
-- Copia este código y ejecútalo en Supabase -> SQL Editor -> Run
-- ============================================================

-- 1. Eliminar políticas antiguas en PROFILES que generaban recursión
DROP POLICY IF EXISTS "select_all_profiles_admin" ON public.profiles;
DROP POLICY IF EXISTS "select_team_profiles_supervisor" ON public.profiles;
DROP POLICY IF EXISTS "update_any_profile_admin" ON public.profiles;
DROP POLICY IF EXISTS "insert_profile_admin" ON public.profiles;
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "select_profiles" ON public.profiles;
DROP POLICY IF EXISTS "insert_profiles" ON public.profiles;
DROP POLICY IF EXISTS "update_profiles" ON public.profiles;

-- 2. Funciones Helper con SECURITY DEFINER (Bypass de RLS dentro de la función)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION public.is_supervisor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'supervisor' FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- 3. Políticas Unificadas Sin Recursión para PROFILES
CREATE POLICY "select_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id 
    OR public.is_admin() 
    OR (public.is_supervisor() AND supervisor_id = auth.uid())
  );

CREATE POLICY "insert_profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = id 
    OR public.is_admin()
  );

CREATE POLICY "update_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = id 
    OR public.is_admin()
  )
  WITH CHECK (
    auth.uid() = id 
    OR public.is_admin()
  );

-- 4. POLÍTICAS TABLA FINANCIAL ENTITIES
DROP POLICY IF EXISTS "select_financial_entities" ON public.financial_entities;
CREATE POLICY "select_financial_entities" ON public.financial_entities
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_financial_entities_admin" ON public.financial_entities;
CREATE POLICY "insert_financial_entities_admin" ON public.financial_entities
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "update_financial_entities_admin" ON public.financial_entities;
CREATE POLICY "update_financial_entities_admin" ON public.financial_entities
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "delete_financial_entities_admin" ON public.financial_entities;
CREATE POLICY "delete_financial_entities_admin" ON public.financial_entities
  FOR DELETE TO authenticated USING (public.is_admin());

-- 5. POLÍTICAS TABLA CREDIT TYPES
DROP POLICY IF EXISTS "select_credit_types" ON public.credit_types;
CREATE POLICY "select_credit_types" ON public.credit_types
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_credit_types_admin" ON public.credit_types;
CREATE POLICY "insert_credit_types_admin" ON public.credit_types
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "update_credit_types_admin" ON public.credit_types;
CREATE POLICY "update_credit_types_admin" ON public.credit_types
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "delete_credit_types_admin" ON public.credit_types;
CREATE POLICY "delete_credit_types_admin" ON public.credit_types
  FOR DELETE TO authenticated USING (public.is_admin());

-- 6. POLÍTICAS TABLA CLIENTS
DROP POLICY IF EXISTS "select_clients_admin" ON public.clients;
DROP POLICY IF EXISTS "select_clients_supervisor" ON public.clients;
DROP POLICY IF EXISTS "select_clients_own" ON public.clients;
DROP POLICY IF EXISTS "select_clients" ON public.clients;
CREATE POLICY "select_clients" ON public.clients
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin()
    OR (
      public.is_supervisor() AND EXISTS (
        SELECT 1 FROM public.profiles team WHERE team.id = clients.created_by AND team.supervisor_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "insert_clients" ON public.clients;
DROP POLICY IF EXISTS "insert_clients_admin" ON public.clients;
CREATE POLICY "insert_clients" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by OR public.is_admin());

DROP POLICY IF EXISTS "update_clients_own" ON public.clients;
DROP POLICY IF EXISTS "update_clients_admin" ON public.clients;
DROP POLICY IF EXISTS "update_clients" ON public.clients;
CREATE POLICY "update_clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin())
  WITH CHECK (true);

-- 7. POLÍTICAS TABLA CREDITS
DROP POLICY IF EXISTS "select_credits_admin" ON public.credits;
DROP POLICY IF EXISTS "select_credits_supervisor" ON public.credits;
DROP POLICY IF EXISTS "select_credits_own" ON public.credits;
DROP POLICY IF EXISTS "select_credits" ON public.credits;
CREATE POLICY "select_credits" ON public.credits
  FOR SELECT TO authenticated
  USING (
    asesor_id = auth.uid()
    OR public.is_admin()
    OR (
      public.is_supervisor() AND EXISTS (
        SELECT 1 FROM public.profiles team WHERE team.id = credits.asesor_id AND team.supervisor_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "insert_credits_own" ON public.credits;
DROP POLICY IF EXISTS "insert_credits_admin" ON public.credits;
DROP POLICY IF EXISTS "insert_credits" ON public.credits;
CREATE POLICY "insert_credits" ON public.credits
  FOR INSERT TO authenticated
  WITH CHECK (asesor_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "update_credits_own" ON public.credits;
DROP POLICY IF EXISTS "update_credits_supervisor" ON public.credits;
DROP POLICY IF EXISTS "update_credits_admin" ON public.credits;
DROP POLICY IF EXISTS "update_credits" ON public.credits;
CREATE POLICY "update_credits" ON public.credits
  FOR UPDATE TO authenticated
  USING (
    asesor_id = auth.uid()
    OR public.is_admin()
    OR (
      public.is_supervisor() AND EXISTS (
        SELECT 1 FROM public.profiles team WHERE team.id = credits.asesor_id AND team.supervisor_id = auth.uid()
      )
    )
  )
  WITH CHECK (true);
