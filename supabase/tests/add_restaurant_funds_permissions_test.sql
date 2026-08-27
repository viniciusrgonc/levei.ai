-- =============================================================
-- Testes de segurança: add_restaurant_funds — permissões após REVOKE
-- (SEC-003 hardening — SECURITY_AUDIT.md)
--
-- Estado após a migration:
--   20260826_revoke_add_restaurant_funds_grant.sql
--   → REVOKE EXECUTE ON FUNCTION public.add_restaurant_funds(UUID, NUMERIC) FROM PUBLIC
--
-- Permissões efetivas esperadas:
--   anon          → permission denied (42501) — nunca teve GRANT explícito; PUBLIC revogado
--   authenticated → permission denied (42501) — PUBLIC revogado
--   service_role  → executa (superusuário PostgreSQL, ignora GRANTs)
--   postgres      → executa (superusuário PostgreSQL, ignora GRANTs)
--
-- Nota sobre a lógica da função:
--   A função NÃO foi alterada. Apenas a permissão de execução foi revogada.
--   O saldo é FICTÍCIO. Nenhum dinheiro real é movimentado.
--
-- Como executar:
--   supabase start
--   supabase test db
-- =============================================================

BEGIN;

SELECT plan(6);

-- ─────────────────────────────────────────────────────────────
-- SETUP: dados de teste isolados (revertidos no ROLLBACK final)
-- ─────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, aud, role
) VALUES
  (
    'ffffffff-0001-0000-0000-000000000001',
    'rest_funds_test@test.levei',
    crypt('senha123', gen_salt('bf')),
    now(), '{}', '{}', now(), now(), 'authenticated', 'authenticated'
  );

INSERT INTO public.profiles (id, full_name)
VALUES ('ffffffff-0001-0000-0000-000000000001', 'Restaurante Funds Test');

INSERT INTO public.user_roles (user_id, role)
VALUES ('ffffffff-0001-0000-0000-000000000001', 'restaurant');

INSERT INTO public.restaurants (id, user_id, name, cnpj, wallet_balance)
VALUES (
  'bbbbbbbb-0001-0000-0000-000000000001',
  'ffffffff-0001-0000-0000-000000000001',
  'Restaurante Funds Test', '11.111.111/0001-11', 0.00
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 1: anon → permission denied
-- ─────────────────────────────────────────────────────────────

SET LOCAL ROLE anon;

SELECT throws_ok(
  $$
    SELECT public.add_restaurant_funds(
      'bbbbbbbb-0001-0000-0000-000000000001'::uuid,
      100.00
    )
  $$,
  '42501',
  NULL,
  'TESTE 1: anon tenta adicionar fundos → permission denied (42501)'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 2: authenticated (dono do restaurante) → permission denied
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub',  'ffffffff-0001-0000-0000-000000000001',
      'role', 'authenticated'
    )::text,
    true
  );
END;
$$;

SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$
    SELECT public.add_restaurant_funds(
      'bbbbbbbb-0001-0000-0000-000000000001'::uuid,
      100.00
    )
  $$,
  '42501',
  NULL,
  'TESTE 2: authenticated (dono) tenta adicionar fundos → permission denied (42501)'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 3: authenticated (outro usuário, restaurant_id de terceiro) → permission denied
-- Valida que o REVOKE protege mesmo quando o alvo é restaurante alheio.
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub',  'aaaaaaaa-dead-beef-0000-000000000000',  -- usuário inexistente
      'role', 'authenticated'
    )::text,
    true
  );
END;
$$;

SELECT throws_ok(
  $$
    SELECT public.add_restaurant_funds(
      'bbbbbbbb-0001-0000-0000-000000000001'::uuid,
      999999.00
    )
  $$,
  '42501',
  NULL,
  'TESTE 3: authenticated (terceiro) tenta adicionar fundos em restaurante alheio → permission denied (42501)'
);

-- Confirma que o saldo não foi alterado por nenhuma das tentativas bloqueadas
SET LOCAL ROLE postgres;

SELECT is(
  (SELECT wallet_balance FROM public.restaurants WHERE id = 'bbbbbbbb-0001-0000-0000-000000000001'),
  0.00::numeric,
  'TESTE 4: wallet_balance permanece 0.00 após todas as tentativas bloqueadas'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 5: service_role (superusuário) → executa com sucesso
-- Simula contexto administrativo via SQL Editor ou futura Edge Function.
-- JWT sem claim "sub" (padrão de service_role no Supabase).
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

-- postgres role = superusuário = equivalente a service_role para efeito de GRANTs
SELECT is(
  (
    SELECT (public.add_restaurant_funds(
      'bbbbbbbb-0001-0000-0000-000000000001'::uuid,
      250.00
    ) ->> 'success')::boolean
  ),
  true,
  'TESTE 5: service_role (postgres, sem sub no JWT) adiciona fundos → PERMITIDO'
);

SELECT is(
  (SELECT wallet_balance FROM public.restaurants WHERE id = 'bbbbbbbb-0001-0000-0000-000000000001'),
  250.00::numeric,
  'TESTE 6: wallet_balance = 250.00 após execução via service_role'
);

-- ─────────────────────────────────────────────────────────────
-- FINISH
-- ─────────────────────────────────────────────────────────────

SELECT * FROM finish();

ROLLBACK;
