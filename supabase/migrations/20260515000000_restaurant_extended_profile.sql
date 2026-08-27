-- Campos estendidos de perfil de restaurante.
-- Adicionados via Supabase Dashboard; esta migration os recria
-- de forma idempotente para ambientes zerados (CI/local).

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS person_type          TEXT        NOT NULL DEFAULT 'pj',
  ADD COLUMN IF NOT EXISTS cpf                  TEXT,
  ADD COLUMN IF NOT EXISTS company_name         TEXT,
  ADD COLUMN IF NOT EXISTS fantasy_name         TEXT,
  ADD COLUMN IF NOT EXISTS phone                TEXT,
  ADD COLUMN IF NOT EXISTS address_cep          TEXT,
  ADD COLUMN IF NOT EXISTS address_street       TEXT,
  ADD COLUMN IF NOT EXISTS address_number       TEXT,
  ADD COLUMN IF NOT EXISTS address_complement   TEXT,
  ADD COLUMN IF NOT EXISTS address_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS address_city         TEXT,
  ADD COLUMN IF NOT EXISTS address_state        TEXT,
  ADD COLUMN IF NOT EXISTS address_label        TEXT,
  ADD COLUMN IF NOT EXISTS business_hours       JSONB,
  ADD COLUMN IF NOT EXISTS accepted_terms       BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_blocked           BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS block_reason         TEXT;
