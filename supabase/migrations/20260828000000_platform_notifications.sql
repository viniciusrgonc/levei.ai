-- ============================================================
-- Platform Notifications — Etapa 1: Schema
--
-- O que esta migration faz:
--   1. Adiciona colunas a public.notifications
--      (priority, expires_at, read_at, sent_by)
--   2. Cria trigger BEFORE UPDATE em notifications para
--      proteger colunas imutáveis contra alteração pelo usuário
--   3. Cria tabela notification_campaigns (auditoria de envios)
--   4. RLS em notification_campaigns
--   5. Policy admin SELECT em notifications
--   6. Índices de performance
--
-- Premissas:
--   - A tabela notifications já existe (migration 20251021015257)
--   - RLS SELECT/UPDATE próprio usuário já existe
--   - Realtime já habilitado na tabela notifications
--   - Nenhuma policy de INSERT existe (correto — somente service_role insere)
--   - Não altera migrations anteriores
-- ============================================================

-- ── 1. Colunas adicionais em notifications ────────────────────────────────────

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS priority   TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority   IN ('normal', 'important', 'urgent')),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 2. Trigger: protege colunas imutáveis em notifications ───────────────────
--
-- Mesma lógica do trigger protect_restaurant_financial_columns:
--   auth.uid() = NULL → service_role ou postgres → caller trusted → libera
--   auth.uid() = UUID → usuário autenticado → verifica imutabilidade
--
-- Usuário pode alterar apenas: is_read, read_at
-- Tudo mais é imutável após criação.

CREATE OR REPLACE FUNCTION public.protect_notification_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN

    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION
        'Não autorizado: user_id não pode ser alterado.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.title IS DISTINCT FROM OLD.title THEN
      RAISE EXCEPTION
        'Não autorizado: title não pode ser alterado.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.message IS DISTINCT FROM OLD.message THEN
      RAISE EXCEPTION
        'Não autorizado: message não pode ser alterado.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.type IS DISTINCT FROM OLD.type THEN
      RAISE EXCEPTION
        'Não autorizado: type não pode ser alterado.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      RAISE EXCEPTION
        'Não autorizado: priority não pode ser alterado.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.delivery_id IS DISTINCT FROM OLD.delivery_id THEN
      RAISE EXCEPTION
        'Não autorizado: delivery_id não pode ser alterado.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.sent_by IS DISTINCT FROM OLD.sent_by THEN
      RAISE EXCEPTION
        'Não autorizado: sent_by não pode ser alterado.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION
        'Não autorizado: created_at não pode ser alterado.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
      RAISE EXCEPTION
        'Não autorizado: expires_at não pode ser alterado.'
        USING ERRCODE = '42501';
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_notification_columns_trigger ON public.notifications;

CREATE TRIGGER protect_notification_columns_trigger
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_notification_columns();

-- ── 3. Tabela de auditoria de campanhas ──────────────────────────────────────
--
-- Um registro por envio do admin. Não substitui os registros individuais
-- em notifications — serve para histórico/auditoria do painel admin.
-- Constraints de tamanho garantem texto puro gerenciável.

CREATE TABLE IF NOT EXISTS public.notification_campaigns (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  recipient_type    TEXT        NOT NULL
    CHECK (recipient_type IN ('all', 'all_drivers', 'all_restaurants', 'user')),
  recipient_user_id UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  title             TEXT        NOT NULL
    CHECK (char_length(title)   BETWEEN 1 AND 100),
  message           TEXT        NOT NULL
    CHECK (char_length(message) BETWEEN 1 AND 1000),
  type              TEXT        NOT NULL DEFAULT 'info'
    CHECK (type     IN ('info', 'success', 'warning', 'error', 'system', 'security')),
  priority          TEXT        NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'important', 'urgent')),
  recipients_count  INTEGER     NOT NULL DEFAULT 0
    CHECK (recipients_count >= 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_campaigns ENABLE ROW LEVEL SECURITY;

-- Somente admins acessam campanhas — usuários comuns não têm nenhum acesso
DROP POLICY IF EXISTS "admins_all_notification_campaigns" ON public.notification_campaigns;
CREATE POLICY "admins_all_notification_campaigns"
  ON public.notification_campaigns FOR ALL
  USING   (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── 4. Policy admin SELECT em notifications ──────────────────────────────────
--
-- Admins podem visualizar todas as notificações para suporte/auditoria.
-- Separada da policy de usuário para clareza e independência.

DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;
CREATE POLICY "Admins can view all notifications"
  ON public.notifications FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- ── 5. Índices de performance ─────────────────────────────────────────────────

-- Cobre a query principal do sino:
--   SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- Cobre contagem de não lidas:
--   SELECT count(*) FROM notifications WHERE user_id = $1 AND is_read = false
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, is_read)
  WHERE is_read = false;

-- Histórico de campanhas no painel admin:
--   SELECT * FROM notification_campaigns WHERE sent_by = $1 ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_notification_campaigns_created
  ON public.notification_campaigns (created_at DESC);
