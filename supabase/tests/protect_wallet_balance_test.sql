-- =============================================================
-- Testes de segurança: protect_restaurant_financial_columns
-- (SEC-004 hardening — SECURITY_AUDIT.md)
--
-- Migrations testadas:
--   20260826_protect_restaurant_financial_columns.sql  (trigger inicial)
--   20260826_revise_wallet_balance_trigger.sql         (escopo corrigido)
--
-- O trigger protege EXCLUSIVAMENTE wallet_balance.
-- blocked_balance: decisão pendente (ver migration de revisão).
--
-- Permissões efetivas após as migrations:
--   authenticated → BLOQUEADO (42501) ao tentar alterar wallet_balance
--   postgres      → PERMITIDO (superusuário / contexto interno)
--   service_role  → PERMITIDO (sem claim 'sub' no JWT → auth.uid() = NULL)
--
-- Mapa dos 16 testes:
--   TESTE 1  : authenticated aumenta wallet_balance         → BLOQUEADO
--   TESTE 2  : authenticated reduz wallet_balance           → BLOQUEADO
--   TESTE 3  : authenticated SET wallet_balance = 999999    → BLOQUEADO
--   TESTE 3b : wallet_balance permanece 500.00              → integridade
--   TESTE 4a : authenticated atualiza phone                 → PASSA
--   TESTE 4b : phone gravado corretamente                   → integridade
--   TESTE 4c : wallet_balance inalterado após update phone  → integridade
--   TESTE 5a : authenticated altera phone + wallet_balance  → BLOQUEADO
--   TESTE 5b : phone NÃO foi alterado (tx inteira reverteu) → integridade
--   TESTE 6a : outro restaurante tenta alterar linha alheia → 0 rows (RLS)
--   TESTE 6b : wallet_balance de user1 inalterado           → integridade
--   TESTE 7a : service_role altera wallet_balance           → PASSA
--   TESTE 7b : wallet_balance = 600.00                      → integridade
--   TESTE 8a : add_restaurant_funds (SECURITY DEFINER)      → PASSA
--   TESTE 8b : wallet_balance = 650.00                      → integridade
--   TESTE 9  : valor negativo bloqueado pelo CHECK (23514)  → constraint
--
-- Como executar:
--   supabase start
--   supabase test db
-- =============================================================

BEGIN;

SELECT plan(16);

-- ─────────────────────────────────────────────────────────────
-- SETUP: dados de teste isolados (revertidos no ROLLBACK final)
-- ─────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, aud, role
) VALUES
  (
    'cccccccc-0001-0000-0000-000000000001',
    'rest_wallet_sec@test.levei',
    crypt('senha123', gen_salt('bf')),
    now(), '{}', '{}', now(), now(), 'authenticated', 'authenticated'
  ),
  (
    'cccccccc-0002-0000-0000-000000000002',
    'rest_wallet_sec2@test.levei',
    crypt('senha123', gen_salt('bf')),
    now(), '{}', '{}', now(), now(), 'authenticated', 'authenticated'
  );

-- on_auth_user_created auto-cria profiles; ON CONFLICT garante o full_name correto
INSERT INTO public.profiles (id, full_name) VALUES
  ('cccccccc-0001-0000-0000-000000000001', 'Restaurante Sec A'),
  ('cccccccc-0002-0000-0000-000000000002', 'Restaurante Sec B')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('cccccccc-0001-0000-0000-000000000001', 'restaurant'),
  ('cccccccc-0002-0000-0000-000000000002', 'restaurant');

INSERT INTO public.restaurants (id, user_id, business_name, cnpj, wallet_balance, blocked_balance, address, latitude, longitude)
VALUES
  (
    'eeeee001-0000-0000-0000-000000000001',
    'cccccccc-0001-0000-0000-000000000001',
    'Restaurante Sec A', '22.222.222/0001-22',
    500.00, 0.00, 'Rua Teste, 1', -19.9, -43.9
  ),
  (
    'eeeee002-0000-0000-0000-000000000002',
    'cccccccc-0002-0000-0000-000000000002',
    'Restaurante Sec B', '33.333.333/0001-33',
    200.00, 0.00, 'Rua Teste, 2', -19.9, -43.9
  );

