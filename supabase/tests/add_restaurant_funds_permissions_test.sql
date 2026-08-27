-- =============================================================
-- Testes de segurança: add_restaurant_funds — permissões após REVOKE
-- (SEC-003 hardening — SECURITY_AUDIT.md)
--
-- Estado após a migration:
--   20260826_revoke_add_restaurant_funds_grant.sql
--   → REVOKE EXECUTE ON FUNCTION public.add_restaurant_funds(UUID, NUMERIC)
--     FROM PUBLIC, FROM authenticated, FROM anon
--
-- Permissões efetivas esperadas:
--   anon          → sem EXECUTE privilege (verificado via catálogo)
--   authenticated → sem EXECUTE privilege (verificado via catálogo)
--   service_role  → executa (superusuário PostgreSQL, ignora GRANTs)
--   postgres      → executa (superusuário PostgreSQL, ignora GRANTs)
--
-- Nota sobre os testes de "denied":
--   Usamos has_function_privilege() em vez de throws_ok() para evitar
--   o crash do backend Postgres 15 que ocorre quando um erro de ACL
--   do sistema é lançado dentro de throws_ok com SET LOCAL ROLE.
--   (throws_ok catching de RAISE EXCEPTION de trigger funciona ok;
--    throws_ok catching de permission denied de ACL do sistema crasha.)
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

-- on_auth_user_created auto-cria profiles; ON CONFLICT garante o full_name correto
INSERT INTO public.profiles (id, full_name)
VALUES ('ffffffff-0001-0000-0000-000000000001', 'Restaurante Funds Test')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

INSERT INTO public.user_roles (user_id, role)
VALUES ('ffffffff-0001-0000-0000-000000000001', 'restaurant');

INSERT INTO public.restaurants (id, user_id, business_name, cnpj, wallet_balance, address, latitude, longitude)
VALUES (
  'bbbbbbbb-0001-0000-0000-000000000001',
  'ffffffff-0001-0000-0000-000000000001',
  'Restaurante Funds Test', '11.111.111/0001-11', 0.00,
  'Rua Teste, 1', -19.9, -43.9
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 1 e 2: Verificação de privilégio via catálogo
--
-- Usamos has_function_privilege() em vez de throws_ok() com
-- SET LOCAL ROLE para evitar o crash do backend Postgres 15.
-- (Ver nota no cabeçalho do arquivo.)
-- ─────────────────────────────────────────────────────────────

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.add_restaurant_funds(uuid, numeric)',
    'EXECUTE'
  ),
  'TESTE 1: anon não tem EXECUTE privilege em add_restaurant_funds'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.add_restaurant_funds(uuid, numeric)',
    'EXECUTE'
  ),
  'TESTE 2: authenticated não tem EXECUTE privilege em add_restaurant_funds'
);

-- Integridade: verificações de catálogo não modificam dados
SELECT is(
  (SELECT wallet_balance FROM public.restaurants WHERE id = 'bbbbbbbb-0001-0000-0000-000000000001'),
  0.00::numeric,
  'TESTE 3: wallet_balance permanece 0.00 após verificações de privilégio'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 4 e 5: service_role (superusuário) → executa com sucesso
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

SELECT is(
  (
    SELECT (public.add_restaurant_funds(
      'bbbbbbbb-0001-0000-0000-000000000001'::uuid,
      250.00
    ) ->> 'success')::boolean
  ),
  true,
  'TESTE 4: service_role (postgres, sem sub no JWT) adiciona fundos → PERMITIDO'
);

SELECT is(
  (SELECT wallet_balance FROM public.restaurants WHERE id = 'bbbbbbbb-0001-0000-0000-000000000001'),
  250.00::numeric,
  'TESTE 5: wallet_balance = 250.00 após execução via service_role'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 6: Nenhuma função SQL existente chama add_restaurant_funds
--          (proteção contra bypass via SECURITY DEFINER)
-- ─────────────────────────────────────────────────────────────

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'auth')
      AND p.proname  != 'add_restaurant_funds'
      AND p.prosrc    ILIKE '%add_restaurant_funds%'
  ),
  'TESTE 6: Nenhuma função SQL (public/auth) chama add_restaurant_funds — bypass impossível'
);

-- ─────────────────────────────────────────────────────────────
-- FINISH
-- ─────────────────────────────────────────────────────────────

SELECT * FROM finish();

ROLLBACK;
