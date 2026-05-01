-- Update finalize_delivery_transaction to only pay driver when ALL route deliveries are complete
CREATE OR REPLACE FUNCTION public.finalize_delivery_transaction(p_delivery_id uuid, p_driver_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
BEGIN
  -- Lock delivery
  SELECT * INTO v_delivery
  FROM deliveries
  WHERE id = p_delivery_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Entrega não encontrada');
  END IF;
  
  IF v_delivery.status != 'picked_up' THEN
    RETURN json_build_object('success', false, 'error', 'Entrega não está no status correto');
  END IF;
  
  IF v_delivery.driver_id != p_driver_id THEN
    RETURN json_build_object('success', false, 'error', 'Entrega não atribuída a este motorista');
  END IF;
  
  IF v_delivery.financial_status != 'blocked' THEN
    RETURN json_build_object('success', false, 'error', 'Fundos não estão bloqueados');
  END IF;
  
  -- Determine parent_id for route grouping
  v_parent_id := COALESCE(v_delivery.parent_delivery_id, v_delivery.id);
  
  -- Calculate split for this delivery
  v_platform_fee := v_delivery.price_adjusted * 0.20;
  v_driver_earnings := v_delivery.price_adjusted * 0.80;
  
  -- Lock restaurant and deduct from blocked
  SELECT blocked_balance INTO v_restaurant_blocked
  FROM restaurants
  WHERE id = v_delivery.restaurant_id
  FOR UPDATE;
  
  IF v_restaurant_blocked < v_delivery.price_adjusted THEN
    RETURN json_build_object('success', false, 'error', 'Saldo bloqueado insuficiente');
  END IF;
  
  UPDATE restaurants
  SET blocked_balance = blocked_balance - v_delivery.price_adjusted
  WHERE id = v_delivery.restaurant_id;
  
  -- Update delivery status to delivered with financial_status as 'transferring'
  UPDATE deliveries
  SET status = 'delivered',
      financial_status = 'transferring',
      delivered_at = now()
  WHERE id = p_delivery_id;
  
  -- Record platform fee for this delivery
  INSERT INTO platform_fees (delivery_id, amount)
  VALUES (p_delivery_id, v_platform_fee);
  
  -- Record escrow release transaction
  INSERT INTO transactions (delivery_id, restaurant_id, driver_id, amount, driver_earnings, platform_fee, type, description)
  VALUES (p_delivery_id, v_delivery.restaurant_id, NULL, -v_delivery.price_adjusted, NULL, NULL, 'escrow_release', 'Liberação do escrow');
  
  -- Record platform fee transaction
  INSERT INTO transactions (delivery_id, restaurant_id, driver_id, amount, driver_earnings, platform_fee, type, description)
  VALUES (p_delivery_id, NULL, NULL, v_platform_fee, NULL, v_platform_fee, 'platform_fee', 'Taxa da plataforma (20%)');
  
  -- Check if there are remaining deliveries in this route
  SELECT COUNT(*) INTO v_remaining_deliveries
  FROM deliveries
  WHERE (id = v_parent_id OR parent_delivery_id = v_parent_id)
    AND driver_id = p_driver_id
    AND status IN ('accepted', 'picking_up', 'picked_up', 'delivering');
  
  -- If this is the last delivery, pay the driver for ALL route deliveries
  IF v_remaining_deliveries = 0 THEN
    v_is_last_delivery := true;
    
    -- Calculate total earnings from all delivered route deliveries
    FOR v_route_delivery IN 
      SELECT id, price_adjusted
      FROM deliveries
      WHERE (id = v_parent_id OR parent_delivery_id = v_parent_id)
        AND driver_id = p_driver_id
        AND status = 'delivered'
        AND financial_status = 'transferring'
    LOOP
      v_total_route_earnings := v_total_route_earnings + (v_route_delivery.price_adjusted * 0.80);
      v_total_route_fees := v_total_route_fees + (v_route_delivery.price_adjusted * 0.20);
      
      -- Update financial status to paid
      UPDATE deliveries
      SET financial_status = 'paid'
      WHERE id = v_route_delivery.id;
      
      -- Record driver payment transaction for each delivery
      INSERT INTO transactions (delivery_id, restaurant_id, driver_id, amount, driver_earnings, platform_fee, type, description)
      VALUES (v_route_delivery.id, NULL, p_driver_id, v_route_delivery.price_adjusted * 0.80, v_route_delivery.price_adjusted * 0.80, NULL, 'delivery_payment', 'Pagamento de entrega (80%)');
    END LOOP;
    
    -- Lock driver and credit total earnings
    SELECT pending_balance, earnings_balance INTO v_driver_pending, v_driver_available
    FROM drivers
    WHERE id = p_driver_id
    FOR UPDATE;
    
    UPDATE drivers
    SET earnings_balance = earnings_balance + v_total_route_earnings,
        total_deliveries = COALESCE(total_deliveries, 0) + 1
    WHERE id = p_driver_id;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'delivery_id', p_delivery_id,
    'total_amount', v_delivery.price_adjusted,
    'driver_earnings', v_driver_earnings,
    'platform_fee', v_platform_fee,
    'is_last_delivery', v_is_last_delivery,
    'total_route_earnings', v_total_route_earnings,
    'driver_balance_after', CASE WHEN v_is_last_delivery THEN v_driver_available + v_total_route_earnings ELSE v_driver_available END
  );
END;
$$;

-- Function to calculate route totals for driver display
CREATE OR REPLACE FUNCTION public.get_route_financial_summary(p_driver_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_gross numeric := 0;
  v_total_net numeric := 0;
  v_total_platform_fee numeric := 0;
  v_delivery_count integer := 0;
  v_completed_count integer := 0;
  v_delivery RECORD;
BEGIN
  -- Get all active route deliveries for this driver
  FOR v_delivery IN 
    SELECT id, price_adjusted, status
    FROM deliveries
    WHERE driver_id = p_driver_id
      AND status IN ('accepted', 'picking_up', 'picked_up', 'delivering', 'delivered')
      AND (delivered_at IS NULL OR delivered_at > now() - interval '1 hour')
    ORDER BY delivery_sequence ASC
  LOOP
    v_total_gross := v_total_gross + v_delivery.price_adjusted;
    v_total_net := v_total_net + (v_delivery.price_adjusted * 0.80);
    v_total_platform_fee := v_total_platform_fee + (v_delivery.price_adjusted * 0.20);
    v_delivery_count := v_delivery_count + 1;
    
    IF v_delivery.status = 'delivered' THEN
      v_completed_count := v_completed_count + 1;
    END IF;
  END LOOP;
  
  RETURN json_build_object(
    'total_gross', v_total_gross,
    'total_net', v_total_net,
    'total_platform_fee', v_total_platform_fee,
    'delivery_count', v_delivery_count,
    'completed_count', v_completed_count,
    'pending_payment', v_delivery_count > v_completed_count
  );
END;
$$;