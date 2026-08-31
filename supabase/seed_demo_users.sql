-- ============================================================
-- SCRIPT DE SEMILLA PARA USUARIOS DE PRUEBA / DEMO EN SUPABASE
-- Si prefieres crear los usuarios directamente desde el Editor SQL de Supabase,
-- puedes ejecutar estas consultas en Supabase > SQL Editor.
-- ============================================================

-- Habilitar extensión pgcrypto si no está habilitada
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Función helper para registrar usuarios en auth.users y public.profiles
DO $$
DECLARE
  v_user_id uuid;
BEGIN

  -- 1. Administrador (admin@credilibranzas.com)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@credilibranzas.com') THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
    ) VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000',
      'admin@credilibranzas.com',
      crypt('Credi123456!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Administrador Principal"}',
      now(), now(), 'authenticated', 'authenticated'
    );

    INSERT INTO public.profiles (id, full_name, role, status, phone)
    VALUES (v_user_id, 'Administrador Principal', 'admin', 'activo', '3000000000')
    ON CONFLICT (id) DO UPDATE SET role = 'admin', status = 'activo';
  END IF;

  -- 2. Supervisor (supervisor@credilibranzas.com)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'supervisor@credilibranzas.com') THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
    ) VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000',
      'supervisor@credilibranzas.com',
      crypt('Credi123456!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Supervisor de Ventas"}',
      now(), now(), 'authenticated', 'authenticated'
    );

    INSERT INTO public.profiles (id, full_name, role, status, phone)
    VALUES (v_user_id, 'Supervisor de Ventas', 'supervisor', 'activo', '3000000001')
    ON CONFLICT (id) DO UPDATE SET role = 'supervisor', status = 'activo';
  END IF;

  -- 3. Asesor Juan (asesor1@credilibranzas.com)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'asesor1@credilibranzas.com') THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
    ) VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000',
      'asesor1@credilibranzas.com',
      crypt('Credi123456!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Juan Pérez (Asesor)"}',
      now(), now(), 'authenticated', 'authenticated'
    );

    INSERT INTO public.profiles (id, full_name, role, status, phone)
    VALUES (v_user_id, 'Juan Pérez (Asesor)', 'asesor', 'activo', '3000000002')
    ON CONFLICT (id) DO UPDATE SET role = 'asesor', status = 'activo';
  END IF;

  -- 4. Asesor Maria (asesor2@credilibranzas.com)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'asesor2@credilibranzas.com') THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
    ) VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000',
      'asesor2@credilibranzas.com',
      crypt('Credi123456!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"María Rodríguez (Asesor)"}',
      now(), now(), 'authenticated', 'authenticated'
    );

    INSERT INTO public.profiles (id, full_name, role, status, phone)
    VALUES (v_user_id, 'María Rodríguez (Asesor)', 'asesor', 'activo', '3000000003')
    ON CONFLICT (id) DO UPDATE SET role = 'asesor', status = 'activo';
  END IF;

  -- 5. Asesor pendiente (asesor3@credilibranzas.com)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'asesor3@credilibranzas.com') THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
    ) VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000',
      'asesor3@credilibranzas.com',
      crypt('Credi123456!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Asesor Pendiente"}',
      now(), now(), 'authenticated', 'authenticated'
    );

    INSERT INTO public.profiles (id, full_name, role, status, phone)
    VALUES (v_user_id, 'Asesor Pendiente', 'asesor', 'pendiente_aprobacion', '3000000004')
    ON CONFLICT (id) DO UPDATE SET role = 'asesor', status = 'pendiente_aprobacion';
  END IF;

END $$;
