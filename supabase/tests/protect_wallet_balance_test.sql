-- =============================================================
-- Testes de segurança: protect_restaurant_financial_columns
-- (SEC-004 hardening — SECURITY_AUDIT.md)
--
-- Migration testada:
--   20260826_protect_restaurant_financial_columns.sql
--   → Trigger BEFORE UPDATE que bloqueia alterações de wallet_balance
--     e blocked_balance quando auth.uid() IS NOT NULL.
--
-- Permissões efetivas esperadas após a migration:
--   authenticated → BLOQUEADO (42501) ao tentar alterar colunas financeiras
--   postgres      → PERMITIDO (superusuário / funções internas)
--
-- Campos protegidos:  wallet_balance, blocked_balance
-- Campos não afetados: phone, address, name, cnpj e outros não-financeiros
--
-- Como executar:
--   supabase start
--   supabase test db
-- =============================================================

BEGIN;

SELECT plan(11);

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

INSERT INTO public.profiles (id, full_name, email) VALUES
  ('cccccccc-0001-0000-0000-000000000001', 'Restaurante Sec A', 'rest_wallet_sec@test.levei'),
  ('cccccccc-0002-0000-0000-000000000002', 'Restaurante Sec B', 'rest_wallet_sec2@test.levei');

INSERT INTO public.user_roles (user_id, role) VALUES
  ('cccccccc-0001-0000-0000-000000000001', 'restaurant'),
  ('cccccccc-0002-0000-0000-000000000002', 'restaurant');

