-- Corrigir função add_restaurant_funds para usar enum correto
CREATE OR REPLACE FUNCTION public.add_restaurant_funds(p_restaurant_id uuid, p_amount numeric)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  -- Update restaurant balance
  UPDATE public.restaurants
  SET wallet_balance = wallet_balance + p_amount
  WHERE id = p_restaurant_id
  RETURNING wallet_balance INTO v_new_balance;

  -- Create transaction record using correct enum value
  INSERT INTO public.transactions (
    restaurant_id,
    amount,
    type,
    description
  ) VALUES (
    p_restaurant_id,
    p_amount,
    'delivery_payment', -- Usando enum correto ao invés de 'add_funds'
    'Recarga de saldo na carteira'
  );

  RETURN json_build_object(
    'success', true,
    'new_balance', v_new_balance
  );
END;
$$;