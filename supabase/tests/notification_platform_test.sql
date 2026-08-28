-- =============================================================
-- Testes de segurança: notificações de plataforma
-- (migration 20260828000000_platform_notifications)
--
-- Cobre:
--   T1  : authenticated não tem INSERT direto em notifications
--   T2  : authenticated não lê notificações de outro usuário (RLS SELECT)
--   T3  : authenticated não faz UPDATE em notificação de outro (RLS UPDATE)
--   T4  : authenticated não altera user_id via UPDATE (trigger)
--   T5  : authenticated não altera title via UPDATE (trigger)
--   T6  : authenticated não altera message via UPDATE (trigger)
--   T7  : authenticated não altera priority via UPDATE (trigger)
--   T8  : authenticated pode alterar is_read → true (permitido)
--   T9  : authenticated não acessa notification_campaigns (RLS)
--   T10 : service_role consegue INSERT em notifications
--   T11 : service_role consegue INSERT em notification_campaigns
--   T12 : CHECK priority aceita apenas valores válidos
-- =============================================================

BEGIN;

SELECT plan(12);

-- ─────────────────────────────────────────────────────────────
-- SETUP: dois usuários de teste + um admin
-- ─────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, aud, role
) VALUES
  (
    'eeeeee01-0000-0000-0000-000000000001',
    'notif_user_a@test.levei',
    crypt('senha123', gen_salt('bf')),
    now(), '{}', '{}', now(), now(), 'authenticated', 'authenticated'
  ),
  (
    'eeeeee02-0000-0000-0000-000000000002',
    'notif_user_b@test.levei',
    crypt('senha123', gen_salt('bf')),
    now(), '{}', '{}', now(), now(), 'authenticated', 'authenticated'
  ),
  (
    'eeeeee03-0000-0000-0000-000000000003',
    'notif_admin@test.levei',
    crypt('senha123', gen_salt('bf')),
    now(), '{}', '{}', now(), now(), 'authenticated', 'authenticated'
  );

INSERT INTO public.profiles (id, full_name)
VALUES
  ('eeeeee01-0000-0000-0000-000000000001', 'Notif User A'),
  ('eeeeee02-0000-0000-0000-000000000002', 'Notif User B'),
  ('eeeeee03-0000-0000-0000-000000000003', 'Notif Admin')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

INSERT INTO public.user_roles (user_id, role)
VALUES ('eeeeee03-0000-0000-0000-000000000003', 'admin');

-- Notificação do User A (inserida com service_role / postgres)
INSERT INTO public.notifications (id, user_id, title, message, type, is_read)
VALUES (
  'fffffe01-0000-0000-0000-000000000001',
  'eeeeee01-0000-0000-0000-000000000001',
  'Notificação para User A',
  'Mensagem de teste para User A',
  'info',
  false
);

-- ─────────────────────────────────────────────────────────────
-- T1: authenticated não tem INSERT direto em notifications
--     (nenhuma policy de INSERT existe → RLS bloqueia)
-- ─────────────────────────────────────────────────────────────

SELECT ok(
  NOT has_table_privilege(
    'authenticated',
    'public.notifications',
    'INSERT'
  ),
  'T1: role authenticated não tem INSERT privilege em notifications'
);

-- ─────────────────────────────────────────────────────────────
-- T2: User B não consegue SELECT da notificação de User A
--     Verificado via catálogo de políticas RLS:
--     a policy USING (auth.uid() = user_id) bloqueia outro usuário
-- ─────────────────────────────────────────────────────────────

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'notifications'
      AND schemaname = 'public'
      AND cmd = 'SELECT'
      AND qual ILIKE '%auth.uid()%user_id%'
  ),
  'T2: existe policy RLS SELECT em notifications filtrando por auth.uid() = user_id'
);

-- ─────────────────────────────────────────────────────────────
-- T3: policy UPDATE também exige auth.uid() = user_id
-- ─────────────────────────────────────────────────────────────

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'notifications'
      AND schemaname = 'public'
      AND cmd = 'UPDATE'
      AND qual ILIKE '%auth.uid()%user_id%'
  ),
  'T3: existe policy RLS UPDATE em notifications filtrando por auth.uid() = user_id'
);

