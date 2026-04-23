CREATE TABLE public.delivery_confirmation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  max_distance_meters integer NOT NULL DEFAULT 100,
  allow_outside_radius boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO public.delivery_confirmation_settings (max_distance_meters, allow_outside_radius, is_active)
SELECT 100, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_confirmation_settings WHERE is_active = true);

ALTER TABLE public.delivery_confirmation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage delivery confirmation settings"
ON public.delivery_confirmation_settings
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Authenticated users can view active delivery confirmation settings"
ON public.delivery_confirmation_settings
FOR SELECT
TO authenticated
USING (is_active = true);

CREATE TRIGGER update_delivery_confirmation_settings_updated_at
BEFORE UPDATE ON public.delivery_confirmation_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.delivery_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL,
  driver_id uuid NOT NULL,
  photo_url text NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  distance_meters numeric,
  is_within_radius boolean,
  max_distance_meters integer NOT NULL DEFAULT 100,
  outside_radius_allowed boolean NOT NULL DEFAULT false,
  confirmed_at timestamp with time zone NOT NULL DEFAULT now(),
  confirmation_method text NOT NULL DEFAULT 'photo_geo',
  otp_code_hash text,
  otp_verified_at timestamp with time zone,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT delivery_confirmations_method_check CHECK (confirmation_method IN ('photo_geo', 'photo_geo_otp')),
  CONSTRAINT delivery_confirmations_unique_delivery UNIQUE (delivery_id)
);

ALTER TABLE public.delivery_confirmations ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_delivery_confirmations_delivery_id ON public.delivery_confirmations (delivery_id);
CREATE INDEX idx_delivery_confirmations_driver_id ON public.delivery_confirmations (driver_id);

CREATE POLICY "Drivers can create confirmation for their deliveries"
ON public.delivery_confirmations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.drivers d
    JOIN public.deliveries del ON del.driver_id = d.id
    WHERE d.id = delivery_confirmations.driver_id
      AND d.user_id = auth.uid()
      AND del.id = delivery_confirmations.delivery_id
      AND del.driver_id = delivery_confirmations.driver_id
  )
);

CREATE POLICY "Drivers can view own delivery confirmations"
ON public.delivery_confirmations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.drivers d
    WHERE d.id = delivery_confirmations.driver_id
      AND d.user_id = auth.uid()
  )
);

CREATE POLICY "Restaurants can view own delivery confirmations"
ON public.delivery_confirmations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.deliveries del
    JOIN public.restaurants r ON r.id = del.restaurant_id
    WHERE del.id = delivery_confirmations.delivery_id
      AND r.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all delivery confirmations"
