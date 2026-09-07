-- ============================================================
-- Agregar estado 'devolucion' al CHECK constraint de credits.status
-- Permite representar créditos devueltos por la entidad financiera
-- para correcciones (documentos faltantes, información incompleta, etc.).
-- ============================================================

ALTER TABLE public.credits DROP CONSTRAINT IF EXISTS credits_status_check;

ALTER TABLE public.credits
  ADD CONSTRAINT credits_status_check
  CHECK (status IN (
    'lead', 'documentacion', 'enviado', 'estudio', 'devolucion',
    'aprobado', 'desembolsado', 'rechazado', 'desistido'
  ));

-- Refrescar la vista materializada/registros si existen
COMMENT ON COLUMN public.credits.status IS 'Estado del crédito. Incluye devolucion para créditos devueltos por la entidad.';
