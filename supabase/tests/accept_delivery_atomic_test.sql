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
--   anon          → permission denied (42501) — nunca teve GRANT
--   authenticated → permission denied (42501) — GRANT revogado
--   service_role  → executa (superusuário PostgreSQL, ignora GRANTs)
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
  id, user_id, full_name, cpf, birth_date, phone,
  vehicle_type, license_plate, vehicle_model, vehicle_color,
  cnh_number, cnh_expiry, is_approved, is_available, driver_status
) VALUES
(
  'dddddddd-0000-0000-0000-000000000001',
  '11111111-0000-0000-0000-000000000001',
  'Driver A Teste', '000.000.000-01', '1990-01-01', '11000000001',
  'motorcycle', 'AAA-0001', 'Modelo A', 'Preto',
  '00000000001', now() + interval '2 years',
  true, true, 'approved'
),
(
  'dddddddd-0000-0000-0000-000000000002',
  '22222222-0000-0000-0000-000000000002',
  'Driver B Teste', '000.000.000-02', '1990-01-01', '11000000002',
  'motorcycle', 'BBB-0002', 'Modelo B', 'Branco',
  '00000000002', now() + interval '2 years',
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
-- TESTE 1: Usuário autenticado chamando diretamente → permission denied
--
-- Após o REVOKE EXECUTE FROM authenticated, qualquer usuário com
-- role 'authenticated' recebe 42501 antes de entrar na função.
-- Isso cobre TODOS os casos: Driver A usando driver_id próprio,
-- Driver A usando driver_id de B, restaurante, admin — qualquer
-- authenticated é bloqueado pelo GRANT antes mesmo do ownership check.
-- ─────────────────────────────────────────────────────────────

-- 1a: Driver A tenta chamar com SEU PRÓPRIO driver_id → permission denied
DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub',  '11111111-0000-0000-0000-000000000001',
      'role', 'authenticated'
    )::text,
    true
  );
END;
$$;

SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$
    SELECT public.accept_delivery_atomic(
      'eeeeeeee-0000-0000-0000-000000000001',
      'dddddddd-0000-0000-0000-000000000001'
    )
  $$,
  '42501',
  NULL,
  'TESTE 1a: Driver A (authenticated) chama com próprio driver_id → permission denied'
);

-- 1b: Driver A tenta com driver_id de B → também permission denied (GRANT bloqueia antes)
SELECT throws_ok(
  $$
    SELECT public.accept_delivery_atomic(
      'eeeeeeee-0000-0000-0000-000000000001',
      'dddddddd-0000-0000-0000-000000000002'
    )
  $$,
  '42501',
  NULL,
  'TESTE 1b: Driver A (authenticated) tenta usar driver_id de B → permission denied'
);

-- 1c: Restaurante (authenticated, sem driver) tenta chamar → permission denied
DO $$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object(
      'sub',  '33333333-0000-0000-0000-000000000003',
      'role', 'authenticated'
    )::text,
    true
  );
END;
$$;

SELECT throws_ok(
  $$
    SELECT public.accept_delivery_atomic(
      'eeeeeeee-0000-0000-0000-000000000001',
      'dddddddd-0000-0000-0000-000000000001'
    )
  $$,
  '42501',
  NULL,
  'TESTE 1c: Restaurante (authenticated) tenta chamar → permission denied'
);

-- 1d: anon (sem sessão) também é bloqueado
SET LOCAL ROLE anon;

SELECT throws_ok(
  $$
    SELECT public.accept_delivery_atomic(
      'eeeeeeee-0000-0000-0000-000000000001',
      'dddddddd-0000-0000-0000-000000000001'
    )
  $$,
  '42501',
  NULL,
  'TESTE 1d: anon (não autenticado) → permission denied'
);

-- Confirma que a entrega não foi tocada por nenhuma das tentativas bloqueadas
SET LOCAL ROLE postgres;

SELECT is(
  (SELECT status FROM public.deliveries WHERE id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'pending',
  'TESTE 1e: status permanece pending após todas as tentativas bloqueadas'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 2: service_role (Edge Function) → continua funcionando
--
-- Simula o contexto da Edge Function:
--   - Role: postgres (superusuário — equivale ao service_role para GRANTs)
--   - JWT claims: sem claim "sub" (como no JWT de service_role do Supabase)
--   - auth.uid() retorna NULL → ownership check ignorado (trusted caller)
--   - Lógica atômica executa normalmente
-- ─────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

-- Simula JWT de service_role: sem claim "sub"
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
  'TESTE 2a: service_role (sem sub no JWT) aceita entrega com driver_id de Driver A → PERMITIDO'
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
-- TESTE 3: Dois motoristas tentam aceitar a mesma entrega
--          via service_role (concorrência) → apenas um consegue
-- ─────────────────────────────────────────────────────────────

-- Reverte para pending para o teste de concorrência
UPDATE public.deliveries
SET status = 'pending', driver_id = NULL, accepted_at = NULL
WHERE id = 'eeeeeeee-0000-0000-0000-000000000001';

-- Primeira tentativa: Driver A (via service_role)
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
  'TESTE 3b: Driver B (service_role) tenta aceitar entrega já aceita → BLOQUEADO'
);

SELECT is(
  (SELECT driver_id FROM public.deliveries WHERE id = 'eeeeeeee-0000-0000-0000-000000000001'),
  'dddddddd-0000-0000-0000-000000000001'::uuid,
  'TESTE 3c: driver_id é o do Driver A (vencedor) — Driver B não sobrescreveu'
);

-- ─────────────────────────────────────────────────────────────
-- TESTE 4: Verificação via catálogo — nenhuma função SQL existente
--          pode ser usada como bypass para accept_delivery_atomic
--
-- Consulta pg_proc para confirmar que nenhuma outra função no schema
-- public ou auth referencia 'accept_delivery_atomic' em seu corpo.
-- Se alguma SECURITY DEFINER chamasse accept_delivery_atomic, um
-- usuário autenticado poderia usá-la como bridge.
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
  'TESTE 4: Nenhuma função SQL existente (public/auth) chama accept_delivery_atomic — bypass via SECURITY DEFINER impossível'
);

-- ─────────────────────────────────────────────────────────────
-- FINISH
-- ─────────────────────────────────────────────────────────────

SELECT * FROM finish();

ROLLBACK;
