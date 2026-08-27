-- Tabela de mensagens de chat por entrega.
-- Criada originalmente via Supabase Dashboard; esta migration a recria
-- de forma idempotente para ambientes zerados (CI/local).
-- RLS e policies definidas em 20260808_security_rls.sql.

CREATE TABLE IF NOT EXISTS public.delivery_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID        NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  sender_id   UUID        NOT NULL,
  sender_role TEXT        NOT NULL,
  message     TEXT        NOT NULL,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_messages_delivery
  ON public.delivery_messages(delivery_id);

CREATE INDEX IF NOT EXISTS idx_delivery_messages_created
  ON public.delivery_messages(delivery_id, created_at);
