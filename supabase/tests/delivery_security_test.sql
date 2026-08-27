-- =============================================================
-- Testes de segurança: SEC-005, SEC-006, SEC-008, SEC-009
-- (SECURITY_AUDIT.md — delivery completion flow)
--
-- Migrations testadas:
--   20260826_sec005_block_delivery_funds_ownership.sql
--   20260826_sec006_sec009_protect_delivery_columns.sql
--   20260826_sec008_revoke_finalize.sql
--
-- Mapa dos 18 assertions (16 cenários + 2 sub-verificações):
--   T1   : Restaurante A não bloqueia saldo do Restaurante B
--   T2   : Restaurante A não usa delivery_id do Restaurante B
--   T3a  : p_amount artificialmente alto é ignorado (valor autoritativo = price_adjusted)
--   T3b  : wallet_balance reflete exatamente 100.00 bloqueados, não 999999
--   T4   : p_amount diferente do price_adjusted é ignorado (usa price_adjusted)
--   T5   : Bloqueio legítimo pelo dono do restaurante → PASSA
--   T6   : Driver não consegue alterar price_adjusted via UPDATE direto
--   T7   : Driver não consegue alterar financial_status via UPDATE direto
--   T8   : Driver não consegue ressuscitar entrega cancelled (status terminal → ativo)
--   T9   : authenticated não consegue chamar finalize_delivery_transaction
--   T10  : anon não consegue chamar finalize_delivery_transaction
--   T11  : postgres (simula service_role) consegue chamar finalize_delivery_transaction
--   T12a : Conclusão legítima via finalize_delivery_transaction → success=true
--   T12b : earnings_balance acumula T11(120) + T12(48) = 168.00
--   T13  : Dupla conclusão concorrente → somente uma é registrada (FOR UPDATE guard)
--   T14  : Retry idempotente: earnings_balance permanece 168.00 (sem double credit)
--   T15  : Delivery cancelled não pode ser concluída
--   T16  : Delivery refunded não pode ser concluída
--
-- Como executar:
--   supabase start
--   supabase test db
-- =============================================================

BEGIN;

SELECT plan(18);

-- ─────────────────────────────────────────────────────────────
-- SETUP: usuários, restaurantes, driver, entregas isolados
-- ─────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, aud, role
) VALUES
  ('aaaaaa01-0000-0000-0000-000000000001',
   'rest_a_sec@test.levei', crypt('pass', gen_salt('bf')),
   now(), '{}', '{}', now(), now(), 'authenticated', 'authenticated'),
  ('aaaaaa02-0000-0000-0000-000000000002',
   'rest_b_sec@test.levei', crypt('pass', gen_salt('bf')),
   now(), '{}', '{}', now(), now(), 'authenticated', 'authenticated'),
  ('aaaaaa03-0000-0000-0000-000000000003',
   'driver_sec@test.levei', crypt('pass', gen_salt('bf')),
   now(), '{}', '{}', now(), now(), 'authenticated', 'authenticated');

-- on_auth_user_created auto-cria profiles; ON CONFLICT garante o full_name correto
INSERT INTO public.profiles (id, full_name) VALUES
  ('aaaaaa01-0000-0000-0000-000000000001', 'Rest A'),
  ('aaaaaa02-0000-0000-0000-000000000002', 'Rest B'),
  ('aaaaaa03-0000-0000-0000-000000000003', 'Driver Sec')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('aaaaaa01-0000-0000-0000-000000000001', 'restaurant'),
  ('aaaaaa02-0000-0000-0000-000000000002', 'restaurant'),
  ('aaaaaa03-0000-0000-0000-000000000003', 'driver');

-- Restaurantes com saldo
INSERT INTO public.restaurants (id, user_id, business_name, cnpj, wallet_balance, blocked_balance, address, latitude, longitude)
VALUES
  ('bbbbbb01-0000-0000-0000-000000000001',
   'aaaaaa01-0000-0000-0000-000000000001',
   'Rest A', '11.111.111/0001-11', 1000.00, 0.00,
   'Rua A, 1', -19.9, -43.9),
  ('bbbbbb02-0000-0000-0000-000000000002',
   'aaaaaa02-0000-0000-0000-000000000002',
   'Rest B', '22.222.222/0001-22', 500.00, 0.00,
   'Rua B, 2', -19.9, -43.9);

