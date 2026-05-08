-- ============================================================
-- Extensão do perfil do motoboy — sessão 10 (2026-05-08)
-- Adiciona dados pessoais, endereço, veículo detalhado,
-- documentos completos e status granular de aprovação
-- ============================================================

-- ── Novos campos na tabela drivers ──────────────────────────
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS cpf            TEXT,
  ADD COLUMN IF NOT EXISTS birth_date     DATE,
  ADD COLUMN IF NOT EXISTS phone          TEXT,
  ADD COLUMN IF NOT EXISTS address_cep          TEXT,
  ADD COLUMN IF NOT EXISTS address_street       TEXT,
  ADD COLUMN IF NOT EXISTS address_number       TEXT,
  ADD COLUMN IF NOT EXISTS address_complement   TEXT,
  ADD COLUMN IF NOT EXISTS address_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS address_city         TEXT,
  ADD COLUMN IF NOT EXISTS address_state        TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_model  TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_color  TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_year   INTEGER,
  ADD COLUMN IF NOT EXISTS has_bag        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bag_type       TEXT,
  ADD COLUMN IF NOT EXISTS cnh_back_url   TEXT,
  ADD COLUMN IF NOT EXISTS selfie_url     TEXT,
  ADD COLUMN IF NOT EXISTS accepted_terms      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS driver_status  TEXT NOT NULL DEFAULT 'pending'
    CHECK (driver_status IN ('pending', 'approved', 'rejected', 'blocked'));

-- ── Backfill: sincroniza driver_status com is_approved ──────
UPDATE public.drivers SET driver_status = 'approved'
  WHERE is_approved = true AND driver_status = 'pending';

UPDATE public.drivers SET driver_status = 'rejected'
  WHERE is_approved = false AND rejection_reason IS NOT NULL AND driver_status = 'pending';

-- ── Unique indexes (parciais — permitem NULL) ────────────────
CREATE UNIQUE INDEX IF NOT EXISTS drivers_cpf_unique
  ON public.drivers (cpf) WHERE cpf IS NOT NULL;

-- license_plate já pode ter index, verifica antes de criar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'drivers' AND indexname = 'drivers_license_plate_unique'
  ) THEN
    CREATE UNIQUE INDEX drivers_license_plate_unique
      ON public.drivers (license_plate) WHERE license_plate IS NOT NULL;
  END IF;
END;
$$;
