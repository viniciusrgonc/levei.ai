-- Add cancellation_reason field to deliveries
ALTER TABLE public.deliveries
ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- Update refund_delivery_funds to handle batch deliveries
CREATE OR REPLACE FUNCTION public.refund_delivery_funds(p_delivery_id uuid, p_cancellation_reason text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  v_is_additional boolean;
  v_child_delivery record;
  v_child_result json;
BEGIN
  -- Get delivery details with lock
  SELECT d.*, d.restaurant_id, d.driver_id, d.price_adjusted, d.status, 
         d.is_additional_delivery, d.parent_delivery_id
  INTO v_delivery
  FROM deliveries d
  WHERE d.id = p_delivery_id
  FOR UPDATE;

  IF v_delivery IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Entrega não encontrada');
  END IF;

  -- Block cancellation if delivery is in final route (delivering status)
  IF v_delivery.status = 'delivering' THEN
    RETURN json_build_object('success', false, 'error', 'Não é possível cancelar uma entrega em rota final');
  END IF;

  -- Only allow cancellation for pending, accepted, picking_up, or picked_up status
  IF v_delivery.status NOT IN ('pending', 'accepted', 'picking_up', 'picked_up') THEN
    RETURN json_build_object('success', false, 'error', 'Esta entrega não pode ser cancelada');
  END IF;

  v_restaurant_id := v_delivery.restaurant_id;
  v_driver_id := v_delivery.driver_id;
  v_total_amount := v_delivery.price_adjusted;
  v_is_additional := COALESCE(v_delivery.is_additional_delivery, false);

  -- Different rules for additional deliveries
  IF v_is_additional THEN
    -- Additional delivery cancellation rules
    IF v_delivery.status IN ('pending', 'accepted', 'picking_up') THEN
      -- Before pickup: 100% refund
      v_penalty_rate := 0;
      v_penalty_amount := 0;
      v_refund_amount := v_total_amount;
    ELSE
      -- After pickup (picked_up): NO refund
      v_penalty_rate := 1.0;
      v_penalty_amount := v_total_amount;
      v_refund_amount := 0;
      -- 80% to driver, 20% to platform (same as delivery completion)
      v_driver_penalty_share := ROUND(v_penalty_amount * 0.80, 2);
      v_platform_penalty_share := v_penalty_amount - v_driver_penalty_share;
    END IF;
  ELSE
    -- Main delivery cancellation rules (original logic)
    CASE v_delivery.status
      WHEN 'pending' THEN
        v_penalty_rate := 0;
        v_penalty_amount := 0;
        v_refund_amount := v_total_amount;
        
      WHEN 'accepted' THEN
        v_penalty_rate := 0.15;
        v_penalty_amount := ROUND(v_total_amount * v_penalty_rate, 2);
        v_refund_amount := v_total_amount - v_penalty_amount;
        v_driver_penalty_share := v_penalty_amount;
        v_platform_penalty_share := 0;
        
      WHEN 'picking_up' THEN
        v_penalty_rate := 0.25;
        v_penalty_amount := ROUND(v_total_amount * v_penalty_rate, 2);
        v_refund_amount := v_total_amount - v_penalty_amount;
        v_driver_penalty_share := ROUND(v_penalty_amount * 0.80, 2);
        v_platform_penalty_share := v_penalty_amount - v_driver_penalty_share;
        
      WHEN 'picked_up' THEN
        v_penalty_rate := 0.75;
        v_penalty_amount := ROUND(v_total_amount * v_penalty_rate, 2);
        v_refund_amount := v_total_amount - v_penalty_amount;
        v_driver_penalty_share := ROUND(v_penalty_amount * 0.70, 2);
        v_platform_penalty_share := v_penalty_amount - v_driver_penalty_share;
    END CASE;
    
    -- If this is the main delivery, cancel all additional deliveries
    FOR v_child_delivery IN 
      SELECT id FROM deliveries 
      WHERE parent_delivery_id = p_delivery_id 
        AND status NOT IN ('delivered', 'cancelled')
    LOOP
      -- Recursively cancel child deliveries
      SELECT refund_delivery_funds(v_child_delivery.id, 'Cancelamento automático: entrega principal cancelada') 
      INTO v_child_result;
    END LOOP;
  END IF;

  -- Refund remaining amount to restaurant's wallet (if any)
  IF v_refund_amount > 0 THEN
    UPDATE restaurants
    SET wallet_balance = wallet_balance + v_refund_amount,
        blocked_balance = blocked_balance - v_total_amount,
        updated_at = now()
    WHERE id = v_restaurant_id;
  ELSE
    -- Just release from blocked if no refund
    UPDATE restaurants
    SET blocked_balance = blocked_balance - v_total_amount,
        updated_at = now()
    WHERE id = v_restaurant_id;
  END IF;

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
      'escrow_refund', 
      CASE WHEN v_is_additional 
        THEN 'Cancelamento entrega adicional após coleta - pagamento mantido'
        ELSE 'Multa por cancelamento - parte entregador'
      END,
      v_driver_penalty_share, v_platform_penalty_share
    );
  END IF;

  -- Record platform fee if any
  IF v_platform_penalty_share > 0 THEN
    INSERT INTO platform_fees (delivery_id, amount)
    VALUES (p_delivery_id, v_platform_penalty_share);
  END IF;

  -- Record refund transaction (if any refund)
  IF v_refund_amount > 0 THEN
    INSERT INTO transactions (
      delivery_id, restaurant_id, amount, type, description
    ) VALUES (
      p_delivery_id, v_restaurant_id, v_refund_amount,
      'escrow_refund', 'Estorno por cancelamento'
    );
  END IF;

  -- Update delivery status with reason
  UPDATE deliveries
  SET status = 'cancelled',
      cancelled_at = now(),
      financial_status = 'refunded',
      cancellation_reason = COALESCE(p_cancellation_reason, 'Cancelado pelo solicitante'),
      updated_at = now()
  WHERE id = p_delivery_id;

  RETURN json_build_object(
    'success', true,
    'refunded_amount', v_refund_amount,
    'penalty_amount', v_penalty_amount,
    'penalty_rate', v_penalty_rate,
    'driver_share', v_driver_penalty_share,
    'platform_share', v_platform_penalty_share,
    'total_amount', v_total_amount,
    'is_additional', v_is_additional
  );
