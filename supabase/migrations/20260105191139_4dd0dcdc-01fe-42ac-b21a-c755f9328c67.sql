-- Create table for batch delivery settings per vehicle type
CREATE TABLE public.batch_delivery_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_type public.vehicle_type NOT NULL UNIQUE,
  max_deliveries INTEGER NOT NULL DEFAULT 5,
  time_window_minutes INTEGER NOT NULL DEFAULT 15,
  additional_delivery_base_price NUMERIC NOT NULL DEFAULT 2.00,
  additional_delivery_price_per_km NUMERIC NOT NULL DEFAULT 1.50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default settings for each vehicle type
INSERT INTO public.batch_delivery_settings (vehicle_type, max_deliveries, time_window_minutes, additional_delivery_base_price, additional_delivery_price_per_km)
VALUES 
  ('motorcycle', 5, 15, 2.00, 1.50),
  ('bicycle', 3, 20, 1.50, 1.00),
  ('car', 8, 15, 3.00, 2.00),
  ('van', 15, 20, 3.50, 2.50),
  ('truck', 20, 30, 5.00, 3.00),
  ('hourly_service', 10, 60, 2.00, 1.50);

-- Add columns to deliveries table for batch tracking
ALTER TABLE public.deliveries 
ADD COLUMN is_additional_delivery BOOLEAN DEFAULT false,
ADD COLUMN parent_delivery_id UUID REFERENCES public.deliveries(id);

-- Enable RLS on batch_delivery_settings
ALTER TABLE public.batch_delivery_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for batch_delivery_settings
CREATE POLICY "Anyone can view active batch settings" 
ON public.batch_delivery_settings 
FOR SELECT 
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage batch settings" 
ON public.batch_delivery_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to check if a driver is available for additional deliveries
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
    RETURN json_build_object('available', false, 'reason', 'Driver not found');
  END IF;
  
  -- Get active delivery for this driver at this restaurant that is in picking_up status
  SELECT d.* INTO v_active_delivery 
  FROM deliveries d
  WHERE d.driver_id = p_driver_id 
    AND d.restaurant_id = p_restaurant_id
    AND d.status = 'picking_up'
    AND d.picked_up_at IS NULL
  ORDER BY d.accepted_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN json_build_object('available', false, 'reason', 'No active pickup at this location');
  END IF;
  
  -- Get batch settings for this vehicle type
  SELECT * INTO v_settings 
  FROM batch_delivery_settings 
  WHERE vehicle_type = v_driver.vehicle_type AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('available', false, 'reason', 'Batch settings not configured');
  END IF;
  
  -- Check time window
  v_time_elapsed := now() - COALESCE(v_active_delivery.accepted_at, v_active_delivery.created_at);
  
  IF v_time_elapsed > (v_settings.time_window_minutes || ' minutes')::interval THEN
    RETURN json_build_object(
      'available', false, 
      'reason', 'Time window expired',
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
      'reason', 'Maximum deliveries reached',
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

-- Function to calculate price for additional delivery
CREATE OR REPLACE FUNCTION public.calculate_additional_delivery_price(
  p_vehicle_type public.vehicle_type,
  p_distance_km NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings RECORD;
  v_price NUMERIC;
BEGIN
  SELECT * INTO v_settings 
  FROM batch_delivery_settings 
  WHERE vehicle_type = p_vehicle_type AND is_active = true;
  
  IF NOT FOUND THEN
    -- Fallback to default calculation
    RETURN p_distance_km * 2.50;
  END IF;
  
  v_price := v_settings.additional_delivery_base_price + (p_distance_km * v_settings.additional_delivery_price_per_km);
  
  RETURN ROUND(v_price, 2);
END;
$$;