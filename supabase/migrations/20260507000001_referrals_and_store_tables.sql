-- Cria tabelas referenciadas por 20260507000002_store_and_points_functions.sql.
-- Essas tabelas foram criadas via Supabase Dashboard e nunca tiveram
-- migration correspondente. Esta migration as recria de forma idempotente
-- para que o histórico de migrations funcione em ambientes zerados (CI/local).

-- ── Colunas faltantes em drivers ───────────────────────────────────────────
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS points         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_code  TEXT    UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by    TEXT;

-- ── Tabela referrals ────────────────────────────────────────────────────────
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'referrals'
      AND policyname = 'drivers_read_own_referrals'
  ) THEN
    CREATE POLICY "drivers_read_own_referrals"
      ON public.referrals FOR SELECT
      USING (
        referrer_driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
        OR
        referred_driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
      );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_referrals_referrer  ON public.referrals(referrer_driver_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred  ON public.referrals(referred_driver_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status    ON public.referrals(status);

-- ── Tabela store_items ──────────────────────────────────────────────────────
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