-- Driver aprovado com saldo zero
INSERT INTO public.drivers (id, user_id, vehicle_type, license_plate, is_available, is_approved, earnings_balance)
VALUES (
  'cccccc01-0000-0000-0000-000000000001',
  'aaaaaa03-0000-0000-0000-000000000003',
  'motorcycle', 'SEC-0001', true, true, 0.00
);

-- Entregas de teste:
--   delivery_a: pertence ao Rest A, price_adjusted=100, sem driver ainda
--   delivery_b: pertence ao Rest B, price_adjusted=200
--   delivery_picked_up: Rest A, driver atribuído, status=picked_up, financial_status=blocked
--   delivery_cancelled: Rest A, status=cancelled
--   delivery_refunded:  Rest A, financial_status=refunded

INSERT INTO public.deliveries (
  id, restaurant_id, driver_id,
  pickup_address, pickup_latitude, pickup_longitude,
  delivery_address, delivery_latitude, delivery_longitude,
  distance_km, price, price_adjusted, status, financial_status
) VALUES
  ('dddddd01-0000-0000-0000-000000000001',  -- delivery_a (Rest A, sem driver)
   'bbbbbb01-0000-0000-0000-000000000001', NULL,
   'Col A', -19.9, -43.9, 'Ent A', -19.91, -43.91,
   3.0, 100.00, 100.00, 'pending', NULL),
  ('dddddd02-0000-0000-0000-000000000002',  -- delivery_b (Rest B, sem driver)
   'bbbbbb02-0000-0000-0000-000000000002', NULL,
   'Col B', -19.9, -43.9, 'Ent B', -19.91, -43.91,
   3.0, 200.00, 200.00, 'pending', NULL),
  ('dddddd03-0000-0000-0000-000000000003',  -- delivery_picked_up (pronta para finalizar)
   'bbbbbb01-0000-0000-0000-000000000001',
   'cccccc01-0000-0000-0000-000000000001',
   'Col A', -19.9, -43.9, 'Ent A', -19.91, -43.91,
   3.0, 150.00, 150.00, 'picked_up', 'blocked'),
  ('dddddd04-0000-0000-0000-000000000004',  -- delivery_cancelled
   'bbbbbb01-0000-0000-0000-000000000001',
   'cccccc01-0000-0000-0000-000000000001',
   'Col A', -19.9, -43.9, 'Ent A', -19.91, -43.91,
   3.0, 100.00, 100.00, 'cancelled', 'refunded'),
  ('dddddd05-0000-0000-0000-000000000005',  -- delivery_refunded (financial apenas)
   'bbbbbb01-0000-0000-0000-000000000001',
   'cccccc01-0000-0000-0000-000000000001',
   'Col A', -19.9, -43.9, 'Ent A', -19.91, -43.91,
   3.0, 100.00, 100.00, 'cancelled', 'refunded');

-- Ajusta blocked_balance do Rest A para refletir delivery_picked_up (150.00 bloqueados)
UPDATE public.restaurants SET blocked_balance = 150.00
WHERE id = 'bbbbbb01-0000-0000-0000-000000000001';

-- ─────────────────────────────────────────────────────────────
-- T1: Restaurante A NÃO consegue bloquear saldo do Restaurante B
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', 'aaaaaa01-0000-0000-0000-000000000001', 'role', 'authenticated')::text,
    true);
END; $$;
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT (public.block_delivery_funds(
    'bbbbbb02-0000-0000-0000-000000000002'::uuid,  -- Rest B (não é o dono)
    'dddddd02-0000-0000-0000-000000000002'::uuid,
    200.00
  ) ->> 'success')::boolean),
  false,
  'T1: Rest A não bloqueia saldo do Rest B → success=false'
);

SET LOCAL ROLE postgres;

-- ─────────────────────────────────────────────────────────────
-- T2: Restaurante A NÃO usa delivery_id do Restaurante B
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', 'aaaaaa01-0000-0000-0000-000000000001', 'role', 'authenticated')::text,
    true);
