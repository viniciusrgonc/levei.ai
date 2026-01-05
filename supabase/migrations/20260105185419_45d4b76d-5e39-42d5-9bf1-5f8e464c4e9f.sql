-- Update the refund_delivery_funds function to handle cancellation penalties
CREATE OR REPLACE FUNCTION public.refund_delivery_funds(p_delivery_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery record;
  v_restaurant_id uuid;
  v_driver_id uuid;
  v_total_amount numeric;
  v_penalty_rate numeric := 0;
  v_penalty_amount numeric := 0;
  v_refund_amount numeric := 0;
  v_driver_penalty_share numeric := 0;
  v_platform_penalty_share numeric := 0;
BEGIN
  -- Get delivery details with lock
  SELECT d.*, d.restaurant_id, d.driver_id, d.price_adjusted, d.status
  INTO v_delivery
  FROM deliveries d
  WHERE d.id = p_delivery_id
  FOR UPDATE;

  IF v_delivery IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Entrega não encontrada');
  END IF;

  -- Only allow cancellation for pending, accepted, or picked_up status
  IF v_delivery.status NOT IN ('pending', 'accepted', 'picked_up') THEN
    RETURN json_build_object('success', false, 'error', 'Esta entrega não pode ser cancelada');
  END IF;

  v_restaurant_id := v_delivery.restaurant_id;
  v_driver_id := v_delivery.driver_id;
  v_total_amount := v_delivery.price_adjusted;

  -- Calculate penalty based on delivery status
  CASE v_delivery.status
    WHEN 'pending' THEN
      -- No penalty before driver accepts
      v_penalty_rate := 0;
      v_penalty_amount := 0;
      v_refund_amount := v_total_amount;
      
    WHEN 'accepted' THEN
      -- 15% penalty after accept, before pickup (between 10-20%)
      v_penalty_rate := 0.15;
      v_penalty_amount := ROUND(v_total_amount * v_penalty_rate, 2);
      v_refund_amount := v_total_amount - v_penalty_amount;
      -- 100% of penalty goes to driver
      v_driver_penalty_share := v_penalty_amount;
      v_platform_penalty_share := 0;
      
    WHEN 'picked_up' THEN
      -- 75% penalty after pickup starts (between 50-100%)
      v_penalty_rate := 0.75;
      v_penalty_amount := ROUND(v_total_amount * v_penalty_rate, 2);
      v_refund_amount := v_total_amount - v_penalty_amount;
      -- 70% to driver, 30% to platform
      v_driver_penalty_share := ROUND(v_penalty_amount * 0.70, 2);
      v_platform_penalty_share := v_penalty_amount - v_driver_penalty_share;
  END CASE;

  -- Refund remaining amount to restaurant's wallet
  UPDATE restaurants
  SET wallet_balance = wallet_balance + v_refund_amount,
      blocked_balance = blocked_balance - v_total_amount,
      updated_at = now()
  WHERE id = v_restaurant_id;

  -- If there's a penalty and a driver, pay the driver
  IF v_driver_penalty_share > 0 AND v_driver_id IS NOT NULL THEN
    UPDATE drivers
    SET earnings_balance = earnings_balance + v_driver_penalty_share,
        updated_at = now()
    WHERE id = v_driver_id;

    -- Record driver penalty payment transaction
    INSERT INTO transactions (
      delivery_id, driver_id, restaurant_id, amount, type, description,
      driver_earnings, platform_fee
    ) VALUES (
      p_delivery_id, v_driver_id, v_restaurant_id, v_penalty_amount,
      'escrow_refund', 'Multa por cancelamento - parte entregador',
      v_driver_penalty_share, v_platform_penalty_share
    );
  END IF;

  -- Record platform fee if any
  IF v_platform_penalty_share > 0 THEN
    INSERT INTO platform_fees (delivery_id, amount)
    VALUES (p_delivery_id, v_platform_penalty_share);
  END IF;

  -- Record refund transaction
  INSERT INTO transactions (
    delivery_id, restaurant_id, amount, type, description
  ) VALUES (
    p_delivery_id, v_restaurant_id, v_refund_amount,
    'escrow_refund', 'Estorno por cancelamento'
  );

  -- Update delivery status
  UPDATE deliveries
  SET status = 'cancelled',
      cancelled_at = now(),
      financial_status = 'refunded',
      updated_at = now()
  WHERE id = p_delivery_id;

  RETURN json_build_object(
    'success', true,
    'refunded_amount', v_refund_amount,
    'penalty_amount', v_penalty_amount,
    'penalty_rate', v_penalty_rate,
    'driver_share', v_driver_penalty_share,
    'platform_share', v_platform_penalty_share,
    'total_amount', v_total_amount
  );
END;
$$;

-- Create a function to calculate cancellation penalty preview (for UI)
CREATE OR REPLACE FUNCTION public.calculate_cancellation_penalty(p_delivery_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery record;
  v_total_amount numeric;
  v_penalty_rate numeric := 0;
  v_penalty_amount numeric := 0;
  v_refund_amount numeric := 0;
  v_driver_penalty_share numeric := 0;
  v_platform_penalty_share numeric := 0;
  v_can_cancel boolean := true;
  v_cancel_message text := '';
BEGIN
  -- Get delivery details
  SELECT d.*, d.price_adjusted, d.status
  INTO v_delivery
  FROM deliveries d
  WHERE d.id = p_delivery_id;

  IF v_delivery IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Entrega não encontrada');
  END IF;

  v_total_amount := v_delivery.price_adjusted;

  -- Calculate penalty based on delivery status
  CASE v_delivery.status
    WHEN 'pending' THEN
      v_penalty_rate := 0;
      v_penalty_amount := 0;
      v_refund_amount := v_total_amount;
      v_cancel_message := 'Cancelamento sem multa';
      
    WHEN 'accepted' THEN
      v_penalty_rate := 0.15;
      v_penalty_amount := ROUND(v_total_amount * v_penalty_rate, 2);
      v_refund_amount := v_total_amount - v_penalty_amount;
      v_driver_penalty_share := v_penalty_amount;
      v_cancel_message := 'Multa de 15% aplicada (entregador já aceitou)';
      
    WHEN 'picked_up' THEN
      v_penalty_rate := 0.75;
      v_penalty_amount := ROUND(v_total_amount * v_penalty_rate, 2);
      v_refund_amount := v_total_amount - v_penalty_amount;
      v_driver_penalty_share := ROUND(v_penalty_amount * 0.70, 2);
      v_platform_penalty_share := v_penalty_amount - v_driver_penalty_share;
      v_cancel_message := 'Multa de 75% aplicada (coleta já iniciada)';
      
    ELSE
      v_can_cancel := false;
      v_cancel_message := 'Esta entrega não pode ser cancelada';
  END CASE;

  RETURN json_build_object(
    'success', true,
    'can_cancel', v_can_cancel,
    'message', v_cancel_message,
    'total_amount', v_total_amount,
    'penalty_rate', v_penalty_rate,
    'penalty_amount', v_penalty_amount,
    'refund_amount', v_refund_amount,
    'driver_share', v_driver_penalty_share,
    'platform_share', v_platform_penalty_share,
    'status', v_delivery.status
  );
END;
$$;