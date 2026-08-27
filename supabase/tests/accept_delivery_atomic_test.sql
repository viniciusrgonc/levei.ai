-- =============================================================
-- Testes de segurança: accept_delivery_atomic — modelo endurecido
-- (SEC-001 hardening — SECURITY_AUDIT.md)
--
-- Estado após as duas migrations:
--   1. 20260826_fix_accept_delivery_atomic_ownership.sql
--      → ownership check + SET search_path dentro da função
--   2. 20260826_revoke_accept_delivery_atomic_grant.sql
--      → REVOKE EXECUTE FROM authenticated
--
-- Permissões efetivas esperadas:
--   anon          → sem EXECUTE privilege (verificado via catálogo)
--   authenticated → sem EXECUTE privilege (verificado via catálogo)
--   service_role  → executa (superusuário PostgreSQL, ignora GRANTs)
--
-- Nota sobre os testes de "denied":
--   Usamos has_function_privilege() em vez de throws_ok() para evitar
--   o crash do backend Postgres que ocorre com SET LOCAL ROLE authenticated
--   + throws_ok (subtransação interna) + SECURITY DEFINER + FOR UPDATE
--   na mesma linha bloqueada pela transação externa.
--
-- Como executar:
--   supabase start
--   supabase test db
-- =============================================================

BEGIN;

SELECT plan(10);

-- ─────────────────────────────────────────────────────────────
-- SETUP: dados de teste isolados (revertidos no ROLLBACK final)
-- ─────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, aud, role
) VALUES
  (
    '11111111-0000-0000-0000-000000000001',
    'driver_a@test.levei',
    crypt('senha123', gen_salt('bf')),
    now(), '{}', '{}', now(), now(), 'authenticated', 'authenticated'
  ),
  (
    '22222222-0000-0000-0000-000000000002',
    'driver_b@test.levei',
    crypt('senha123', gen_salt('bf')),
    now(), '{}', '{}', now(), now(), 'authenticated', 'authenticated'
  ),
  (
    '33333333-0000-0000-0000-000000000003',
    'restaurant@test.levei',
    crypt('senha123', gen_salt('bf')),
    now(), '{}', '{}', now(), now(), 'authenticated', 'authenticated'
  );

-- on_auth_user_created auto-cria profiles; ON CONFLICT garante o full_name correto
INSERT INTO public.profiles (id, full_name)
VALUES
  ('11111111-0000-0000-0000-000000000001', 'Driver A Teste'),
  ('22222222-0000-0000-0000-000000000002', 'Driver B Teste'),
  ('33333333-0000-0000-0000-000000000003', 'Restaurante Teste')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('11111111-0000-0000-0000-000000000001', 'driver'),
  ('22222222-0000-0000-0000-000000000002', 'driver'),
  ('33333333-0000-0000-0000-000000000003', 'restaurant');

INSERT INTO public.restaurants (id, user_id, business_name, cnpj, wallet_balance, address, latitude, longitude)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001',
  '33333333-0000-0000-0000-000000000003',
  'Restaurante Teste', '00.000.000/0001-00', 500.00,
  'Rua Teste, 1', -19.9, -43.9
);

INSERT INTO public.drivers (
  id, user_id, cpf, birth_date, phone,
  vehicle_type, license_plate, vehicle_model, vehicle_color,
  is_approved, is_available, driver_status
) VALUES
(
  'dddddddd-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000001',
  '000.000.000-01', '1990-01-01', '11000000001',
  'motorcycle', 'AAA-0001', 'Modelo A', 'Preto',
  true, true, 'approved'
),
(
  'dddddddd-0000-0000-0000-000000000002',
  '22222222-0000-0000-0000-000000000002',
  '000.000.000-02', '1990-01-01', '11000000002',
  'motorcycle', 'BBB-0002', 'Modelo B', 'Branco',
  true, true, 'approved'
);

