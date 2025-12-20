-- Create financial status enum
CREATE TYPE public.financial_status AS ENUM ('blocked', 'refunded', 'transferring', 'paid');

-- Add blocked_balance to restaurants
ALTER TABLE public.restaurants 
ADD COLUMN blocked_balance numeric NOT NULL DEFAULT 0.00;

-- Add pending_balance to drivers (balance waiting to be released)
ALTER TABLE public.drivers 
ADD COLUMN pending_balance numeric NOT NULL DEFAULT 0.00;

-- Add financial_status to deliveries
ALTER TABLE public.deliveries 
ADD COLUMN financial_status public.financial_status DEFAULT NULL;

-- Create platform fees tracking table
CREATE TABLE public.platform_fees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  delivery_id uuid REFERENCES public.deliveries(id),
  amount numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on platform_fees
ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;

-- Only admins can view platform fees
CREATE POLICY "Admins can view all platform fees" 
ON public.platform_fees 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add index for performance
CREATE INDEX idx_platform_fees_created_at ON public.platform_fees(created_at DESC);
CREATE INDEX idx_deliveries_financial_status ON public.deliveries(financial_status);

-- Update transaction_type enum to include escrow operations
ALTER TYPE public.transaction_type ADD VALUE 'escrow_block';
ALTER TYPE public.transaction_type ADD VALUE 'escrow_release';
ALTER TYPE public.transaction_type ADD VALUE 'escrow_refund';

-- Function to block funds when creating delivery
CREATE OR REPLACE FUNCTION public.block_delivery_funds(
  p_restaurant_id uuid,
  p_delivery_id uuid,
  p_amount numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_available_balance numeric;
  v_new_available numeric;
  v_new_blocked numeric;
BEGIN
  -- Lock restaurant row
  SELECT wallet_balance, blocked_balance INTO v_available_balance, v_new_blocked
  FROM restaurants
  WHERE id = p_restaurant_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Restaurante não encontrado');
  END IF;
  
  -- Check sufficient funds
  IF v_available_balance < p_amount THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Saldo insuficiente',
      'available', v_available_balance,
      'required', p_amount
    );
  END IF;
  
  -- Move from available to blocked
  v_new_available := v_available_balance - p_amount;
  v_new_blocked := v_new_blocked + p_amount;
  
  UPDATE restaurants
  SET wallet_balance = v_new_available,
      blocked_balance = v_new_blocked
  WHERE id = p_restaurant_id;
  
  -- Update delivery financial status
  UPDATE deliveries
  SET financial_status = 'blocked'
  WHERE id = p_delivery_id;
  
  -- Record transaction
  INSERT INTO transactions (
    delivery_id, restaurant_id, amount, type, description
  ) VALUES (
    p_delivery_id, p_restaurant_id, -p_amount, 'escrow_block', 
    'Valor bloqueado para entrega'
  );
  
  RETURN json_build_object(
    'success', true,
    'available_balance', v_new_available,
    'blocked_balance', v_new_blocked
  );
END;
$$;

-- Function to refund blocked funds on cancellation
CREATE OR REPLACE FUNCTION public.refund_delivery_funds(
  p_delivery_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_delivery RECORD;
  v_current_blocked numeric;
  v_current_available numeric;
BEGIN
  -- Lock delivery
  SELECT * INTO v_delivery
  FROM deliveries
  WHERE id = p_delivery_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Entrega não encontrada');
  END IF;
  
  -- Check if can be refunded (before pickup started)
  IF v_delivery.status NOT IN ('pending', 'accepted') THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Não é possível estornar após início da coleta'
    );
  END IF;
  
  IF v_delivery.financial_status != 'blocked' THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Fundos não estão bloqueados para esta entrega'
    );
  END IF;
  
  -- Lock restaurant
  SELECT wallet_balance, blocked_balance INTO v_current_available, v_current_blocked
  FROM restaurants
  WHERE id = v_delivery.restaurant_id
  FOR UPDATE;
  
  -- Move from blocked back to available
  UPDATE restaurants
  SET wallet_balance = v_current_available + v_delivery.price_adjusted,
      blocked_balance = v_current_blocked - v_delivery.price_adjusted
  WHERE id = v_delivery.restaurant_id;
  
  -- Update delivery status
  UPDATE deliveries
  SET status = 'cancelled',
      financial_status = 'refunded',
      cancelled_at = now()
  WHERE id = p_delivery_id;
  
  -- Record refund transaction
  INSERT INTO transactions (
    delivery_id, restaurant_id, amount, type, description
  ) VALUES (
    p_delivery_id, v_delivery.restaurant_id, v_delivery.price_adjusted, 'escrow_refund',
    'Estorno por cancelamento de entrega'
  );
  
  RETURN json_build_object(
    'success', true,
    'refunded_amount', v_delivery.price_adjusted,
    'new_available_balance', v_current_available + v_delivery.price_adjusted
  );
END;
$$;

-- Updated function to finalize delivery with escrow release
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
  
  -- Calculate split
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
  
  -- Lock driver and credit earnings
  SELECT pending_balance, earnings_balance INTO v_driver_pending, v_driver_available
  FROM drivers
  WHERE id = p_driver_id
  FOR UPDATE;
  
  UPDATE drivers
  SET earnings_balance = earnings_balance + v_driver_earnings,
      total_deliveries = COALESCE(total_deliveries, 0) + 1
  WHERE id = p_driver_id;
  
  -- Update delivery status
  UPDATE deliveries
  SET status = 'delivered',
      financial_status = 'paid',
      delivered_at = now()
  WHERE id = p_delivery_id;
  
  -- Record platform fee
  INSERT INTO platform_fees (delivery_id, amount)
  VALUES (p_delivery_id, v_platform_fee);
  
  -- Record transactions
  INSERT INTO transactions (delivery_id, restaurant_id, driver_id, amount, driver_earnings, platform_fee, type, description)
  VALUES 
    (p_delivery_id, v_delivery.restaurant_id, NULL, -v_delivery.price_adjusted, NULL, NULL, 'escrow_release', 'Liberação do escrow'),
    (p_delivery_id, NULL, p_driver_id, v_driver_earnings, v_driver_earnings, NULL, 'delivery_payment', 'Pagamento de entrega (80%)'),
    (p_delivery_id, NULL, NULL, v_platform_fee, NULL, v_platform_fee, 'platform_fee', 'Taxa da plataforma (20%)');
  
  RETURN json_build_object(
    'success', true,
    'delivery_id', p_delivery_id,
    'total_amount', v_delivery.price_adjusted,
    'driver_earnings', v_driver_earnings,
    'platform_fee', v_platform_fee,
    'driver_balance_after', v_driver_available + v_driver_earnings
  );
END;
$$;