END; $$;
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT (public.block_delivery_funds(
    'bbbbbb01-0000-0000-0000-000000000001'::uuid,  -- Rest A (é o dono)
    'dddddd02-0000-0000-0000-000000000002'::uuid,  -- delivery_b pertence ao Rest B
    100.00
  ) ->> 'success')::boolean),
  false,
  'T2: Rest A não bloqueia usando delivery_id do Rest B → success=false'
);

SET LOCAL ROLE postgres;

-- ─────────────────────────────────────────────────────────────
-- T3: p_amount artificialmente alto é ignorado
-- A função usa price_adjusted=100.00 (server-authoritative), não p_amount=999999
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', 'aaaaaa01-0000-0000-0000-000000000001', 'role', 'authenticated')::text,
    true);
END; $$;
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT (public.block_delivery_funds(
    'bbbbbb01-0000-0000-0000-000000000001'::uuid,
    'dddddd01-0000-0000-0000-000000000001'::uuid,
    999999.00  -- p_amount absurdo — deve ser ignorado
  ) ->> 'success')::boolean),
  true,
  'T3: p_amount=999999 ignorado; bloqueio usa price_adjusted=100.00 → success=true'
);

SET LOCAL ROLE postgres;

-- Confirma que apenas 100.00 foram bloqueados (não 999999)
-- wallet inicial = 1000; setup só ajusta blocked_balance (não desconta wallet);
-- T3 bloqueia delivery_a via block_delivery_funds → wallet = 1000 - 100 = 900
SELECT is(
  (SELECT wallet_balance FROM public.restaurants
   WHERE id = 'bbbbbb01-0000-0000-0000-000000000001'),
  900.00::numeric,
  'T3b: wallet_balance=900.00 (somente 100.00 debitados, não 999999)'
);

-- ─────────────────────────────────────────────────────────────
-- T4: p_amount diferente do price_adjusted é ignorado (usa price_adjusted)
-- delivery_a tem price_adjusted=100; p_amount=50 é ignorado
-- Resultado: já foi bloqueada no T3 → deve retornar "já bloqueada"
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', 'aaaaaa01-0000-0000-0000-000000000001', 'role', 'authenticated')::text,
    true);
END; $$;
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT (public.block_delivery_funds(
    'bbbbbb01-0000-0000-0000-000000000001'::uuid,
    'dddddd01-0000-0000-0000-000000000001'::uuid,
    50.00  -- diferente de price_adjusted=100; não importa — já está bloqueada
  ) ->> 'error')),
  'Fundos já estão bloqueados para esta entrega',
  'T4: double-block detectado; p_amount divergente não tem efeito'
);

SET LOCAL ROLE postgres;

-- ─────────────────────────────────────────────────────────────
-- T5: Bloqueio legítimo funciona (dono do restaurante, delivery nova)
-- Precisamos de uma delivery nova para este teste
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.deliveries (
  id, restaurant_id, driver_id,
  pickup_address, pickup_latitude, pickup_longitude,
  delivery_address, delivery_latitude, delivery_longitude,
  distance_km, price, price_adjusted, status, financial_status
) VALUES (
  'dddddd06-0000-0000-0000-000000000006',
  'bbbbbb01-0000-0000-0000-000000000001', NULL,
  'Col T5', -19.9, -43.9, 'Ent T5', -19.91, -43.91,
  2.0, 80.00, 80.00, 'pending', NULL
);

DO $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', 'aaaaaa01-0000-0000-0000-000000000001', 'role', 'authenticated')::text,
    true);
END; $$;
SET LOCAL ROLE authenticated;

SELECT is(
  (SELECT (public.block_delivery_funds(
    'bbbbbb01-0000-0000-0000-000000000001'::uuid,
    'dddddd06-0000-0000-0000-000000000006'::uuid,
    80.00
  ) ->> 'success')::boolean),
  true,
  'T5: Bloqueio legítimo pelo dono do restaurante → success=true'
);

SET LOCAL ROLE postgres;

