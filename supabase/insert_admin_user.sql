-- ============================================================
-- CREAR USUARIO ADMINISTRADOR DEL CRM
-- ============================================================
-- Autenticacion propia de la aplicacion: public.users + public.profiles.
-- Ejecutar despues de production_complete_migration.sql.
-- Puede ejecutarse varias veces sin duplicar el usuario.
--
-- Credenciales iniciales:
-- Email: admin@credilibranzas.com
-- Clave temporal: Credi123456!
-- Cambiar la clave despues del primer ingreso.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_user_id uuid;
  v_role_id uuid;
BEGIN
  SELECT id INTO v_role_id
  FROM public.roles
  WHERE slug = 'admin'
  LIMIT 1;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'No existe el rol admin. Ejecuta primero production_complete_migration.sql';
  END IF;

  SELECT id INTO v_user_id
  FROM public.users
  WHERE email = 'admin@credilibranzas.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO public.users (id, email, password_hash, status)
    VALUES (
      v_user_id,
      'admin@credilibranzas.com',
      crypt('Credi123456!', gen_salt('bf')),
      'activo'
    );
  ELSE
    UPDATE public.users
    SET status = 'activo', updated_at = now()
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

  RAISE NOTICE 'Usuario administrador creado o actualizado: admin@credilibranzas.com';
END $$;

-- Verificacion sin mostrar la contrasena.
SELECT u.id, u.email, u.status, p.full_name, p.role
FROM public.users u
JOIN public.profiles p ON p.user_id = u.id
WHERE u.email = 'admin@credilibranzas.com';
