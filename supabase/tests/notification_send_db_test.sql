-- =============================================================
-- Testes de banco: operações do send-notification (Etapa 2)
--
-- Verifica as queries SQL que a Edge Function executa:
--   T1  : admin check query retorna 1 para admin real
--   T2  : admin check query retorna 0 para não-admin
--   T3  : batch INSERT de 3 notificações com sent_by funciona
--   T4  : expires_at é armazenado e representa data futura
--   T5  : query de recipients all_drivers retorna só drivers
--   T6  : query de recipients all_restaurants retorna só restaurantes
--   T7  : notification_campaigns armazena recipients_count correto
--   T8  : query de idempotência detecta campanha recente (< 60s)
-- =============================================================

BEGIN;

SELECT plan(8);

-- ─────────────────────────────────────────────────────────────
-- SETUP: 1 admin, 2 drivers, 1 restaurante
-- (UUIDs no prefixo bbbbbb para não colidir com outros testes)
-- ─────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, aud, role
) VALUES
  (
    'bbbbbb01-0000-0000-0000-000000000001',
    'send_admin@test.levei',
    crypt('senha123', gen_salt('bf')),
    now(), '{}', '{}', now(), now(), 'authenticated', 'authenticated'
  ),
  (
    'bbbbbb02-0000-0000-0000-000000000002',
    'send_driver1@test.levei',
    crypt('senha123', gen_salt('bf')),
    now(), '{}', '{}', now(), now(), 'authenticated', 'authenticated'
  ),
  (
    'bbbbbb03-0000-0000-0000-000000000003',
    'send_driver2@test.levei',
    crypt('senha123', gen_salt('bf')),
    now(), '{}', '{}', now(), now(), 'authenticated', 'authenticated'
  ),
  (
    'bbbbbb04-0000-0000-0000-000000000004',
    'send_restaurant@test.levei',
    crypt('senha123', gen_salt('bf')),
    now(), '{}', '{}', now(), now(), 'authenticated', 'authenticated'
  );

INSERT INTO public.profiles (id, full_name)
VALUES
  ('bbbbbb01-0000-0000-0000-000000000001', 'Send Admin'),
  ('bbbbbb02-0000-0000-0000-000000000002', 'Send Driver 1'),
  ('bbbbbb03-0000-0000-0000-000000000003', 'Send Driver 2'),
  ('bbbbbb04-0000-0000-0000-000000000004', 'Send Restaurant')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('bbbbbb01-0000-0000-0000-000000000001', 'admin'),
  ('bbbbbb02-0000-0000-0000-000000000002', 'driver'),
  ('bbbbbb03-0000-0000-0000-000000000003', 'driver'),
  ('bbbbbb04-0000-0000-0000-000000000004', 'restaurant');

-- ─────────────────────────────────────────────────────────────
-- T1: admin check query retorna 1 para usuário admin
--     (mesma query usada pela Edge Function para verificar admin)
-- ─────────────────────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::integer
    FROM public.user_roles
    WHERE user_id = 'bbbbbb01-0000-0000-0000-000000000001'
      AND role    = 'admin'),
  1,
  'T1: admin check query retorna 1 para usuário com role admin'
);

-- ─────────────────────────────────────────────────────────────
-- T2: admin check query retorna 0 para usuário sem role admin
-- ─────────────────────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::integer
    FROM public.user_roles
    WHERE user_id = 'bbbbbb02-0000-0000-0000-000000000002'
      AND role    = 'admin'),
  0,
  'T2: admin check query retorna 0 para usuário sem role admin'
);

-- ─────────────────────────────────────────────────────────────
-- T3: batch INSERT de 3 notificações com sent_by funciona
--     (simula broadcast para driver1, driver2, restaurant)
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.notifications (user_id, title, message, type, priority, sent_by)
VALUES
  (
    'bbbbbb02-0000-0000-0000-000000000002',
    'Broadcast de Plataforma', 'Mensagem de broadcast para todos',
    'system', 'important', 'bbbbbb01-0000-0000-0000-000000000001'
  ),
  (
    'bbbbbb03-0000-0000-0000-000000000003',
    'Broadcast de Plataforma', 'Mensagem de broadcast para todos',
    'system', 'important', 'bbbbbb01-0000-0000-0000-000000000001'
  ),
  (
    'bbbbbb04-0000-0000-0000-000000000004',
    'Broadcast de Plataforma', 'Mensagem de broadcast para todos',
    'system', 'important', 'bbbbbb01-0000-0000-0000-000000000001'
  );

