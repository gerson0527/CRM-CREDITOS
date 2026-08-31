-- Agregar permisos 'sedes' y 'entidades' al admin
UPDATE public.roles
SET permissions = permissions || '["sedes","entidades"]'::jsonb
WHERE slug = 'admin'
  AND NOT (permissions ? 'sedes')
  AND NOT (permissions ? 'entidades');
