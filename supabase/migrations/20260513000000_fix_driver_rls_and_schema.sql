-- ============================================================
-- Fix: RLS de INSERT na tabela drivers + schema pendente
-- Executar no SQL Editor do Supabase
-- Sessão 2026-05-13
-- ============================================================

-- ── 1. Colunas novas (caso a migration anterior não tenha rodado) ──
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS cpf                   TEXT,
  ADD COLUMN IF NOT EXISTS birth_date            DATE,
  ADD COLUMN IF NOT EXISTS phone                 TEXT,
  ADD COLUMN IF NOT EXISTS address_cep           TEXT,
  ADD COLUMN IF NOT EXISTS address_street        TEXT,
  ADD COLUMN IF NOT EXISTS address_number        TEXT,
  ADD COLUMN IF NOT EXISTS address_complement    TEXT,
  ADD COLUMN IF NOT EXISTS address_neighborhood  TEXT,
  ADD COLUMN IF NOT EXISTS address_city          TEXT,
  ADD COLUMN IF NOT EXISTS address_state         TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_model         TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_color         TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_year          INTEGER,
  ADD COLUMN IF NOT EXISTS has_bag               BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bag_type              TEXT,
  ADD COLUMN IF NOT EXISTS cnh_back_url          TEXT,
  ADD COLUMN IF NOT EXISTS selfie_url            TEXT,
  ADD COLUMN IF NOT EXISTS accepted_terms        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at     TIMESTAMPTZ;

-- driver_status com CHECK constraint (ignora se já existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'drivers'
      AND column_name  = 'driver_status'
  ) THEN
    ALTER TABLE public.drivers
      ADD COLUMN driver_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (driver_status IN ('pending', 'approved', 'rejected', 'blocked'));
  END IF;
END;
$$;

-- accepted_product_types
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS accepted_product_types TEXT[] NOT NULL DEFAULT '{}';

-- vehicle_photo_url e rejection_reason (adicionados em outra sessão)
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS vehicle_photo_url  TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason   TEXT;

-- ── 2. Backfill driver_status baseado em is_approved ────────
UPDATE public.drivers
  SET driver_status = 'approved'
  WHERE is_approved = true
    AND driver_status = 'pending';

UPDATE public.drivers
  SET driver_status = 'rejected'
  WHERE is_approved = false
    AND rejection_reason IS NOT NULL
    AND driver_status = 'pending';

-- ── 3. Índices únicos parciais ───────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS drivers_cpf_unique
  ON public.drivers (cpf) WHERE cpf IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'drivers'
      AND indexname  = 'drivers_license_plate_unique'
  ) THEN
    CREATE UNIQUE INDEX drivers_license_plate_unique
      ON public.drivers (license_plate) WHERE license_plate IS NOT NULL;
  END IF;
END;
$$;

-- ── 4. Garante RLS ativado ────────────────────────────────────
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- ── 5. Recria política de INSERT (a mais provável de estar corrompida) ──
DROP POLICY IF EXISTS "Drivers can insert their own data" ON public.drivers;

CREATE POLICY "Drivers can insert their own data"
  ON public.drivers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ── 6. Garante SELECT próprio (necessário para o RETURNING após INSERT) ──
DROP POLICY IF EXISTS "Drivers can view their own data" ON public.drivers;

CREATE POLICY "Drivers can view their own data"
  ON public.drivers
  FOR SELECT
  USING (auth.uid() = user_id);

-- ── 7. Garante UPDATE próprio ────────────────────────────────
DROP POLICY IF EXISTS "Drivers can update their own data" ON public.drivers;

CREATE POLICY "Drivers can update their own data"
  ON public.drivers
  FOR UPDATE
  USING (auth.uid() = user_id);
