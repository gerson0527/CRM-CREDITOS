-- ============================================================
-- Campos para el estado 'devolucion':
--   devolucion_reason: motivo por el que la entidad devuelve el crédito
--   devolucion_requires_upload: indica si el asesor debe subir archivos
-- ============================================================

ALTER TABLE public.credits
  ADD COLUMN IF NOT EXISTS devolucion_reason text,
  ADD COLUMN IF NOT EXISTS devolucion_requires_upload boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.credits.devolucion_reason IS 'Motivo por el que la entidad financiera devolvió el crédito (visible para el asesor).';
COMMENT ON COLUMN public.credits.devolucion_requires_upload IS 'Si true, el asesor debe subir documentos faltantes antes de continuar el flujo.';
