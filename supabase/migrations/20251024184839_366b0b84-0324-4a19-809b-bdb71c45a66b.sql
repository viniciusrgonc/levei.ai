-- Create atomic delivery acceptance function with proper locking
CREATE OR REPLACE FUNCTION public.accept_delivery_atomic(
  p_delivery_id UUID,
  p_driver_id UUID
) RETURNS JSON AS $$
DECLARE
  v_delivery RECORD;
  v_result JSON;
BEGIN
  -- Lock the delivery row for update (prevents race conditions)
  SELECT * INTO v_delivery
  FROM deliveries
  WHERE id = p_delivery_id
  FOR UPDATE;
  
  -- Check if delivery exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Entrega não encontrada'
    );
  END IF;
  
  -- Check if delivery is still pending
  IF v_delivery.status != 'pending' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Esta entrega já foi aceita por outro motorista'
    );
  END IF;
  
  -- Update delivery with driver assignment
  UPDATE deliveries
  SET 
    driver_id = p_driver_id,
    status = 'accepted',
    accepted_at = now()
  WHERE id = p_delivery_id;
  
  -- Return success with updated delivery
  SELECT json_build_object(
    'success', true,
    'delivery', row_to_json(d.*)
  ) INTO v_result
  FROM deliveries d
  WHERE d.id = p_delivery_id;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.accept_delivery_atomic(UUID, UUID) TO authenticated;