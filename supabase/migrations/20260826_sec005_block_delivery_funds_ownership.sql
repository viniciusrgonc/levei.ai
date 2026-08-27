-- SEC-005: block_delivery_funds — ownership check + valor server-authoritative
--
-- ══════════════════════════════════════════════════════════════════════════════
-- VULNERABILIDADES CORRIGIDAS
-- ══════════════════════════════════════════════════════════════════════════════
--
-- [CRÍTICO] Qualquer authenticated podia drenar o wallet_balance de qualquer
-- restaurante passando um restaurant_id arbitrário — sem verificação de que
-- auth.uid() é dono do restaurante.
--
-- [CRÍTICO] p_amount vinha do cliente sem validação — um valor arbitrário era
-- aceito para o bloqueio, desvinculado do price_adjusted real da entrega.
--
-- [CRÍTICO] delivery_id não era vinculado ao restaurant_id — era possível
-- forçar o bloqueio usando a entrega de outro restaurante para drenar saldo.
--
-- ══════════════════════════════════════════════════════════════════════════════
-- REGRAS IMPLEMENTADAS
-- ══════════════════════════════════════════════════════════════════════════════
--
-- 1. auth.uid() IS NOT NULL → restaurant.user_id deve ser auth.uid()
--    (service_role / postgres: auth.uid() IS NULL → trusted caller, skip)
--
-- 2. delivery.restaurant_id deve ser igual a p_restaurant_id
--
-- 3. delivery não deve estar já bloqueada ou em estado terminal
--
-- 4. Valor usado = delivery.price_adjusted (server-authoritative)
--    p_amount é mantido no signature para compatibilidade mas ignorado
--    para o cálculo financeiro. O valor real vem do registro da entrega.
--
-- ══════════════════════════════════════════════════════════════════════════════
-- IMPACTO NO FRONTEND
-- ══════════════════════════════════════════════════════════════════════════════
--
-- NewDelivery.tsx:348 chama:
--   supabase.rpc('block_delivery_funds', {
--     p_restaurant_id: restaurant.id,   ← dono da sessão ✓ (será validado)
--     p_delivery_id: data.id,            ← entrega recém-criada ✓
--     p_amount: estimatedPrice           ← ignorado; price_adjusted é usado
--   })
--
-- Nenhuma alteração de frontend necessária.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.block_delivery_funds(
  p_restaurant_id uuid,
  p_delivery_id   uuid,
  p_amount        numeric   -- mantido por compatibilidade; ignorado no cálculo
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_restaurant         RECORD;
  v_delivery           RECORD;
  v_authoritative_amount numeric;
  v_new_available      numeric;
  v_new_blocked        numeric;
BEGIN
  -- ── 1. Lock restaurante ─────────────────────────────────────────────────
  SELECT id, user_id, wallet_balance, blocked_balance
  INTO v_restaurant
  FROM restaurants
  WHERE id = p_restaurant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Restaurante não encontrado');
  END IF;

  -- ── 2. SEC-005: Ownership check ─────────────────────────────────────────
  -- auth.uid() IS NULL → service_role / postgres → trusted caller, ignora check.
  -- auth.uid() IS NOT NULL → usuário autenticado → deve ser dono do restaurante.
  IF auth.uid() IS NOT NULL AND v_restaurant.user_id != auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Operação não autorizada');
  END IF;

  -- ── 3. Lock entrega ─────────────────────────────────────────────────────
  SELECT id, restaurant_id, price_adjusted, price, status, financial_status
  INTO v_delivery
  FROM deliveries
  WHERE id = p_delivery_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Entrega não encontrada');
  END IF;

  -- ── 4. SEC-005: Entrega deve pertencer ao restaurante ───────────────────
  IF v_delivery.restaurant_id != p_restaurant_id THEN
    RETURN json_build_object('success', false, 'error', 'Entrega não pertence a este restaurante');
  END IF;

  -- ── 5. Estado da entrega deve permitir bloqueio ─────────────────────────
  IF v_delivery.financial_status = 'blocked' THEN
    RETURN json_build_object('success', false, 'error', 'Fundos já estão bloqueados para esta entrega');
  END IF;

  IF v_delivery.status IN (
    'cancelled', 'delivered', 'cancellation_completed', 'package_returned'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Status da entrega não permite bloqueio de fundos'
    );
  END IF;

  -- ── 6. SEC-005: Valor autoritativo da entrega (não do cliente) ──────────
  v_authoritative_amount := CASE
    WHEN v_delivery.price_adjusted > 0 THEN v_delivery.price_adjusted
    ELSE v_delivery.price
  END;

  IF v_authoritative_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Valor da entrega inválido');
  END IF;

  -- ── 7. Saldo disponível ─────────────────────────────────────────────────
  IF v_restaurant.wallet_balance < v_authoritative_amount THEN
    RETURN json_build_object(
      'success',   false,
      'error',     'Saldo insuficiente',
      'available', v_restaurant.wallet_balance,
      'required',  v_authoritative_amount
    );
  END IF;

  -- ── 8. Move wallet → blocked ────────────────────────────────────────────
  v_new_available := v_restaurant.wallet_balance - v_authoritative_amount;
  v_new_blocked   := v_restaurant.blocked_balance + v_authoritative_amount;

  UPDATE restaurants
  SET wallet_balance  = v_new_available,
      blocked_balance = v_new_blocked
  WHERE id = p_restaurant_id;

  -- ── 9. Marca financial_status da entrega ────────────────────────────────
  UPDATE deliveries
  SET financial_status = 'blocked'
  WHERE id = p_delivery_id;

  -- ── 10. Registra transação ──────────────────────────────────────────────
  INSERT INTO transactions (
    delivery_id, restaurant_id, amount, type, description
  ) VALUES (
    p_delivery_id,
    p_restaurant_id,
    -v_authoritative_amount,
    'escrow_block',
    'Valor bloqueado para entrega'
  );

  RETURN json_build_object(
    'success',         true,
    'available_balance', v_new_available,
    'blocked_balance', v_new_blocked
  );
END;
$$;