SELECT is(
  (SELECT count(*)::integer
    FROM public.notifications
    WHERE sent_by = 'bbbbbb01-0000-0000-0000-000000000001'
      AND title   = 'Broadcast de Plataforma'),
  3,
  'T3: batch INSERT de 3 notificações com sent_by funciona corretamente'
);

-- ─────────────────────────────────────────────────────────────
-- T4: expires_at é armazenado e representa data futura
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.notifications
  (id, user_id, title, message, type, priority, sent_by, expires_at)
VALUES (
  'cccccc01-0000-0000-0000-000000000001',
  'bbbbbb02-0000-0000-0000-000000000002',
  'Com Validade', 'Notificação com prazo de expiração',
  'info', 'urgent', 'bbbbbb01-0000-0000-0000-000000000001',
  now() + interval '7 days'
);

SELECT ok(
  (SELECT expires_at > now()
    FROM public.notifications
    WHERE id = 'cccccc01-0000-0000-0000-000000000001'),
  'T4: expires_at é armazenado corretamente e representa data futura'
);

-- ─────────────────────────────────────────────────────────────
-- T5: query de recipients all_drivers retorna só drivers
--     (filtro por user_id IN para isolar o setup deste teste)
-- ─────────────────────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::integer
    FROM public.user_roles
    WHERE role    = 'driver'
      AND user_id IN (
        'bbbbbb02-0000-0000-0000-000000000002',
        'bbbbbb03-0000-0000-0000-000000000003',
        'bbbbbb04-0000-0000-0000-000000000004'
      )),
  2,
  'T5: query all_drivers retorna exatamente os 2 drivers do setup'
);

-- ─────────────────────────────────────────────────────────────
-- T6: query de recipients all_restaurants retorna só restaurantes
-- ─────────────────────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::integer
    FROM public.user_roles
    WHERE role    = 'restaurant'
      AND user_id IN (
        'bbbbbb02-0000-0000-0000-000000000002',
        'bbbbbb03-0000-0000-0000-000000000003',
        'bbbbbb04-0000-0000-0000-000000000004'
      )),
  1,
  'T6: query all_restaurants retorna exatamente 1 restaurante do setup'
);

-- ─────────────────────────────────────────────────────────────
-- T7: notification_campaigns armazena recipients_count correto
-- ─────────────────────────────────────────────────────────────

INSERT INTO public.notification_campaigns
  (id, sent_by, recipient_type, title, message, type, priority, recipients_count)
VALUES (
  'dddddd01-0000-0000-0000-000000000001',
  'bbbbbb01-0000-0000-0000-000000000001',
  'all_drivers',
  'Broadcast de Plataforma', 'Mensagem de broadcast para todos',
  'system', 'important',
  2
);

SELECT is(
  (SELECT recipients_count
    FROM public.notification_campaigns
    WHERE id = 'dddddd01-0000-0000-0000-000000000001'),
  2,
  'T7: notification_campaigns armazena recipients_count = 2 corretamente'
);

-- ─────────────────────────────────────────────────────────────
-- T8: query de idempotência detecta campanha criada há < 60s
--     (a campanha do T7 tem created_at = now(); a query usa
--     gte(now()-60s) — deve encontrar exatamente 1 registro)
-- ─────────────────────────────────────────────────────────────

SELECT is(
  (SELECT count(*)::integer
    FROM public.notification_campaigns
    WHERE sent_by        = 'bbbbbb01-0000-0000-0000-000000000001'
      AND recipient_type = 'all_drivers'
      AND title          = 'Broadcast de Plataforma'
      AND message        = 'Mensagem de broadcast para todos'
      AND type           = 'system'
      AND priority       = 'important'
      AND created_at    >= now() - interval '60 seconds'),
  1,
  'T8: query de idempotência detecta campanha enviada há menos de 60 segundos'
);

-- ─────────────────────────────────────────────────────────────
-- FINISH
-- ─────────────────────────────────────────────────────────────

SELECT * FROM finish();

ROLLBACK;