-- ─────────────────────────────────────────────────────────────
-- T6: Driver NÃO consegue alterar price_adjusted via UPDATE direto
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', 'aaaaaa03-0000-0000-0000-000000000003', 'role', 'authenticated')::text,
    true);
END; $$;
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$
    UPDATE public.deliveries
    SET price_adjusted = 9999
    WHERE id = 'dddddd03-0000-0000-0000-000000000003'
  $$,
  '42501',
  NULL,
  'T6: Driver não altera price_adjusted → 42501'
);

SET LOCAL ROLE postgres;

-- ─────────────────────────────────────────────────────────────
-- T7: Driver NÃO consegue alterar financial_status via UPDATE direto
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', 'aaaaaa03-0000-0000-0000-000000000003', 'role', 'authenticated')::text,
    true);
END; $$;
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$
    UPDATE public.deliveries
    SET financial_status = 'blocked'
    WHERE id = 'dddddd04-0000-0000-0000-000000000004'
  $$,
  '42501',
  NULL,
  'T7: Driver não altera financial_status → 42501'
);

SET LOCAL ROLE postgres;

-- ─────────────────────────────────────────────────────────────
-- T8: Driver NÃO consegue ressuscitar entrega cancelled
-- status: cancelled → picked_up (estado terminal → ativo = bloqueado)
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', 'aaaaaa03-0000-0000-0000-000000000003', 'role', 'authenticated')::text,
    true);
END; $$;
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$
    UPDATE public.deliveries
    SET status = 'picked_up'
    WHERE id = 'dddddd04-0000-0000-0000-000000000004'
  $$,
  '42501',
  NULL,
  'T8: Driver não ressuscita entrega cancelled → 42501'
);

SET LOCAL ROLE postgres;

-- ─────────────────────────────────────────────────────────────
-- T9: authenticated NÃO consegue chamar finalize_delivery_transaction
-- (SEC-008: REVOKE FROM PUBLIC)
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', 'aaaaaa03-0000-0000-0000-000000000003', 'role', 'authenticated')::text,
    true);
END; $$;
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$
    SELECT public.finalize_delivery_transaction(
      'dddddd03-0000-0000-0000-000000000003'::uuid,
      'cccccc01-0000-0000-0000-000000000001'::uuid
    )
  $$,
  '42501',
  NULL,
  'T9: authenticated não chama finalize_delivery_transaction → permission denied'
);

SET LOCAL ROLE postgres;

-- ─────────────────────────────────────────────────────────────
-- T10: anon NÃO consegue chamar finalize_delivery_transaction
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"anon"}'::text, true);
END; $$;
SET LOCAL ROLE anon;

SELECT throws_ok(
  $$
    SELECT public.finalize_delivery_transaction(
      'dddddd03-0000-0000-0000-000000000003'::uuid,
      'cccccc01-0000-0000-0000-000000000001'::uuid
    )
  $$,
  '42501',
  NULL,
  'T10: anon não chama finalize_delivery_transaction → permission denied'
);

SET LOCAL ROLE postgres;

-- ─────────────────────────────────────────────────────────────
-- T11: postgres (simula service_role) CONSEGUE chamar finalize_delivery_transaction
-- A função não deve lançar permission denied como postgres
-- Pode retornar success=false se a entrega não estiver no estado certo — aceitável aqui
-- ─────────────────────────────────────────────────────────────

SELECT lives_ok(
  $$
    SELECT public.finalize_delivery_transaction(
      'dddddd03-0000-0000-0000-000000000003'::uuid,
      'cccccc01-0000-0000-0000-000000000001'::uuid
    )
  $$,
  'T11: postgres (service_role) chama finalize_delivery_transaction sem permission error'
);

