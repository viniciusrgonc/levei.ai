-- =============================================================
-- Testes: Endurecimento RLS de notifications + índice
-- (migration 20260829000000_harden_notifications_rls)
--
-- Complementa notification_platform_test.sql com testes runtime
-- e verificações da nova cláusula WITH CHECK.
--
-- Cobre:
--   T1 : policy UPDATE tem cláusula WITH CHECK definida
--   T2 : índice idx_nc_sent_by existe em notification_campaigns
--   T3 : authenticated User B não afeta notificação de User A
--        (RLS USING bloqueia — 0 rows, sem erro)
--   T4 : authenticated User A consegue UPDATE is_read
--        na própria notificação
--   T5 : authenticated User A consegue UPDATE read_at
--        na própria notificação
--   T6 : trigger bloqueia alteração de user_id
--        quando chamado como authenticated (SQLSTATE 42501)
--
-- UUIDs com prefixos cafe/decade (hex válido) — distintos de todos os outros testes.
-- =============================================================

BEGIN;

SELECT plan(6);

-- ─────────────────────────────────────────────────────────────
-- SETUP: dois usuários de teste isolados
-- ─────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, aud, role
) VALUES
  (
    'cafe0001-0000-0000-0000-000000000001',
    'harden_user_a@test.levei',
    crypt('senha123', gen_salt('bf')),
    now(), '{}', '{}', now(), now(), 'authenticated', 'authenticated'
  ),
  (
    'cafe0002-0000-0000-0000-000000000002',
    'harden_user_b@test.levei',
    crypt('senha123', gen_salt('bf')),
    now(), '{}', '{}', now(), now(), 'authenticated', 'authenticated'
  );

INSERT INTO public.profiles (id, full_name)
VALUES
  ('cafe0001-0000-0000-0000-000000000001', 'Harden User A'),
  ('cafe0002-0000-0000-0000-000000000002', 'Harden User B')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- Notificação pertencente ao User A (inserida como postgres/service_role)
INSERT INTO public.notifications (id, user_id, title, message, type, is_read)
VALUES (
  'decade01-0000-0000-0000-000000000001',
  'cafe0001-0000-0000-0000-000000000001',
  'Notificação de User A',
  'Mensagem de teste.',
  'info',
  false
);

-- ─────────────────────────────────────────────────────────────
-- T1: policy UPDATE em notifications tem WITH CHECK definida
--     (nova cláusula adicionada pela migration)
-- ─────────────────────────────────────────────────────────────

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'notifications'
      AND cmd        = 'UPDATE'
      AND with_check IS NOT NULL
  ),
  'T1: policy UPDATE em notifications tem cláusula WITH CHECK definida'
);

-- ─────────────────────────────────────────────────────────────
-- T2: índice idx_nc_sent_by existe em notification_campaigns
-- ─────────────────────────────────────────────────────────────

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'notification_campaigns'
      AND indexname  = 'idx_nc_sent_by'
  ),
  'T2: índice idx_nc_sent_by existe em notification_campaigns'
);

-- ─────────────────────────────────────────────────────────────
-- T3: authenticated User B NÃO afeta notificação de User A
--
-- RLS USING (auth.uid() = user_id) impede que o WHERE id = ...
-- encontre a linha — UPDATE retorna 0 rows, sem exceção.
-- Verificamos que is_read permanece false após a tentativa.
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub',  'cafe0002-0000-0000-0000-000000000002',
      'role', 'authenticated'
    )::text,
    true
  );
END; $$;
SET LOCAL ROLE authenticated;

UPDATE public.notifications
  SET is_read = true
  WHERE id = 'decade01-0000-0000-0000-000000000001';

SET LOCAL ROLE postgres;

SELECT is(
  (SELECT is_read FROM public.notifications
    WHERE id = 'decade01-0000-0000-0000-000000000001'),
  false,
  'T3: User B não consegue UPDATE na notificação de User A (RLS USING bloqueia, 0 rows)'
);

-- ─────────────────────────────────────────────────────────────
-- T4: authenticated User A consegue UPDATE is_read
--     na própria notificação
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub',  'cafe0001-0000-0000-0000-000000000001',
      'role', 'authenticated'
    )::text,
    true
  );
END; $$;
SET LOCAL ROLE authenticated;

UPDATE public.notifications
  SET is_read = true
  WHERE id = 'decade01-0000-0000-0000-000000000001';

SET LOCAL ROLE postgres;

SELECT is(
  (SELECT is_read FROM public.notifications
    WHERE id = 'decade01-0000-0000-0000-000000000001'),
  true,
  'T4: User A consegue UPDATE is_read = true na própria notificação'
);

-- ─────────────────────────────────────────────────────────────
-- T5: authenticated User A consegue UPDATE read_at
--     na própria notificação
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub',  'cafe0001-0000-0000-0000-000000000001',
      'role', 'authenticated'
    )::text,
    true
  );
END; $$;
SET LOCAL ROLE authenticated;

UPDATE public.notifications
  SET read_at = now()
  WHERE id = 'decade01-0000-0000-0000-000000000001';

SET LOCAL ROLE postgres;

SELECT ok(
  (SELECT read_at IS NOT NULL FROM public.notifications
    WHERE id = 'decade01-0000-0000-0000-000000000001'),
  'T5: User A consegue UPDATE read_at na própria notificação'
);

-- ─────────────────────────────────────────────────────────────
-- T6: trigger bloqueia alteração de user_id
--     quando chamado como authenticated (SQLSTATE 42501)
--
-- Fluxo:
--   1. RLS USING passa (user_id = auth.uid())
--   2. trigger dispara (auth.uid() IS NOT NULL)
--   3. NEW.user_id != OLD.user_id → RAISE EXCEPTION ERRCODE 42501
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub',  'cafe0001-0000-0000-0000-000000000001',
      'role', 'authenticated'
    )::text,
    true
  );
END; $$;
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$
    UPDATE public.notifications
      SET user_id = 'cafe0002-0000-0000-0000-000000000002'
      WHERE id = 'decade01-0000-0000-0000-000000000001'
  $$,
  '42501',
  NULL,
  'T6: trigger bloqueia alteração de user_id quando chamado como authenticated (SQLSTATE 42501)'
);

SET LOCAL ROLE postgres;

-- ─────────────────────────────────────────────────────────────
-- FINISH
-- ─────────────────────────────────────────────────────────────

SELECT * FROM finish();

ROLLBACK;
