import { NextResponse } from 'next/server';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAuth = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function requireAdmin(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
  }
  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores pueden ejecutar migraciones' }, { status: 403 });
  }
  return null;
}

const MIGRATION_SQL = `
-- ============================================================
-- ROLES SYSTEM
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

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select_authenticated" ON public.roles;
CREATE POLICY "roles_select_authenticated" ON public.roles
  FOR SELECT TO authenticated USING (true);

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
`;

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (guard) return guard;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json(
      {
        error: 'DATABASE_URL no está configurada en el servidor.',
        hint: 'Agrega la connection string de PostgreSQL en .env.local y reinicia el servidor. Se obtiene en Supabase Dashboard → Project Settings → Database → Connection string → URI.',
      },
      { status: 500 }
    );
  }

  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    await client.query(MIGRATION_SQL);
    const { rows } = await client.query('SELECT slug, name, is_default FROM public.roles ORDER BY name');
    return NextResponse.json({
      success: true,
      message: 'Migración ejecutada correctamente.',
      roles: rows,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Error al ejecutar la migración: ${err.message}` },
      { status: 500 }
    );
  } finally {
    await client.end().catch(() => {});
  }
}