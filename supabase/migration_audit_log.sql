-- ============================================================
-- Audit log para acciones privilegiadas (compliance fintech).
-- Escritura exclusiva desde server-side (helper lib/audit.ts).
-- RLS deshabilitado: solo el backend usa esta tabla, el cliente
-- no debe tener acceso de lectura/escritura directa.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          bigserial PRIMARY KEY,
  actor_id    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  target_type text,
  target_id   uuid,
  diff        jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip          text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor
  ON public.audit_log (actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_target
  ON public.audit_log (target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_action
  ON public.audit_log (action);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON public.audit_log (created_at DESC);

ALTER TABLE public.audit_log DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.audit_log IS
  'Bitacora de acciones privilegiadas. Escritura exclusiva server-side (lib/audit.ts).';