ON public.delivery_confirmations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.calculate_distance_meters(lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 6371000 * 2 * asin(
    sqrt(
      power(sin(radians(($3 - $1) / 2)), 2) +
      cos(radians($1)) * cos(radians($3)) * power(sin(radians(($4 - $2) / 2)), 2)
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.finalize_delivery_transaction(
  p_delivery_id uuid,
  p_driver_id uuid,
  p_confirmation_photo_url text DEFAULT NULL,
  p_confirmation_latitude numeric DEFAULT NULL,
  p_confirmation_longitude numeric DEFAULT NULL,
  p_outside_radius_allowed boolean DEFAULT false,
  p_confirmation_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  v_settings RECORD;
  v_distance_meters numeric;
  v_is_within_radius boolean;
BEGIN
  IF p_confirmation_photo_url IS NULL OR length(trim(p_confirmation_photo_url)) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Foto de confirmação obrigatória');
  END IF;

  IF p_confirmation_latitude IS NULL OR p_confirmation_longitude IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Localização de confirmação obrigatória');
  END IF;

  SELECT * INTO v_settings
  FROM delivery_confirmation_settings
  WHERE is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT 100 AS max_distance_meters, true AS allow_outside_radius INTO v_settings;
  END IF;

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

  v_distance_meters := public.calculate_distance_meters(
    p_confirmation_latitude,
    p_confirmation_longitude,
    v_delivery.delivery_latitude,
    v_delivery.delivery_longitude
  );
  v_is_within_radius := v_distance_meters <= v_settings.max_distance_meters;

  IF NOT v_is_within_radius AND NOT v_settings.allow_outside_radius AND NOT p_outside_radius_allowed THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Localização fora do raio permitido',
      'distance_meters', round(v_distance_meters, 2),
      'max_distance_meters', v_settings.max_distance_meters,
      'allow_outside_radius', v_settings.allow_outside_radius
    );
  END IF;
  
  v_actual_price := CASE 
    WHEN v_delivery.price_adjusted > 0 THEN v_delivery.price_adjusted 
    ELSE v_delivery.price 
  END;
  
  v_parent_id := COALESCE(v_delivery.parent_delivery_id, v_delivery.id);
  v_platform_fee := v_actual_price * 0.20;
  v_driver_earnings := v_actual_price * 0.80;
  
  SELECT blocked_balance INTO v_restaurant_blocked
  FROM restaurants
  WHERE id = v_delivery.restaurant_id
  FOR UPDATE;
  
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
  
  UPDATE restaurants
  SET blocked_balance = blocked_balance - v_actual_price
  WHERE id = v_delivery.restaurant_id;
  
  UPDATE deliveries
  SET status = 'delivered',
      financial_status = 'transferring',
      delivered_at = now(),
      delivery_photo_url = p_confirmation_photo_url,
      price_adjusted = v_actual_price
  WHERE id = p_delivery_id;

  INSERT INTO delivery_confirmations (
    delivery_id,
    driver_id,
    photo_url,
    latitude,
    longitude,
    distance_meters,
    is_within_radius,
    max_distance_meters,
    outside_radius_allowed,
    confirmation_method,
    metadata
  ) VALUES (
    p_delivery_id,
    p_driver_id,
    p_confirmation_photo_url,
    p_confirmation_latitude,
    p_confirmation_longitude,
    round(v_distance_meters, 2),
    v_is_within_radius,
    v_settings.max_distance_meters,
    (NOT v_is_within_radius AND (v_settings.allow_outside_radius OR p_outside_radius_allowed)),
    'photo_geo',
    COALESCE(p_confirmation_metadata, '{}'::jsonb)
  ) ON CONFLICT (delivery_id) DO UPDATE SET
    photo_url = EXCLUDED.photo_url,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    distance_meters = EXCLUDED.distance_meters,
    is_within_radius = EXCLUDED.is_within_radius,
    max_distance_meters = EXCLUDED.max_distance_meters,
    outside_radius_allowed = EXCLUDED.outside_radius_allowed,
    metadata = EXCLUDED.metadata;
  
  INSERT INTO platform_fees (delivery_id, amount)
  VALUES (p_delivery_id, v_platform_fee);
  
  INSERT INTO transactions (delivery_id, restaurant_id, driver_id, amount, driver_earnings, platform_fee, type, description)
  VALUES (p_delivery_id, v_delivery.restaurant_id, NULL, -v_actual_price, NULL, NULL, 'escrow_release', 'Liberação do escrow');
  
  INSERT INTO transactions (delivery_id, restaurant_id, driver_id, amount, driver_earnings, platform_fee, type, description)
  VALUES (p_delivery_id, NULL, NULL, v_platform_fee, NULL, v_platform_fee, 'platform_fee', 'Taxa da plataforma (20%)');
  
  SELECT COUNT(*) INTO v_remaining_deliveries
  FROM deliveries
  WHERE (id = v_parent_id OR parent_delivery_id = v_parent_id)
    AND driver_id = p_driver_id
    AND status IN ('accepted', 'picking_up', 'picked_up', 'delivering');
  
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
        
        UPDATE deliveries
        SET financial_status = 'paid'
        WHERE id = v_route_delivery.id;
        
        INSERT INTO transactions (delivery_id, restaurant_id, driver_id, amount, driver_earnings, platform_fee, type, description)
        VALUES (v_route_delivery.id, NULL, p_driver_id, v_route_actual_price * 0.80, v_route_actual_price * 0.80, NULL, 'delivery_payment', 'Pagamento de entrega (80%)');
      END;
    END LOOP;
    
    SELECT pending_balance, earnings_balance INTO v_driver_pending, v_driver_available
    FROM drivers
    WHERE id = p_driver_id
    FOR UPDATE;
    
    UPDATE drivers
    SET earnings_balance = earnings_balance + v_total_route_earnings,
        total_deliveries = COALESCE(total_deliveries, 0) + 1
    WHERE id = p_driver_id;
    
    SELECT earnings_balance INTO v_driver_available
    FROM drivers
    WHERE id = p_driver_id;
  ELSE
    UPDATE drivers
    SET total_deliveries = COALESCE(total_deliveries, 0) + 1
    WHERE id = p_driver_id;
    
    SELECT earnings_balance INTO v_driver_available
    FROM drivers
    WHERE id = p_driver_id;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'delivery_id', p_delivery_id,
    'total_amount', v_actual_price,
    'driver_earnings', v_driver_earnings,
    'platform_fee', v_platform_fee,
    'is_last_delivery', v_is_last_delivery,
    'total_route_earnings', v_total_route_earnings,
    'driver_balance_after', v_driver_available,
    'confirmation', json_build_object(
      'photo_url', p_confirmation_photo_url,
      'latitude', p_confirmation_latitude,
      'longitude', p_confirmation_longitude,
      'distance_meters', round(v_distance_meters, 2),
      'is_within_radius', v_is_within_radius,
      'max_distance_meters', v_settings.max_distance_meters,
      'outside_radius_allowed', (NOT v_is_within_radius AND (v_settings.allow_outside_radius OR p_outside_radius_allowed))
    )
  );
END;
$function$;