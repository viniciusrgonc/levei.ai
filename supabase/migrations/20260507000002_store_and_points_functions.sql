-- ============================================================
-- Funções do sistema de pontos e loja
-- Aplicadas via Supabase Dashboard em 2026-05-07
-- Este arquivo serve como referência e backup idempotente
-- ============================================================

-- ── increment_driver_points ──────────────────────────────────
-- Incrementa os pontos de um driver de forma segura (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.increment_driver_points(
  p_driver_id UUID,
  p_points    INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE drivers
  SET points = points + p_points
  WHERE id = p_driver_id;
END;
$$;

-- ── register_referral ────────────────────────────────────────
-- Registra indicação ao criar novo driver.
-- Silencioso se código inválido (retorna found=false).
CREATE OR REPLACE FUNCTION public.register_referral(
  p_referral_code  TEXT,
  p_new_driver_id  UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
BEGIN
  SELECT id INTO v_referrer_id
  FROM drivers
  WHERE referral_code = p_referral_code
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;

  -- Evita auto-referência
  IF v_referrer_id = p_new_driver_id THEN
    RETURN json_build_object('found', false);
  END IF;

  INSERT INTO referrals (referrer_driver_id, referred_driver_id, referral_code, status, referred_deliveries)
  VALUES (v_referrer_id, p_new_driver_id, p_referral_code, 'pending', 0)
  ON CONFLICT (referred_driver_id) DO NOTHING;

  UPDATE drivers
  SET referred_by = p_referral_code
  WHERE id = p_new_driver_id;

  RETURN json_build_object('found', true);
END;
$$;

-- ── process_referral_completion ──────────────────────────────
-- Chamada ao completar uma entrega. Avança estado do referral:
--   pending  → validated (1ª entrega)
--   validated → rewarded  (5ª entrega, +100 pontos)
CREATE OR REPLACE FUNCTION public.process_referral_completion(
  p_driver_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral referrals%ROWTYPE;
BEGIN
  SELECT * INTO v_referral
  FROM referrals
  WHERE referred_driver_id = p_driver_id
    AND status != 'rewarded'
  LIMIT 1;

  IF v_referral IS NULL THEN
    RETURN;
  END IF;

  -- Incrementa contador
  UPDATE referrals
  SET referred_deliveries = referred_deliveries + 1
  WHERE id = v_referral.id;

  -- 1ª entrega → validated
  IF v_referral.status = 'pending' AND v_referral.referred_deliveries + 1 >= 1 THEN
    UPDATE referrals
    SET status = 'validated', validated_at = NOW()
    WHERE id = v_referral.id;
  END IF;

  -- 5ª entrega → rewarded (+100 pontos para o referente)
  IF v_referral.referred_deliveries + 1 >= 5 THEN
    UPDATE referrals
    SET status = 'rewarded', rewarded_at = NOW()
    WHERE id = v_referral.id;

    PERFORM public.increment_driver_points(v_referral.referrer_driver_id, 100);
  END IF;
END;
$$;

-- ── redeem_store_item ────────────────────────────────────────
-- Resgate atômico: deduz pontos, decrementa stock, insere redemption.
-- Retorna JSON: { success, error?, redemption_id?, points_used? }
CREATE OR REPLACE FUNCTION public.redeem_store_item(
  p_item_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id UUID;
  v_points    INTEGER;
  v_item      RECORD;
  v_redeem_id UUID;
BEGIN
  -- Busca o driver do usuário autenticado
  SELECT id, points INTO v_driver_id, v_points
  FROM drivers
  WHERE user_id = auth.uid();

  IF v_driver_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Driver not found');
  END IF;

  -- Busca item com lock pessimista
  SELECT id, name, points_cost, stock, is_active
  INTO v_item
  FROM store_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF v_item IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Item not found');
  END IF;

  IF NOT v_item.is_active THEN
    RETURN json_build_object('success', false, 'error', 'Item unavailable');
  END IF;

  -- stock = -1 → ilimitado; stock = 0 → esgotado
  IF v_item.stock = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Out of stock');
  END IF;

  IF v_points < v_item.points_cost THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient points');
  END IF;

  -- Deduz pontos
  UPDATE drivers
  SET points = points - v_item.points_cost
  WHERE id = v_driver_id;

  -- Decrementa stock se não for ilimitado
  IF v_item.stock > 0 THEN
    UPDATE store_items
    SET stock = stock - 1
    WHERE id = p_item_id;
  END IF;

  -- Insere redemption
  INSERT INTO store_redemptions (driver_id, item_id, points_used, status)
  VALUES (v_driver_id, p_item_id, v_item.points_cost, 'pending')
  RETURNING id INTO v_redeem_id;

  RETURN json_build_object(
    'success',      true,
    'redemption_id', v_redeem_id,
    'points_used',  v_item.points_cost
  );
END;
$$;

-- RLS policies para store_items e store_redemptions
-- (idempotentes — DROP IF EXISTS antes de criar)
DO $$
BEGIN
  -- store_items: leitura pública de itens ativos
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'store_items' AND policyname = 'store_items_select_active'
  ) THEN
    EXECUTE 'CREATE POLICY store_items_select_active ON public.store_items
      FOR SELECT USING (is_active = true OR auth.uid() IN (
        SELECT user_id FROM public.user_roles WHERE role = ''admin''
      ))';
  END IF;

  -- store_items: somente admin faz CRUD
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'store_items' AND policyname = 'store_items_admin_all'
  ) THEN
    EXECUTE 'CREATE POLICY store_items_admin_all ON public.store_items
      FOR ALL USING (auth.uid() IN (
        SELECT user_id FROM public.user_roles WHERE role = ''admin''
      ))';
  END IF;

  -- store_redemptions: driver vê os seus próprios
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'store_redemptions' AND policyname = 'store_redemptions_driver_select'
  ) THEN
    EXECUTE 'CREATE POLICY store_redemptions_driver_select ON public.store_redemptions
      FOR SELECT USING (driver_id IN (
        SELECT id FROM public.drivers WHERE user_id = auth.uid()
      ))';
  END IF;

  -- store_redemptions: admin gerencia tudo
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'store_redemptions' AND policyname = 'store_redemptions_admin_all'
  ) THEN
    EXECUTE 'CREATE POLICY store_redemptions_admin_all ON public.store_redemptions
      FOR ALL USING (auth.uid() IN (
        SELECT user_id FROM public.user_roles WHERE role = ''admin''
      ))';
  END IF;
END;
$$;