INSERT INTO public.deliveries (
  id, restaurant_id, status,
  pickup_address, pickup_latitude, pickup_longitude,
  delivery_address, delivery_latitude, delivery_longitude,
  distance_km, price, price_adjusted
) VALUES (
  'eeeeeeee-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'pending',
  'Rua de Coleta, 1', -19.9, -43.9,
  'Rua de Entrega, 1', -19.91, -43.91,
  3.0, 50.00, 50.00
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 1: Verificação de privilégio via catálogo do PostgreSQL
--
-- Usamos has_function_privilege() em vez de throws_ok() para verificar
-- que as roles não têm EXECUTE privilege, sem chamar a função diretamente.
-- Isso evita a interação problemática entre throws_ok (subtransação interna),
-- SET LOCAL ROLE authenticated, SECURITY DEFINER e FOR UPDATE na linha
-- já bloqueada pela transação externa (INSERT do setup).
-- ─────────────────────────────────────────────────────────────

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.accept_delivery_atomic(uuid, uuid)',
    'EXECUTE'
  ),
  'TESTE 1a: authenticated não tem EXECUTE privilege em accept_delivery_atomic'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.accept_delivery_atomic(uuid, uuid)',
    'EXECUTE'
  ),
  'TESTE 1b: anon não tem EXECUTE privilege em accept_delivery_atomic'
);

-- Integridade: verificações de catálogo não modificam dados
SELECT is(
  (SELECT status FROM public.deliveries WHERE id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'pending',
  'TESTE 1c: status permanece pending após verificações de privilégio'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 2: service_role (postgres, JWT sem 'sub') → executa com sucesso
--
-- Simula o contexto da Edge Function:
--   - Role: postgres (superusuário — equivale ao service_role para GRANTs)
--   - JWT sem claim "sub" → auth.uid() = NULL → ownership check ignorado
-- ─────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

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
    SELECT (public.accept_delivery_atomic(
      'eeeeeeee-0000-0000-0000-000000000001',
      'dddddddd-0000-0000-0000-000000000001'
    ) ->> 'success')::boolean
  ),
  true,
  'TESTE 2a: service_role (postgres, sem sub no JWT) aceita entrega → PERMITIDO'
);

SELECT is(
  (SELECT status FROM public.deliveries WHERE id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'accepted',
  'TESTE 2b: entrega gravada como accepted após chamada via service_role'
);

SELECT is(
  (SELECT driver_id FROM public.deliveries WHERE id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'dddddddd-0000-0000-0000-000000000001'::uuid,
  'TESTE 2c: driver_id correto gravado na entrega'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 3: Dois drivers tentam aceitar a mesma entrega (concorrência)
--          → apenas o primeiro consegue
-- ─────────────────────────────────────────────────────────────

-- Reverte para pending para testar concorrência
UPDATE public.deliveries
SET status = 'pending', driver_id = NULL, accepted_at = NULL
WHERE id = 'eeeeeeee-0000-0000-0000-000000000001';

-- Primeira tentativa: Driver A
SELECT is(
  (
    SELECT (public.accept_delivery_atomic(
      'eeeeeeee-0000-0000-0000-000000000001',
      'dddddddd-0000-0000-0000-000000000001'
    ) ->> 'success')::boolean
  ),
  true,
  'TESTE 3a: Driver A (service_role) aceita entrega → PERMITIDO (primeiro a aceitar)'
);

-- Segunda tentativa: Driver B tenta aceitar a mesma entrega (já aceita)
SELECT is(
  (
    SELECT (public.accept_delivery_atomic(
      'eeeeeeee-0000-0000-0000-000000000001',
      'dddddddd-0000-0000-0000-000000000002'
    ) ->> 'success')::boolean
  ),
  false,
  'TESTE 3b: Driver B tenta aceitar entrega já aceita → BLOQUEADO'
);

SELECT is(
  (SELECT driver_id FROM public.deliveries WHERE id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'dddddddd-0000-0000-0000-000000000001'::uuid,
  'TESTE 3c: driver_id é o do Driver A (vencedor) — Driver B não sobrescreveu'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 4: Verificação via catálogo — nenhuma função SQL existente
--          pode ser usada como bypass para accept_delivery_atomic
-- ─────────────────────────────────────────────────────────────

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'auth')
      AND p.proname     != 'accept_delivery_atomic'
      AND p.prosrc       ILIKE '%accept_delivery_atomic%'
  ),
  'TESTE 4: Nenhuma função SQL (public/auth) chama accept_delivery_atomic — bypass impossível'
);

-- ─────────────────────────────────────────────────────────────
-- FINISH
-- ─────────────────────────────────────────────────────────────

SELECT * FROM finish();

ROLLBACK;
