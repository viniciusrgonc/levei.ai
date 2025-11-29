-- Função atômica para finalizar entrega com lógica 80/20
CREATE OR REPLACE FUNCTION public.finalize_delivery_transaction(
  p_delivery_id UUID,
  p_driver_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_delivery RECORD;
  v_restaurant_balance NUMERIC;
  v_driver_balance NUMERIC;
  v_platform_fee NUMERIC;
  v_driver_earnings NUMERIC;
  v_new_restaurant_balance NUMERIC;
  v_new_driver_balance NUMERIC;
BEGIN
  -- Bloquear a entrega para evitar race conditions
  SELECT * INTO v_delivery
  FROM deliveries
  WHERE id = p_delivery_id
  FOR UPDATE;
  
  -- Verificar se a entrega existe
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Entrega não encontrada'
    );
  END IF;
  
  -- Verificar se está no status correto
  IF v_delivery.status != 'picked_up' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Entrega não está no status correto para conclusão'
    );
  END IF;
  
  -- Verificar se o motorista é o correto
  IF v_delivery.driver_id != p_driver_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Entrega não está atribuída a este motorista'
    );
  END IF;
  
  -- Calcular valores: 80% para motorista, 20% taxa da plataforma
  v_platform_fee := v_delivery.price_adjusted * 0.20;
  v_driver_earnings := v_delivery.price_adjusted * 0.80;
  
  -- Obter saldo atual do restaurante (com lock)
  SELECT wallet_balance INTO v_restaurant_balance
  FROM restaurants
  WHERE id = v_delivery.restaurant_id
  FOR UPDATE;
  
  -- Verificar se restaurante tem saldo suficiente
  IF v_restaurant_balance < v_delivery.price_adjusted THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Restaurante não possui saldo suficiente',
      'required', v_delivery.price_adjusted,
      'available', v_restaurant_balance
    );
  END IF;
  
  -- Obter saldo atual do motorista (com lock)
  SELECT earnings_balance INTO v_driver_balance
  FROM drivers
  WHERE id = p_driver_id
  FOR UPDATE;
  
  -- 1. Deduzir do restaurante
  v_new_restaurant_balance := v_restaurant_balance - v_delivery.price_adjusted;
  UPDATE restaurants
  SET wallet_balance = v_new_restaurant_balance
  WHERE id = v_delivery.restaurant_id;
  
  -- 2. Creditar ao motorista (80%)
  v_new_driver_balance := v_driver_balance + v_driver_earnings;
  UPDATE drivers
  SET earnings_balance = v_new_driver_balance,
      total_deliveries = COALESCE(total_deliveries, 0) + 1
  WHERE id = p_driver_id;
  
  -- 3. Atualizar status da entrega
  UPDATE deliveries
  SET status = 'delivered',
      delivered_at = now()
  WHERE id = p_delivery_id;
  
  -- 4. Registrar transações (todas em uma única operação)
  INSERT INTO transactions (
    delivery_id, 
    restaurant_id, 
    driver_id, 
    amount, 
    driver_earnings, 
    platform_fee, 
    type, 
    description
  ) VALUES 
  -- Transação de pagamento da entrega (débito do restaurante)
  (
    p_delivery_id,
    v_delivery.restaurant_id,
    NULL,
    -v_delivery.price_adjusted,
    NULL,
    NULL,
    'delivery_payment',
    'Pagamento de entrega #' || p_delivery_id
  ),
  -- Transação de ganho do motorista (crédito)
  (
    p_delivery_id,
    NULL,
    p_driver_id,
    v_driver_earnings,
    v_driver_earnings,
    NULL,
    'delivery_payment',
    'Recebimento de entrega (80%)'
  ),
  -- Transação da taxa da plataforma
  (
    p_delivery_id,
    NULL,
    NULL,
    v_platform_fee,
    NULL,
    v_platform_fee,
    'platform_fee',
    'Taxa da plataforma (20%)'
  );
  
  -- Retornar sucesso com detalhes
  RETURN json_build_object(
    'success', true,
    'delivery_id', p_delivery_id,
    'restaurant_balance_before', v_restaurant_balance,
    'restaurant_balance_after', v_new_restaurant_balance,
    'driver_balance_before', v_driver_balance,
    'driver_balance_after', v_new_driver_balance,
    'total_amount', v_delivery.price_adjusted,
    'driver_earnings', v_driver_earnings,
    'platform_fee', v_platform_fee
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Em caso de erro, fazer rollback automático
    RETURN json_build_object(
      'success', false,
      'error', 'Erro ao processar transação: ' || SQLERRM
    );
END;
$$;