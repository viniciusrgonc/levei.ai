-- Add delivery_sequence column to deliveries table
ALTER TABLE public.deliveries
ADD COLUMN IF NOT EXISTS delivery_sequence integer DEFAULT 1;

-- Update existing deliveries: main deliveries get sequence 1
UPDATE public.deliveries
SET delivery_sequence = 1
WHERE is_additional_delivery = false OR is_additional_delivery IS NULL;

-- Update existing additional deliveries with sequential numbers
WITH numbered_deliveries AS (
  SELECT id, parent_delivery_id,
    ROW_NUMBER() OVER (PARTITION BY parent_delivery_id ORDER BY created_at ASC) + 1 as seq
  FROM public.deliveries
  WHERE is_additional_delivery = true AND parent_delivery_id IS NOT NULL
)
UPDATE public.deliveries d
SET delivery_sequence = nd.seq
FROM numbered_deliveries nd
WHERE d.id = nd.id;

-- Create function to get next sequence number for a batch
CREATE OR REPLACE FUNCTION public.get_next_delivery_sequence(p_parent_delivery_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_seq integer;
BEGIN
  SELECT COALESCE(MAX(delivery_sequence), 0) + 1
  INTO v_next_seq
  FROM deliveries
  WHERE parent_delivery_id = p_parent_delivery_id
     OR id = p_parent_delivery_id;
  
  RETURN v_next_seq;
END;
$$;

-- Create function to validate delivery completion order
CREATE OR REPLACE FUNCTION public.validate_delivery_sequence_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous_incomplete boolean;
  v_batch_id uuid;
BEGIN
  -- Only check when marking as delivered
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    -- Get the batch ID (either parent_delivery_id or own id if main)
    v_batch_id := COALESCE(NEW.parent_delivery_id, NEW.id);
    
    -- Check if any delivery with lower sequence in same batch is not delivered
    SELECT EXISTS (
      SELECT 1 FROM deliveries
      WHERE (parent_delivery_id = v_batch_id OR id = v_batch_id)
        AND id != NEW.id
        AND delivery_sequence < NEW.delivery_sequence
        AND status != 'delivered'
        AND status != 'cancelled'
    ) INTO v_previous_incomplete;
    
    IF v_previous_incomplete THEN
      RAISE EXCEPTION 'Não é possível concluir esta entrega. Complete as entregas anteriores primeiro.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for sequence validation
DROP TRIGGER IF EXISTS validate_delivery_sequence_trigger ON deliveries;
CREATE TRIGGER validate_delivery_sequence_trigger
  BEFORE UPDATE ON deliveries
  FOR EACH ROW
  EXECUTE FUNCTION validate_delivery_sequence_order();