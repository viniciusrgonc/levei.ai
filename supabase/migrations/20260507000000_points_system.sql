-- ============================================================
-- Sistema de Pontos e Campanhas — Levei.ai
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ── 1. Ajustes manuais de pontos ────────────────────────────
CREATE TABLE IF NOT EXISTS public.point_adjustments (
  id            UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id     UUID         NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  admin_id      UUID         NOT NULL,           -- auth.uid() do admin
  amount        INTEGER      NOT NULL,            -- positivo = adição, negativo = remoção
  type          TEXT         NOT NULL CHECK (type IN ('bonus','removal','adjustment','campaign')),
  observation   TEXT,
  campaign_id   UUID,                             -- referência futura a reward_campaigns
  created_at    TIMESTAMPTZ  DEFAULT NOW() NOT NULL
);

ALTER TABLE public.point_adjustments ENABLE ROW LEVEL SECURITY;

-- Admins: acesso total
CREATE POLICY "admins_all_point_adjustments"
  ON public.point_adjustments FOR ALL
  USING   (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- Motoboys: ler apenas os próprios
CREATE POLICY "drivers_read_own_adjustments"
  ON public.point_adjustments FOR SELECT
  USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- ── 2. Campanhas de multiplicador ───────────────────────────
CREATE TABLE IF NOT EXISTS public.reward_campaigns (
  id                  UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  name                TEXT          NOT NULL,
  multiplier          NUMERIC(4,2)  NOT NULL DEFAULT 2.0,
  starts_at           TIMESTAMPTZ   NOT NULL,
  ends_at             TIMESTAMPTZ   NOT NULL,
  is_active           BOOLEAN       NOT NULL DEFAULT true,
  product_type_filter TEXT,                        -- NULL = todos os tipos
  min_distance_km     NUMERIC(6,2),                -- NULL = sem mínimo
  weekdays_only       BOOLEAN       NOT NULL DEFAULT false,
  night_hours_only    BOOLEAN       NOT NULL DEFAULT false,
  created_by          UUID,
  created_at          TIMESTAMPTZ   DEFAULT NOW() NOT NULL
);

ALTER TABLE public.reward_campaigns ENABLE ROW LEVEL SECURITY;

-- Admins: acesso total
CREATE POLICY "admins_all_reward_campaigns"
  ON public.reward_campaigns FOR ALL
  USING   (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'));

-- Todos autenticados: ver campanhas ativas
CREATE POLICY "authenticated_read_active_campaigns"
  ON public.reward_campaigns FOR SELECT
  USING (is_active = true AND auth.uid() IS NOT NULL);

-- ── 3. Índices de performance ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_point_adjustments_driver_id ON public.point_adjustments(driver_id);
CREATE INDEX IF NOT EXISTS idx_point_adjustments_created_at ON public.point_adjustments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reward_campaigns_dates ON public.reward_campaigns(starts_at, ends_at);
