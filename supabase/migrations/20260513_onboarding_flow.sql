-- ============================================================
-- Onboarding flow robusto: colunas + draft status + submitted_at
-- Executar no SQL Editor do Supabase
-- Sessão 2026-05-13
-- ============================================================

-- ── 1. Novas colunas de onboarding ──────────────────────────
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS onboarding_step       INTEGER     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarding_completed  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitted_at          TIMESTAMPTZ;

-- ── 2. Adicionar 'draft' ao CHECK constraint de driver_status ──
-- Precisa dropar e recriar o constraint
ALTER TABLE public.drivers DROP CONSTRAINT IF EXISTS drivers_driver_status_check;

ALTER TABLE public.drivers
  ADD CONSTRAINT drivers_driver_status_check
    CHECK (driver_status IN ('draft', 'pending', 'approved', 'rejected', 'blocked'));

-- ── 3. Backfill: registros existentes já são considerados submetidos ──
UPDATE public.drivers
  SET onboarding_completed = true,
      onboarding_step      = 6,
      submitted_at         = COALESCE(submitted_at, created_at)
  WHERE driver_status IN ('pending', 'approved', 'rejected', 'blocked')
    AND submitted_at IS NULL;

-- ── 4. RLS: garantir que admins podem ver todos os drivers (incluindo draft) ──
DROP POLICY IF EXISTS "Admins can manage all drivers" ON public.drivers;
CREATE POLICY "Admins can manage all drivers"
  ON public.drivers
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
