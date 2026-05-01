-- Update check_driver_available_for_batch to also check for 'accepted' status
-- This allows adding deliveries when driver is on the way to pickup, not just at the pickup location

CREATE OR REPLACE FUNCTION public.check_driver_available_for_batch(
  p_driver_id UUID,
  p_restaurant_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver RECORD;
  v_active_delivery RECORD;
  v_settings RECORD;
  v_current_count INTEGER;
  v_time_elapsed INTERVAL;
BEGIN
  -- Get driver info
  SELECT * INTO v_driver FROM drivers WHERE id = p_driver_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('available', false, 'reason', 'Entregador não encontrado');
  END IF;
  
  -- Get active delivery for this driver at this restaurant that is in accepted or picking_up status
  SELECT d.* INTO v_active_delivery 
  FROM deliveries d
  WHERE d.driver_id = p_driver_id 
    AND d.restaurant_id = p_restaurant_id
    AND d.status IN ('accepted', 'picking_up')
    AND d.picked_up_at IS NULL
  ORDER BY d.accepted_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN json_build_object('available', false, 'reason', 'Nenhuma coleta ativa neste local');
  END IF;
  
  -- Get batch settings for this vehicle type
  SELECT * INTO v_settings 
  FROM batch_delivery_settings 
  WHERE vehicle_type = v_driver.vehicle_type AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('available', false, 'reason', 'Configurações de lote não encontradas');
  END IF;
  
  -- Check time window
  v_time_elapsed := now() - COALESCE(v_active_delivery.accepted_at, v_active_delivery.created_at);
  
  IF v_time_elapsed > (v_settings.time_window_minutes || ' minutes')::interval THEN
    RETURN json_build_object(
      'available', false, 
      'reason', 'Janela de tempo expirada',
      'time_elapsed_minutes', EXTRACT(EPOCH FROM v_time_elapsed) / 60
    );
  END IF;
  
  -- Count current deliveries for this driver in active status
  SELECT COUNT(*) INTO v_current_count
  FROM deliveries
  WHERE driver_id = p_driver_id 
    AND status IN ('accepted', 'picking_up', 'picked_up', 'delivering');
  
  IF v_current_count >= v_settings.max_deliveries THEN
    RETURN json_build_object(
      'available', false, 
      'reason', 'Limite máximo de entregas atingido',
      'current_count', v_current_count,
      'max_count', v_settings.max_deliveries
    );
  END IF;
  
  -- Driver is available for additional delivery
  RETURN json_build_object(
    'available', true,
    'driver_id', p_driver_id,
    'parent_delivery_id', v_active_delivery.id,
    'current_count', v_current_count,
    'max_count', v_settings.max_deliveries,
    'time_remaining_minutes', v_settings.time_window_minutes - (EXTRACT(EPOCH FROM v_time_elapsed) / 60),
    'base_price', v_settings.additional_delivery_base_price,
    'price_per_km', v_settings.additional_delivery_price_per_km
  );
END;
$$;