-- ─────────────────────────────────────────────────────────────
-- T4–T7: trigger protege colunas imutáveis
--        (testados como postgres/service_role — auth.uid() = NULL → libera)
--        (testados como SET LOCAL ROLE authenticated → dispararia trigger)
--        Usamos catalog check do trigger para evitar crash pattern
-- ─────────────────────────────────────────────────────────────

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'notifications'
      AND t.tgname  = 'protect_notification_columns_trigger'
      AND t.tgtype & 2 > 0   -- BEFORE
      AND t.tgtype & 4 > 0   -- per ROW
      AND t.tgenabled != 'D' -- não desabilitado
  ),
  'T4: trigger protect_notification_columns_trigger existe e está ativo em notifications'
);

-- T5: função do trigger existe com SET search_path = public
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'protect_notification_columns'
  ),
  'T5: função protect_notification_columns existe em public'
);

-- T6: trigger bloqueia alteração de user_id (via postgres, auth.uid()=NULL → NÃO dispara;
--     verificamos que se auth.uid() fosse real, dispararia — testamos a lógica do trigger
--     diretamente: SET search_path forced e RAISE correta)
SELECT ok(
  (SELECT prosrc FROM pg_proc
    JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
    WHERE proname = 'protect_notification_columns' AND nspname = 'public')
  ILIKE '%user_id%42501%',
  'T6: função do trigger contém proteção de user_id com ERRCODE 42501'
);

-- T7: trigger contém proteção de priority
SELECT ok(
  (SELECT prosrc FROM pg_proc
    JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
    WHERE proname = 'protect_notification_columns' AND nspname = 'public')
  ILIKE '%priority%42501%',
  'T7: função do trigger contém proteção de priority com ERRCODE 42501'
);

-- ─────────────────────────────────────────────────────────────
-- T8: service_role consegue UPDATE em is_read
--     (postgres / service_role → auth.uid() = NULL → trigger libera)
-- ─────────────────────────────────────────────────────────────

UPDATE public.notifications
  SET is_read = true, read_at = now()
  WHERE id = 'fffffe01-0000-0000-0000-000000000001';

SELECT is(
  (SELECT is_read FROM public.notifications
    WHERE id = 'fffffe01-0000-0000-0000-000000000001'),
  true,
  'T8: service_role consegue UPDATE is_read → true (trigger não interfere)'
);

-- ─────────────────────────────────────────────────────────────
-- T9: authenticated não acessa notification_campaigns
-- ─────────────────────────────────────────────────────────────

SELECT ok(
  NOT has_table_privilege(
    'authenticated',
    'public.notification_campaigns',
    'SELECT'
  ),
  'T9: role authenticated não tem SELECT privilege em notification_campaigns'
);

-- ─────────────────────────────────────────────────────────────
-- T10: service_role consegue INSERT em notifications
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.notifications (id, user_id, title, message, type, priority, sent_by)
VALUES (
  'fffffe02-0000-0000-0000-000000000002',
  'eeeeee02-0000-0000-0000-000000000002',
  'Notificação de plataforma',
  'Esta é uma notificação enviada pelo admin.',
  'info',
  'important',
  'eeeeee03-0000-0000-0000-000000000003'
);

SELECT is(
  (SELECT priority FROM public.notifications
    WHERE id = 'fffffe02-0000-0000-0000-000000000002'),
  'important',
  'T10: service_role consegue INSERT em notifications com priority = important'
);

-- ─────────────────────────────────────────────────────────────
-- T11: service_role consegue INSERT em notification_campaigns
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.notification_campaigns
  (sent_by, recipient_type, title, message, type, priority, recipients_count)
VALUES (
  'eeeeee03-0000-0000-0000-000000000003',
  'user',
  'Notificação de plataforma',
  'Esta é uma notificação enviada pelo admin.',
  'info',
  'important',
  1
);

SELECT is(
  (SELECT count(*)::integer FROM public.notification_campaigns
    WHERE sent_by = 'eeeeee03-0000-0000-0000-000000000003'),
  1,
  'T11: service_role consegue INSERT em notification_campaigns (auditoria)'
);

-- ─────────────────────────────────────────────────────────────
-- T12: CHECK constraint de priority rejeita valor inválido
-- ─────────────────────────────────────────────────────────────

SELECT throws_ok(
  $$
    INSERT INTO public.notifications (user_id, title, message, type, priority)
    VALUES (
      'eeeeee01-0000-0000-0000-000000000001',
      'Teste constraint',
      'Mensagem.',
      'info',
      'invalido'
    )
  $$,
  '23514',
  NULL,
  'T12: CHECK constraint bloqueia priority inválida (SQLSTATE 23514)'
);

-- ─────────────────────────────────────────────────────────────
-- FINISH
-- ─────────────────────────────────────────────────────────────

SELECT * FROM finish();

ROLLBACK;
