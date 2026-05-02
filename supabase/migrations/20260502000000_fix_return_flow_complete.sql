-- ── Fix completo do fluxo de retorno ──────────────────────────────────────
-- Garante que 'returning' existe no enum e que finalize_delivery_transaction
-- aceita tanto 'picked_up' quanto 'returning' (e 'delivering' para compatibilidade).

-- 1. Garantir que 'returning' existe no enum delivery_status
DO $$
BEGIN
  ALTER TYPE delivery_status ADD VALUE IF NOT EXISTS 'returning';
EXCEPTION WHEN invalid_parameter_value THEN
  NULL; -- já existe
END;
$$;

-- 2. Atualizar finalize_delivery_transaction para aceitar os 3 status válidos
CREATE OR REPLACE FUNCTION public.finalize_delivery_transaction(p_delivery_id uuid, p_driver_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery RECORD;
  v_restaurant_blocked numeric;
  v_driver_pending numeric;
  v_driver_available numeric;
  v_platform_fee numeric;
  v_driver_earnings numeric;
  v_parent_id uuid;
  v_remaining_deliveries integer;
  v_total_route_earnings numeric := 0;
  v_total_route_fees numeric := 0;
  v_is_last_delivery boolean := false;
  v_route_delivery RECORD;
  v_actual_price numeric;
BEGIN
  -- Lock delivery
  SELECT * INTO v_delivery
  FROM deliveries
  WHERE id = p_delivery_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Entrega não encontrada');
  END IF;

  -- Aceita 'picked_up' (normal), 'returning' (com retorno) e 'delivering' (compatibilidade)
  IF v_delivery.status NOT IN ('picked_up', 'returning', 'delivering') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Entrega não está no status correto. Status atual: ' || v_delivery.status::text
    );
  END IF;

  IF v_delivery.driver_id != p_driver_id THEN
    RETURN json_build_object('success', false, 'error', 'Entrega não atribuída a este motorista');
  END IF;

  IF v_delivery.financial_status != 'blocked' THEN
    RETURN json_build_object('success', false, 'error', 'Fundos não estão bloqueados');
  END IF;

  -- Use actual price: price_adjusted if > 0, otherwise use price
  v_actual_price := CASE
    WHEN v_delivery.price_adjusted > 0 THEN v_delivery.price_adjusted
    ELSE v_delivery.price
  END;

  -- Determine parent_id for route grouping
  v_parent_id := COALESCE(v_delivery.parent_delivery_id, v_delivery.id);

  -- Calculate split for this delivery
  v_platform_fee := v_actual_price * 0.20;
  v_driver_earnings := v_actual_price * 0.80;

  -- Lock restaurant and check blocked balance
  SELECT blocked_balance INTO v_restaurant_blocked
  FROM restaurants
  WHERE id = v_delivery.restaurant_id
  FOR UPDATE;

  -- If blocked_balance is less than required, try to block from wallet_balance first
  IF v_restaurant_blocked < v_actual_price THEN
    DECLARE
      v_wallet_balance numeric;
      v_needed numeric := v_actual_price - GREATEST(v_restaurant_blocked, 0);
    BEGIN
      SELECT wallet_balance INTO v_wallet_balance
      FROM restaurants
      WHERE id = v_delivery.restaurant_id;

      IF v_wallet_balance >= v_needed THEN
        UPDATE restaurants
        SET wallet_balance = wallet_balance - v_needed,
            blocked_balance = blocked_balance + v_needed
        WHERE id = v_delivery.restaurant_id;
        v_restaurant_blocked := v_restaurant_blocked + v_needed;
      ELSE
        RETURN json_build_object('success', false, 'error', 'Saldo insuficiente para processar a entrega');
      END IF;
    END;
  END IF;

  -- Deduct from blocked
  UPDATE restaurants
  SET blocked_balance = blocked_balance - v_actual_price
  WHERE id = v_delivery.restaurant_id;

  -- Update delivery status to delivered
  UPDATE deliveries
  SET status = 'delivered',
      financial_status = 'transferring',
      delivered_at = now(),
      price_adjusted = v_actual_price
  WHERE id = p_delivery_id;

  -- Record platform fee for this delivery
  INSERT INTO platform_fees (delivery_id, amount)
  VALUES (p_delivery_id, v_platform_fee);

  -- Record escrow release transaction
  INSERT INTO transactions (delivery_id, restaurant_id, driver_id, amount, driver_earnings, platform_fee, type, description)
  VALUES (p_delivery_id, v_delivery.restaurant_id, NULL, -v_actual_price, NULL, NULL, 'escrow_release', 'Liberação do escrow');

  -- Record platform fee transaction
  INSERT INTO transactions (delivery_id, restaurant_id, driver_id, amount, driver_earnings, platform_fee, type, description)
  VALUES (p_delivery_id, NULL, NULL, v_platform_fee, NULL, v_platform_fee, 'platform_fee', 'Taxa da plataforma (20%)');

  -- Check remaining deliveries in route
  -- 'returning' conta como ainda ativa (driver não foi pago ainda)
  SELECT COUNT(*) INTO v_remaining_deliveries
  FROM deliveries
  WHERE (id = v_parent_id OR parent_delivery_id = v_parent_id)
    AND driver_id = p_driver_id
    AND status IN ('accepted', 'picking_up', 'picked_up', 'delivering', 'returning');

  IF v_remaining_deliveries = 0 THEN
    v_is_last_delivery := true;

    FOR v_route_delivery IN
      SELECT id, price, price_adjusted
      FROM deliveries
      WHERE (id = v_parent_id OR parent_delivery_id = v_parent_id)
        AND driver_id = p_driver_id
        AND status = 'delivered'
        AND financial_status = 'transferring'
    LOOP
      DECLARE
        v_route_actual_price numeric := CASE
          WHEN v_route_delivery.price_adjusted > 0 THEN v_route_delivery.price_adjusted
          ELSE v_route_delivery.price
        END;
      BEGIN
        v_total_route_earnings := v_total_route_earnings + (v_route_actual_price * 0.80);
        v_total_route_fees := v_total_route_fees + (v_route_actual_price * 0.20);

        UPDATE deliveries SET financial_status = 'paid' WHERE id = v_route_delivery.id;

        INSERT INTO transactions (delivery_id, restaurant_id, driver_id, amount, driver_earnings, platform_fee, type, description)
        VALUES (v_route_delivery.id, NULL, p_driver_id, v_route_actual_price * 0.80, v_route_actual_price * 0.80, NULL, 'delivery_payment', 'Pagamento de entrega (80%)');
      END;
    END LOOP;

    SELECT pending_balance, earnings_balance INTO v_driver_pending, v_driver_available
    FROM drivers WHERE id = p_driver_id FOR UPDATE;

    UPDATE drivers
    SET earnings_balance = earnings_balance + v_total_route_earnings,
        total_deliveries = COALESCE(total_deliveries, 0) + 1
    WHERE id = p_driver_id;

    SELECT earnings_balance INTO v_driver_available FROM drivers WHERE id = p_driver_id;
  ELSE
    UPDATE drivers
    SET total_deliveries = COALESCE(total_deliveries, 0) + 1
    WHERE id = p_driver_id;

    SELECT earnings_balance INTO v_driver_available FROM drivers WHERE id = p_driver_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'delivery_id', p_delivery_id,
    'total_amount', v_actual_price,
    'driver_earnings', v_driver_earnings,
    'platform_fee', v_platform_fee,
    'is_last_delivery', v_is_last_delivery,
    'total_route_earnings', v_total_route_earnings,
    'driver_balance_after', v_driver_available
  );
END;
$$;
