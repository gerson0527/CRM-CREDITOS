-- ============================================================
-- Sesiones revocables (server-side). Permite invalidar sesiones
-- robadas/comprometidas sin esperar a que expiren.
-- Solo se guarda el HASH SHA-256 del token, nunca el token.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON public.user_sessions(token_hash);

ALTER TABLE public.user_sessions DISABLE ROW LEVEL SECURITY;
