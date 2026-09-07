-- ============================================================
-- Rate limit persistido en DB para el endpoint /api/auth/login.
-- Almacena los intentos fallidos por IP + email normalizado.
-- Reseteo automatico por ventana (window_seconds); limpieza manual
-- recomendada via cron o trigger.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id          bigserial PRIMARY KEY,
  rate_key    text NOT NULL,
  attempts    integer NOT NULL DEFAULT 0,
  reset_at    timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT login_attempts_rate_key_uq UNIQUE (rate_key)
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_reset ON public.login_attempts (reset_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_key ON public.login_attempts (rate_key);

-- Limpieza automatica de registros expirados (corre en cada update del row).
-- Para una limpieza masiva, ejecutar periodicamente:
--   DELETE FROM public.login_attempts WHERE reset_at < now();
