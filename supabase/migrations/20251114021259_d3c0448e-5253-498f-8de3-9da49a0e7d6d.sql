-- Add wallet balance to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(10,2) NOT NULL DEFAULT 0.00;

-- Add earnings balance to drivers table (if not exists)
ALTER TABLE public.drivers
ADD COLUMN IF NOT EXISTS earnings_balance NUMERIC(10,2) NOT NULL DEFAULT 0.00;

-- Update transactions table to include more detailed information
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id),
ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS driver_earnings NUMERIC(10,2) DEFAULT 0.00;

-- Create index for better performance on transactions queries
CREATE INDEX IF NOT EXISTS idx_transactions_restaurant_id ON public.transactions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);

-- Add constraint to prevent negative balance
ALTER TABLE public.restaurants
ADD CONSTRAINT positive_wallet_balance CHECK (wallet_balance >= 0);

-- Function to add funds to restaurant wallet
CREATE OR REPLACE FUNCTION public.add_restaurant_funds(
  p_restaurant_id UUID,
  p_amount NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  -- Update restaurant balance
  UPDATE public.restaurants
  SET wallet_balance = wallet_balance + p_amount
  WHERE id = p_restaurant_id
  RETURNING wallet_balance INTO v_new_balance;

  -- Create transaction record
  INSERT INTO public.transactions (
    restaurant_id,
    amount,
    type,
    description
  ) VALUES (
    p_restaurant_id,
    p_amount,
    'add_funds',
    'Recarga de saldo na carteira'
  );

  RETURN json_build_object(
    'success', true,
    'new_balance', v_new_balance
  );
END;
$$;