-- ─────────────────────────────────────────────────────────────
-- Simula sessão autenticada como dono do Restaurante A
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub',  'cccccccc-0001-0000-0000-000000000001',
      'role', 'authenticated'
    )::text,
    true
  );
END;
$$;

SET LOCAL ROLE authenticated;

-- ─────────────────────────────────────────────────────────────
-- TESTE 1: Restaurante tenta AUMENTAR wallet_balance → BLOQUEADO
-- ─────────────────────────────────────────────────────────────

SELECT throws_ok(
  $$
    UPDATE public.restaurants
    SET wallet_balance = wallet_balance + 100
    WHERE id = 'eeeee001-0000-0000-0000-000000000001'
  $$,
  '42501',
  NULL,
  'TESTE 1: authenticated aumenta wallet_balance → 42501'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 2: Restaurante tenta REDUZIR wallet_balance → BLOQUEADO
-- ─────────────────────────────────────────────────────────────

SELECT throws_ok(
  $$
    UPDATE public.restaurants
    SET wallet_balance = wallet_balance - 100
    WHERE id = 'eeeee001-0000-0000-0000-000000000001'
  $$,
  '42501',
  NULL,
  'TESTE 2: authenticated reduz wallet_balance → 42501'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 3: Restaurante tenta SET wallet_balance = 999999 → BLOQUEADO
-- ─────────────────────────────────────────────────────────────

SELECT throws_ok(
  $$
    UPDATE public.restaurants
    SET wallet_balance = 999999
    WHERE id = 'eeeee001-0000-0000-0000-000000000001'
  $$,
  '42501',
  NULL,
  'TESTE 3: authenticated SET wallet_balance = 999999 → 42501'
);

-- Confirma integridade: wallet_balance permanece inalterado
SET LOCAL ROLE postgres;

SELECT is(
  (SELECT wallet_balance FROM public.restaurants
   WHERE id = 'eeeee001-0000-0000-0000-000000000001'),
  500.00::numeric,
  'TESTE 3b: wallet_balance permanece 500.00 após tentativas 1–3'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 4: Restaurante atualiza phone (campo não financeiro) → PASSA
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub',  'cccccccc-0001-0000-0000-000000000001',
      'role', 'authenticated'
    )::text,
    true
  );
END;
$$;

SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$
    UPDATE public.restaurants
    SET phone = '11999990001'
    WHERE id = 'eeeee001-0000-0000-0000-000000000001'
  $$,
  'TESTE 4a: authenticated atualiza phone → sem erro'
);

SET LOCAL ROLE postgres;

SELECT is(
  (SELECT phone FROM public.restaurants
   WHERE id = 'eeeee001-0000-0000-0000-000000000001'),
  '11999990001',
  'TESTE 4b: phone gravado corretamente'
);

SELECT is(
  (SELECT wallet_balance FROM public.restaurants
   WHERE id = 'eeeee001-0000-0000-0000-000000000001'),
  500.00::numeric,
  'TESTE 4c: wallet_balance permanece 500.00 após update de phone'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 5: Restaurante tenta alterar phone E wallet_balance
-- simultaneamente → OPERAÇÃO INTEIRA BLOQUEADA
--
-- O trigger dispara no nível de linha. Como wallet_balance muda,
-- a exceção é lançada antes de qualquer escrita ser confirmada.
-- O phone também NÃO é gravado (a transação inteira reverte).
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub',  'cccccccc-0001-0000-0000-000000000001',
      'role', 'authenticated'
    )::text,
    true
  );
END;
$$;

SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$
    UPDATE public.restaurants
    SET phone = '11000000000', wallet_balance = wallet_balance + 100
    WHERE id = 'eeeee001-0000-0000-0000-000000000001'
  $$,
  '42501',
  NULL,
  'TESTE 5a: authenticated altera phone + wallet_balance simultaneamente → operação inteira bloqueada (42501)'
);

SET LOCAL ROLE postgres;

SELECT is(
  (SELECT phone FROM public.restaurants
   WHERE id = 'eeeee001-0000-0000-0000-000000000001'),
  '11999990001',   -- valor do TESTE 4 — não foi alterado
  'TESTE 5b: phone NÃO foi alterado pois a transação inteira reverteu'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 6: Outro restaurante (user2) tenta alterar wallet_balance
-- de user1 → BLOQUEADO pela RLS (0 rows, sem exceção)
--
-- A RLS USING (auth.uid() = user_id) filtra a linha antes do trigger.
-- Resultado: 0 rows affected, nenhuma exceção — silêncio intencional.
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub',  'cccccccc-0002-0000-0000-000000000002',
      'role', 'authenticated'
    )::text,
    true
  );