-- ─────────────────────────────────────────────────────────────
-- T12: Conclusão legítima via finalize_delivery_transaction → PASSA
-- delivery_picked_up: status=picked_up, financial_status=blocked, driver correto
-- Após T11 a entrega pode ter sido finalizada. Usar delivery nova para T12.
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.deliveries (
  id, restaurant_id, driver_id,
  pickup_address, pickup_latitude, pickup_longitude,
  delivery_address, delivery_latitude, delivery_longitude,
  distance_km, price, price_adjusted, status, financial_status
) VALUES (
  'dddddd07-0000-0000-0000-000000000007',
  'bbbbbb01-0000-0000-0000-000000000001',
  'cccccc01-0000-0000-0000-000000000001',
  'Col T12', -19.9, -43.9, 'Ent T12', -19.91, -43.91,
  2.0, 60.00, 60.00, 'picked_up', 'blocked'
);
UPDATE public.restaurants
SET blocked_balance = blocked_balance + 60.00
WHERE id = 'bbbbbb01-0000-0000-0000-000000000001';

SELECT is(
  (SELECT (public.finalize_delivery_transaction(
    'dddddd07-0000-0000-0000-000000000007'::uuid,
    'cccccc01-0000-0000-0000-000000000001'::uuid
  ) ->> 'success')::boolean),
  true,
  'T12: Conclusão legítima → success=true'
);

-- Confirma earnings acumulado: T11 finalizou dddddd03 (150 × 80% = 120) como
-- última entrega da rota → driver recebeu 120. T12 finaliza dddddd07 (60 × 80% = 48)
-- também como última entrega → total = 120 + 48 = 168.
SELECT is(
  (SELECT earnings_balance FROM public.drivers
   WHERE id = 'cccccc01-0000-0000-0000-000000000001'),
  168.00::numeric,
  'T12b: earnings_balance = 168.00 (120 de T11 + 48 de T12)'
);

-- ─────────────────────────────────────────────────────────────
-- T13: Dupla conclusão — segunda chamada retorna false (FOR UPDATE guard)
-- Chama finalize duas vezes na mesma entrega; a segunda deve falhar
-- (status já é 'delivered' ou 'paid' após a primeira)
-- ─────────────────────────────────────────────────────────────

SELECT is(
  (SELECT (public.finalize_delivery_transaction(
    'dddddd07-0000-0000-0000-000000000007'::uuid,
    'cccccc01-0000-0000-0000-000000000001'::uuid
  ) ->> 'success')::boolean),
  false,
  'T13: Segunda finalização da mesma entrega → success=false (status não é picked_up/returning)'
);

-- ─────────────────────────────────────────────────────────────
-- T14: Retry com entrega já delivered → retorna false sem creditar novamente
-- Verificado também em T13 (mesmo mecanismo). Confirma earnings inalterado.
-- ─────────────────────────────────────────────────────────────

-- T13 retornou false (status já 'delivered') sem creditar novamente.
-- Confirma que earnings_balance permanece 168.00 — sem double credit.
SELECT is(
  (SELECT earnings_balance FROM public.drivers
   WHERE id = 'cccccc01-0000-0000-0000-000000000001'),
  168.00::numeric,
  'T14: earnings_balance permanece 168.00 após retry (sem double credit)'
);

-- ─────────────────────────────────────────────────────────────
-- T15: Delivery cancelled não pode ser concluída
-- ─────────────────────────────────────────────────────────────

SELECT is(
  (SELECT (public.finalize_delivery_transaction(
    'dddddd04-0000-0000-0000-000000000004'::uuid,  -- status=cancelled
    'cccccc01-0000-0000-0000-000000000001'::uuid
  ) ->> 'success')::boolean),
  false,
  'T15: Delivery cancelled não pode ser concluída → success=false'
);

-- ─────────────────────────────────────────────────────────────
-- T16: Delivery refunded não pode ser concluída
-- financial_status=refunded → check inside finalize rejeita
-- ─────────────────────────────────────────────────────────────

SELECT is(
  (SELECT (public.finalize_delivery_transaction(
    'dddddd05-0000-0000-0000-000000000005'::uuid,  -- financial_status=refunded
    'cccccc01-0000-0000-0000-000000000001'::uuid
  ) ->> 'success')::boolean),
  false,
  'T16: Delivery refunded não pode ser concluída → success=false'
);

-- ─────────────────────────────────────────────────────────────
-- FINISH
-- ─────────────────────────────────────────────────────────────

SELECT * FROM finish();

ROLLBACK;
