-- ============================================================
-- SEPARAR AUTH DE PROFILE: tabla users + link en profiles
-- ============================================================

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text,
  status text NOT NULL DEFAULT 'activo' CHECK (status IN ('pendiente_aprobacion','activo','rechazado','inactivo')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- En local sin Supabase Auth no hay rol "authenticated", así que deshabilitamos RLS
-- para esta tabla. La lógica de permisos ya está en el código (lib/auth/visibility.ts
-- y app/api/auth/*). En producción con Supabase se aplican las policies equivalentes.
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 1. Migrar usuarios existentes desde profiles
INSERT INTO public.users (id, email, password_hash, status)
SELECT id, email, password_hash, status
FROM public.profiles
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  status = EXCLUDED.status;

-- 2. Agregar user_id a profiles (FK) y backfillear
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN user_id uuid REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END$$;

UPDATE public.profiles p
SET user_id = u.id
FROM public.users u
WHERE u.email = p.email AND p.user_id IS NULL;

-- 3. Asegurar que user_id sea NOT NULL (después del backfill)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id IS NULL
  ) THEN
    RAISE NOTICE 'Hay perfiles sin user_id — revisar antes de hacer NOT NULL';
  ELSE
    ALTER TABLE public.profiles ALTER COLUMN user_id SET NOT NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- ============================================================
-- RESUMEN
-- ============================================================
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'MIGRACIÓN users ↔ profiles';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Users creados:    %', (SELECT count(*) FROM public.users);
  RAISE NOTICE 'Profiles:        %', (SELECT count(*) FROM public.profiles);
  RAISE NOTICE 'Profiles con user_id: %', (SELECT count(*) FROM public.profiles WHERE user_id IS NOT NULL);
END $$;