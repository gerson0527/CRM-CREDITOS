-- ============================================================
-- ROLES SYSTEM with configurable permissions
-- ============================================================
-- Cada rol tiene un array de "permisos" en JSONB. Los permisos
-- corresponden a las vistas del sidebar:
--   dashboard, kanban, calendario, clientes, creditos,
--   creditos.nuevo, reportes, solicitudes, usuarios, roles

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

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden LEER roles (para que el sidebar
-- sepa qué permisos tiene el usuario actual)
DROP POLICY IF EXISTS "roles_select_authenticated" ON public.roles;
CREATE POLICY "roles_select_authenticated" ON public.roles
  FOR SELECT TO authenticated
  USING (true);

-- Solo admins pueden CREAR / EDITAR / BORRAR roles
DROP POLICY IF EXISTS "roles_admin_insert" ON public.roles;
CREATE POLICY "roles_admin_insert" ON public.roles
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "roles_admin_update" ON public.roles;
CREATE POLICY "roles_admin_update" ON public.roles
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "roles_admin_delete" ON public.roles;
CREATE POLICY "roles_admin_delete" ON public.roles
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Seed de roles iniciales del sistema
INSERT INTO public.roles (slug, name, description, permissions, is_system, is_default) VALUES
  ('admin', 'Administrador', 'Acceso total al sistema. Es el rol por defecto al crear usuarios nuevos.',
   '["dashboard","kanban","calendario","clientes","creditos","creditos.nuevo","reportes","solicitudes","usuarios","roles"]'::jsonb,
   true, true),
  ('supervisor', 'Supervisor', 'Gestiona el equipo de asesores a su cargo.',
   '["dashboard","kanban","calendario","clientes","creditos","creditos.nuevo","reportes"]'::jsonb,
   true, false),
  ('asesor', 'Asesor', 'Asesor comercial. Solo ve sus propios clientes, créditos y seguimientos.',
   '["dashboard","kanban","calendario","clientes","creditos","creditos.nuevo","reportes"]'::jsonb,
   true, false)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  is_system = EXCLUDED.is_system,
  is_default = EXCLUDED.is_default;

-- Backfill: asociar role_id en profiles a partir del slug existente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN role_id uuid REFERENCES public.roles(id) ON DELETE SET NULL;
  END IF;
END$$;

UPDATE public.profiles p
SET role_id = r.id
FROM public.roles r
WHERE r.slug = p.role AND p.role_id IS NULL;

-- Helper: profiles.role sigue siendo el texto del rol
-- pero ahora role_id apunta a la fila de roles con todos los permisos
COMMENT ON TABLE public.roles IS 'Roles configurables con permisos por vista del sidebar';