INSERT INTO public.restaurants (id, user_id, name, cnpj, wallet_balance, blocked_balance)
VALUES
  (
    'eeeee001-0000-0000-0000-000000000001',
    'cccccccc-0001-0000-0000-000000000001',
    'Restaurante Sec A', '22.222.222/0001-22',
    500.00, 0.00
  ),
  (
    'eeeee002-0000-0000-0000-000000000002',
    'cccccccc-0002-0000-0000-000000000002',
    'Restaurante Sec B', '33.333.333/0001-33',
    200.00, 0.00
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
-- TESTE 1: Restaurante tenta AUMENTAR próprio wallet_balance → BLOQUEADO
-- ─────────────────────────────────────────────────────────────

SELECT throws_ok(
  $$
    UPDATE public.restaurants
    SET wallet_balance = wallet_balance + 100
    WHERE id = 'eeeee001-0000-0000-0000-000000000001'
  $$,
  '42501',
  NULL,
  'TESTE 1: authenticated tenta aumentar wallet_balance → 42501'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 2: Restaurante tenta REDUZIR próprio wallet_balance → BLOQUEADO
-- ─────────────────────────────────────────────────────────────

SELECT throws_ok(
  $$
    UPDATE public.restaurants
    SET wallet_balance = wallet_balance - 100
    WHERE id = 'eeeee001-0000-0000-0000-000000000001'
  $$,
  '42501',
  NULL,
  'TESTE 2: authenticated tenta reduzir wallet_balance → 42501'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 3: Restaurante tenta definir wallet_balance = 999999 → BLOQUEADO
-- ─────────────────────────────────────────────────────────────

SELECT throws_ok(
  $$
    UPDATE public.restaurants
    SET wallet_balance = 999999
    WHERE id = 'eeeee001-0000-0000-0000-000000000001'
  $$,
  '42501',
  NULL,
  'TESTE 3: authenticated tenta SET wallet_balance = 999999 → 42501'
);

-- ─────────────────────────────────────────────────────────────
-- Confirma que todas as tentativas acima foram bloqueadas
-- wallet_balance deve continuar 500.00
-- ─────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

SELECT is(
  (SELECT wallet_balance FROM public.restaurants
   WHERE id = 'eeeee001-0000-0000-0000-000000000001'),
  500.00::numeric,
  'TESTE 3b: wallet_balance permanece 500.00 após todas as tentativas bloqueadas'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 4: Restaurante atualiza campo NÃO financeiro (phone) → CONTINUA FUNCIONANDO
-- ─────────────────────────────────────────────────────────────

-- Restaura sessão autenticada como Restaurante A
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
  'TESTE 4a: authenticated atualiza phone (campo não financeiro) → sem erro'
);

SET LOCAL ROLE postgres;

SELECT is(
  (SELECT phone FROM public.restaurants
   WHERE id = 'eeeee001-0000-0000-0000-000000000001'),
  '11999990001',
  'TESTE 4b: phone foi atualizado corretamente'
);

SELECT is(
  (SELECT wallet_balance FROM public.restaurants
   WHERE id = 'eeeee001-0000-0000-0000-000000000001'),
  500.00::numeric,
  'TESTE 4c: wallet_balance permanece inalterado após update de phone'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 5: Função interna autorizada (service_role / postgres) altera
-- wallet_balance → CONTINUA FUNCIONANDO
--
-- Simula o contexto de uma Edge Function (service_role JWT sem 'sub')
-- ou do SQL Editor (postgres direto). Em ambos, auth.uid() = NULL.
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,   -- sem claim 'sub'
    true
  );
END;
$$;

-- postgres é superusuário — representa service_role para efeito de GRANTs e triggers
SELECT lives_ok(
  $$
    UPDATE public.restaurants
    SET wallet_balance = wallet_balance + 100
    WHERE id = 'eeeee001-0000-0000-0000-000000000001'
  $$,
  'TESTE 5a: service_role (postgres, sem sub) pode alterar wallet_balance → permitido'
);

SELECT is(
  (SELECT wallet_balance FROM public.restaurants
   WHERE id = 'eeeee001-0000-0000-0000-000000000001'),
  600.00::numeric,
  'TESTE 5b: wallet_balance = 600.00 após operação interna autorizada'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 6: Outro restaurante (user2) não consegue alterar wallet_balance
-- de user1 — protegido pela RLS USING (auth.uid() = user_id)
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub',  'cccccccc-0002-0000-0000-000000000002',   -- user do Restaurante B
      'role', 'authenticated'
    )::text,
    true
  );
END;
$$;

SET LOCAL ROLE authenticated;

-- RLS USING (auth.uid() = user_id) não encontra a linha de user1.
-- 0 rows affected. Nenhuma exceção levantada (RLS filtra antes do trigger).
SELECT lives_ok(
  $$
    UPDATE public.restaurants
    SET wallet_balance = 999999
    WHERE id = 'eeeee001-0000-0000-0000-000000000001'
  $$,
  'TESTE 6a: authenticated (user2) tenta alterar wallet_balance de user1 → 0 rows, sem exceção'
);

SET LOCAL ROLE postgres;

SELECT is(
  (SELECT wallet_balance FROM public.restaurants
   WHERE id = 'eeeee001-0000-0000-0000-000000000001'),
  600.00::numeric,
  'TESTE 6b: wallet_balance de user1 permanece 600.00 — intocado por user2'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 7: Valor negativo continua bloqueado
-- Quando chamado como postgres (auth.uid() = NULL), o trigger permite,
-- mas o CHECK constraint positive_wallet_balance (>= 0) rejeita.
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('role', 'service_role')::text,
    true
  );
END;
$$;

SELECT throws_ok(
  $$
    UPDATE public.restaurants
    SET wallet_balance = -100
    WHERE id = 'eeeee001-0000-0000-0000-000000000001'
  $$,
  '23514',   -- check_violation: positive_wallet_balance CHECK (wallet_balance >= 0)
  NULL,
  'TESTE 7: valor negativo bloqueado pelo CHECK constraint (23514) mesmo via service_role'
);

-- ─────────────────────────────────────────────────────────────
-- FINISH
-- ─────────────────────────────────────────────────────────────

SELECT * FROM finish();

ROLLBACK;
