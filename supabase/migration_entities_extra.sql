-- ============================================================
-- Agregar: rango de crédito + comisión por entidad financiera
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_entities' AND column_name = 'credit_min_amount'
  ) THEN
    ALTER TABLE public.financial_entities ADD COLUMN credit_min_amount numeric;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_entities' AND column_name = 'credit_max_amount'
  ) THEN
    ALTER TABLE public.financial_entities ADD COLUMN credit_max_amount numeric;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_entities' AND column_name = 'commission_percentage'
  ) THEN
    ALTER TABLE public.financial_entities ADD COLUMN commission_percentage numeric DEFAULT 0;
  END IF;
END$$;

-- Seed de ejemplo: rangos y comisiones razonables para Colombia
UPDATE public.financial_entities SET
  credit_min_amount = 1000000,
  credit_max_amount = 100000000,
  commission_percentage = 2.5
WHERE name = 'Banco de Bogotá';

UPDATE public.financial_entities SET
  credit_min_amount = 2000000,
  credit_max_amount = 200000000,
  commission_percentage = 2.0
WHERE name = 'Bancolombia';

UPDATE public.financial_entities SET
  credit_min_amount = 500000,
  credit_max_amount = 50000000,
  commission_percentage = 3.0
WHERE name = 'Banco Popular';

UPDATE public.financial_entities SET
  credit_min_amount = 5000000,
  credit_max_amount = 300000000,
  commission_percentage = 2.2
WHERE name = 'BBVA Colombia';

UPDATE public.financial_entities SET
  credit_min_amount = 300000,
  credit_max_amount = 80000000,
  commission_percentage = 3.5
WHERE name = 'Banco Caja Social';

UPDATE public.financial_entities SET
  credit_min_amount = 5000000,
  credit_max_amount = 500000000,
  commission_percentage = 1.8
WHERE name = 'Davivienda';

UPDATE public.financial_entities SET
  credit_min_amount = 10000000,
  credit_max_amount = 1000000000,
  commission_percentage = 2.8
WHERE name = 'Banco de Occidente';

UPDATE public.financial_entities SET
  credit_min_amount = 2000000,
  credit_max_amount = 250000000,
  commission_percentage = 2.3
WHERE name = 'Scotiabank Colpatria';