END;
$$;

SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$
    UPDATE public.restaurants
    SET wallet_balance = 999999
    WHERE id = 'eeeee001-0000-0000-0000-000000000001'
  $$,
  'TESTE 6a: authenticated (user2) tenta alterar wallet_balance de user1 → 0 rows, sem exceção (RLS filtra)'
);

SET LOCAL ROLE postgres;

SELECT is(
  (SELECT wallet_balance FROM public.restaurants
   WHERE id = 'eeeee001-0000-0000-0000-000000000001'),
  500.00::numeric,
  'TESTE 6b: wallet_balance de user1 permanece 500.00 — intocado por user2'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 7: service_role (postgres, JWT sem 'sub') altera
-- wallet_balance → PASSA
--
-- Representa Edge Functions usando SUPABASE_SERVICE_ROLE_KEY.
-- auth.uid() = NULL (sem claim 'sub') → trigger não interfere.
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,   -- sem 'sub'
    true
  );
END;
$$;

SELECT lives_ok(
  $$
    UPDATE public.restaurants
    SET wallet_balance = wallet_balance + 100
    WHERE id = 'eeeee001-0000-0000-0000-000000000001'
  $$,
  'TESTE 7a: service_role (postgres, sem sub) altera wallet_balance → PASSA'
);

SELECT is(
  (SELECT wallet_balance FROM public.restaurants
   WHERE id = 'eeeee001-0000-0000-0000-000000000001'),
  600.00::numeric,
  'TESTE 7b: wallet_balance = 600.00 após operação via service_role'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 8: Função SECURITY DEFINER legítima (add_restaurant_funds)
-- consegue alterar wallet_balance → PASSA
--
-- add_restaurant_funds é SECURITY DEFINER chamada como postgres.
-- JWT de service_role não contém 'sub' → auth.uid() = NULL dentro
-- do trigger → trigger permite a alteração.
-- Este teste valida o caminho completo: função → UPDATE → trigger.
-- ─────────────────────────────────────────────────────────────

SELECT is(
  (
    SELECT (public.add_restaurant_funds(
      'eeeee001-0000-0000-0000-000000000001'::uuid,
      50.00
    ) ->> 'success')::boolean
  ),
  true,
  'TESTE 8a: add_restaurant_funds (SECURITY DEFINER, service_role JWT) → sucesso'
);

SELECT is(
  (SELECT wallet_balance FROM public.restaurants
   WHERE id = 'eeeee001-0000-0000-0000-000000000001'),
  650.00::numeric,
  'TESTE 8b: wallet_balance = 650.00 após add_restaurant_funds (600 + 50)'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 9: Valor negativo permanece bloqueado pelo CHECK constraint
--
-- Quando chamado como postgres (auth.uid() = NULL), o trigger permite
-- a alteração. Porém o CHECK constraint positive_wallet_balance
-- (wallet_balance >= 0) rejeita o valor negativo com 23514.
-- ─────────────────────────────────────────────────────────────

SELECT throws_ok(
  $$
    UPDATE public.restaurants
    SET wallet_balance = -100
    WHERE id = 'eeeee001-0000-0000-0000-000000000001'
  $$,
  '23514',   -- check_violation
  NULL,
  'TESTE 9: wallet_balance = -100 bloqueado pelo CHECK constraint (23514) mesmo via service_role'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 10 (ASSERT não-pgTAP): Frontend não requer alteração
--
-- O frontend (RestaurantWallet.tsx) tentava .update({ wallet_balance })
-- que agora falha em PASSO 1 com 42501 — mesmo comportamento externo
-- de antes (o PASSO 2 de INSERT em transactions já falhava com 42501).
-- Nenhuma alteração de código de frontend é necessária nesta etapa.
-- Documentado aqui como assertion de arquitetura, não como asserção pgTAP.
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- FINISH
-- ─────────────────────────────────────────────────────────────

SELECT * FROM finish();

ROLLBACK;