END;
$$;

-- Update calculate_cancellation_penalty to handle batch deliveries
CREATE OR REPLACE FUNCTION public.calculate_cancellation_penalty(p_delivery_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  v_is_additional boolean;
  v_child_count integer := 0;
BEGIN
  -- Get delivery details
  SELECT d.*, d.price_adjusted, d.status, d.is_additional_delivery, d.parent_delivery_id
  INTO v_delivery
  FROM deliveries d
  WHERE d.id = p_delivery_id;

  IF v_delivery IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Entrega não encontrada');
  END IF;

  v_total_amount := v_delivery.price_adjusted;
  v_is_additional := COALESCE(v_delivery.is_additional_delivery, false);

  -- Block cancellation if in final route
  IF v_delivery.status = 'delivering' THEN
    RETURN json_build_object(
      'success', true,
      'can_cancel', false,
      'message', 'Não é possível cancelar uma entrega em rota final',
      'status', v_delivery.status
    );
  END IF;

  -- Count child deliveries if this is main delivery
  IF NOT v_is_additional THEN
    SELECT COUNT(*) INTO v_child_count
    FROM deliveries
    WHERE parent_delivery_id = p_delivery_id
      AND status NOT IN ('delivered', 'cancelled');
  END IF;

  -- Calculate penalty based on delivery type and status
  IF v_is_additional THEN
    -- Additional delivery rules
    CASE v_delivery.status
      WHEN 'pending', 'accepted', 'picking_up' THEN
        v_penalty_rate := 0;
        v_penalty_amount := 0;
        v_refund_amount := v_total_amount;
        v_cancel_message := 'Cancelamento com estorno de 100% (antes da coleta)';
        
      WHEN 'picked_up' THEN
        v_penalty_rate := 1.0;
        v_penalty_amount := v_total_amount;
        v_refund_amount := 0;
        v_driver_penalty_share := ROUND(v_penalty_amount * 0.80, 2);
        v_platform_penalty_share := v_penalty_amount - v_driver_penalty_share;
        v_cancel_message := 'Sem estorno (após coleta) - valor vai para entregador';
        
      ELSE
        v_can_cancel := false;
        v_cancel_message := 'Esta entrega não pode ser cancelada';
    END CASE;
  ELSE
    -- Main delivery rules
    CASE v_delivery.status
      WHEN 'pending' THEN
        v_penalty_rate := 0;
        v_penalty_amount := 0;
        v_refund_amount := v_total_amount;
        v_cancel_message := 'Cancelamento sem multa';
        IF v_child_count > 0 THEN
          v_cancel_message := v_cancel_message || ' (' || v_child_count || ' entrega(s) adicional(is) também será(ão) cancelada(s))';
        END IF;
        
      WHEN 'accepted' THEN
        v_penalty_rate := 0.15;
        v_penalty_amount := ROUND(v_total_amount * v_penalty_rate, 2);
        v_refund_amount := v_total_amount - v_penalty_amount;
        v_driver_penalty_share := v_penalty_amount;
        v_cancel_message := 'Multa de 15% aplicada (entregador já aceitou)';
        IF v_child_count > 0 THEN
          v_cancel_message := v_cancel_message || ' - ' || v_child_count || ' entrega(s) adicional(is) também será(ão) cancelada(s)';
        END IF;
        
      WHEN 'picking_up' THEN
        v_penalty_rate := 0.25;
        v_penalty_amount := ROUND(v_total_amount * v_penalty_rate, 2);
        v_refund_amount := v_total_amount - v_penalty_amount;
        v_driver_penalty_share := ROUND(v_penalty_amount * 0.80, 2);
        v_platform_penalty_share := v_penalty_amount - v_driver_penalty_share;
        v_cancel_message := 'Multa de 25% aplicada (entregador em deslocamento)';
        IF v_child_count > 0 THEN
          v_cancel_message := v_cancel_message || ' - ' || v_child_count || ' entrega(s) adicional(is) também será(ão) cancelada(s)';
        END IF;
        
      WHEN 'picked_up' THEN
        v_penalty_rate := 0.75;
        v_penalty_amount := ROUND(v_total_amount * v_penalty_rate, 2);
        v_refund_amount := v_total_amount - v_penalty_amount;
        v_driver_penalty_share := ROUND(v_penalty_amount * 0.70, 2);
        v_platform_penalty_share := v_penalty_amount - v_driver_penalty_share;
        v_cancel_message := 'Multa de 75% aplicada (coleta já iniciada)';
        IF v_child_count > 0 THEN
          v_cancel_message := v_cancel_message || ' - ' || v_child_count || ' entrega(s) adicional(is) também será(ão) cancelada(s)';
        END IF;
        
      ELSE
        v_can_cancel := false;
        v_cancel_message := 'Esta entrega não pode ser cancelada';
    END CASE;
  END IF;

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
    'status', v_delivery.status,
    'is_additional', v_is_additional,
    'child_deliveries_count', v_child_count
  );
END;
$$;