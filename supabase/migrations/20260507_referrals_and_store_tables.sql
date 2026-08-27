-- Cria tabelas referenciadas por 20260507_store_and_points_functions.sql.
-- Essas tabelas foram criadas via Supabase Dashboard e nunca tiveram
-- migration correspondente. Esta migration as recria de forma idempotente
-- para que o histórico de migrations funcione em ambientes zerados (CI/local).
--
-- Ordem de aplicação (mesma data, ordem alfabética):
--   20260507_points_system.sql                ← point_adjustments, reward_campaigns
--   20260507_referrals_and_store_tables.sql   ← este arquivo (r < s)
--   20260507_store_and_points_functions.sql   ← funções que referenciam estas tabelas

-- ── Colunas faltantes em drivers ───────────────────────────────────────────
-- points: usado por increment_driver_points e redeem_store_item
-- referral_code: código único do motoboy para indicação
-- referred_by: código de quem indicou este motoboy
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS points         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_code  TEXT    UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by    TEXT;

-- ── Tabela referrals ────────────────────────────────────────────────────────
-- Rastreia indicações entre motoboys.
-- referred_driver_id é UNIQUE: cada motoboy só pode ser indicado uma vez.
CREATE TABLE IF NOT EXISTS public.referrals (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_driver_id   UUID        NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  referred_driver_id   UUID        NOT NULL UNIQUE REFERENCES public.drivers(id) ON DELETE CASCADE,
  referral_code        TEXT        NOT NULL,
  status               TEXT        NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending', 'validated', 'rewarded')),
  referred_deliveries  INTEGER     NOT NULL DEFAULT 0,
  validated_at         TIMESTAMPTZ,
  rewarded_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drivers_read_own_referrals"
  ON public.referrals FOR SELECT
  USING (
    referrer_driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
    OR
    referred_driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_referrals_referrer  ON public.referrals(referrer_driver_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred  ON public.referrals(referred_driver_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status    ON public.referrals(status);

-- ── Tabela store_items ──────────────────────────────────────────────────────
-- Itens disponíveis para resgate na loja de pontos.
-- stock = -1: ilimitado; stock = 0: esgotado.
CREATE TABLE IF NOT EXISTS public.store_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  points_cost INTEGER     NOT NULL CHECK (points_cost > 0),
  stock       INTEGER     NOT NULL DEFAULT -1,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  image_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.store_items ENABLE ROW LEVEL SECURITY;

-- ── Tabela store_redemptions ────────────────────────────────────────────────
-- Registros de resgates de itens da loja.
CREATE TABLE IF NOT EXISTS public.store_redemptions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id   UUID        NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  item_id     UUID        NOT NULL REFERENCES public.store_items(id),
  points_used INTEGER     NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'delivered', 'cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.store_redemptions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_store_redemptions_driver ON public.store_redemptions(driver_id);
CREATE INDEX IF NOT EXISTS idx_store_redemptions_status ON public.store_redemptions(status);
