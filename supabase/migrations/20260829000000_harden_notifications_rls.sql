-- ============================================================
-- Harden Notifications RLS — Etapa 3 (segurança)
--
-- O que esta migration faz:
--   1. Adiciona WITH CHECK à policy UPDATE de notifications
--      (defesa em profundidade — o trigger já bloqueia,
--       a policy garante que a linha resultante também
--       pertença ao usuário que faz a operação)
--   2. Cria índice de performance em notification_campaigns
--      (cobre a query de histórico por admin no painel)
--
-- Não altera:
--   - Nenhuma policy de INSERT (authenticated não insere)
--   - O trigger protect_notification_columns (permanece ativo)
--   - Qualquer outra tabela
-- ============================================================

-- ── 1. Policy UPDATE com WITH CHECK ──────────────────────────────────────────
--
-- Estado anterior (migration 20251021015257):
--   CREATE POLICY "Users can update their own notifications"
--     ON public.notifications FOR UPDATE
--     USING (auth.uid() = user_id);
--
-- Estado novo:
--   Mesma USING + WITH CHECK, garantindo que a linha resultante
--   ainda pertence ao usuário autenticado (previne "mover"
--   uma notificação para outro user_id via UPDATE).

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING   (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 2. Índice de performance em notification_campaigns ───────────────────────
--
-- Cobre a query de histórico de campanhas por admin (sent_by):
--   SELECT * FROM notification_campaigns
--   WHERE sent_by = $1
--   ORDER BY created_at DESC

CREATE INDEX IF NOT EXISTS idx_nc_sent_by
  ON public.notification_campaigns (sent_by, created_at DESC);
