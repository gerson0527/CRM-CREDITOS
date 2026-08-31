-- ============================================================
-- SEDES (sucursales / oficinas)
-- ============================================================

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

ALTER TABLE public.sedes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sedes DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sedes_active ON public.sedes(active);

-- Agregar sede_id a profiles (nullable para admin/supervisor sin sede)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'sede_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN sede_id uuid REFERENCES public.sedes(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_profiles_sede ON public.profiles(sede_id);

-- ============================================================
-- SEED: 3 sedes en Bogotá
-- ============================================================
INSERT INTO public.sedes (id, name, code, address, city, phone, active) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Sede Centro', 'BOG-CENT', 'Cra 7 #32-15', 'Bogotá', '6017432100', true),
  ('22222222-2222-2222-2222-222222222222', 'Sede Norte', 'BOG-NORT', 'Calle 116 #19-30', 'Bogotá', '6017432200', true),
  ('33333333-3333-3333-3333-333333333333', 'Sede Sur', 'BOG-SUR', 'Av. 1 de Mayo #50-12', 'Bogotá', '6017432300', true)
ON CONFLICT (id) DO NOTHING;

-- Asignar sedes a los usuarios demo:
-- Admin → sede norte
-- Supervisor → sede centro
-- Asesores → distribuidos
UPDATE public.profiles SET sede_id = '11111111-1111-1111-1111-111111111111' WHERE email = 'supervisor@credilibranzas.com';
UPDATE public.profiles SET sede_id = '11111111-1111-1111-1111-111111111111' WHERE email = 'asesor1@credilibranzas.com';
UPDATE public.profiles SET sede_id = '22222222-2222-2222-2222-222222222222' WHERE email = 'asesor2@credilibranzas.com';
UPDATE public.profiles SET sede_id = '33333333-3333-3333-3333-333333333333' WHERE email = 'asesor3@credilibranzas.com';

-- Asignar clientes demo a sedes (basado en ciudad)
UPDATE public.clients SET city = 'Bogotá - Centro' WHERE document_number IN ('79123456', '52123456', '52456789');
UPDATE public.clients SET city = 'Bogotá - Norte' WHERE document_number IN ('80123456', '79456789');
UPDATE public.clients SET city = 'Bogotá - Sur' WHERE document_number IN ('52345678', '10234567', '52567890', '900123456-1');
UPDATE public.clients SET city = 'Medellín' WHERE document_number IN ('80123456');

-- Resumen
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'SEDES SETUP';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Sedes:           %', (SELECT count(*) FROM public.sedes);
  RAISE NOTICE 'Usuarios con sede: %', (SELECT count(*) FROM public.profiles WHERE sede_id IS NOT NULL);
END $$;