-- ─────────────────────────────────────────────────────────────────────────────
-- Fluxo obrigatório de devolução após cancelamento com pacote coletado
-- Rodar no SQL Editor do Supabase: Database > SQL Editor > New query
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Novos status no enum delivery_status ───────────────────────────────────
-- cancelled_before_pickup : cancelada antes da coleta (sem devolução necessária)
-- cancelled_return_pending: cancelada após coleta — aguardando driver iniciar retorno
-- returning_package       : driver retornando o pacote ao ponto de coleta
-- package_returned        : pacote devolvido pelo driver
-- cancellation_completed  : fluxo de cancelamento encerrado com sucesso

ALTER TYPE delivery_status ADD VALUE IF NOT EXISTS 'cancelled_before_pickup';
ALTER TYPE delivery_status ADD VALUE IF NOT EXISTS 'cancelled_return_pending';
ALTER TYPE delivery_status ADD VALUE IF NOT EXISTS 'returning_package';
ALTER TYPE delivery_status ADD VALUE IF NOT EXISTS 'package_returned';
ALTER TYPE delivery_status ADD VALUE IF NOT EXISTS 'cancellation_completed';

-- ── 2. Novos campos na tabela deliveries ──────────────────────────────────────
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS requires_return        BOOLEAN      DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS returned_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by_role      TEXT,          -- 'driver' | 'restaurant' | 'admin'
  ADD COLUMN IF NOT EXISTS cancelled_by_user_id   UUID,
  ADD COLUMN IF NOT EXISTS return_started_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS package_returned_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_distance_km     NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS return_failed_reason   TEXT;

-- ── 3. Tabela de histórico de status (auditoria completa) ─────────────────────
CREATE TABLE IF NOT EXISTS delivery_status_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id     UUID        NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  from_status     TEXT,
  to_status       TEXT        NOT NULL,
  changed_by      UUID        REFERENCES auth.users(id),
  changed_by_role TEXT,
  reason          TEXT,
  metadata        JSONB       DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_status_history_delivery_idx
  ON delivery_status_history(delivery_id, created_at DESC);

-- ── 4. RLS para delivery_status_history ───────────────────────────────────────
ALTER TABLE delivery_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "history_select" ON delivery_status_history;
CREATE POLICY "history_select"
  ON delivery_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM deliveries d
      LEFT JOIN restaurants r ON r.id = d.restaurant_id
      LEFT JOIN drivers dr    ON dr.id = d.driver_id
      WHERE d.id = delivery_status_history.delivery_id
        AND (r.user_id = auth.uid() OR dr.user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "history_insert" ON delivery_status_history;
CREATE POLICY "history_insert"
  ON delivery_status_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
