-- Function to create notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_delivery_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, delivery_id)
  VALUES (p_user_id, p_title, p_message, p_type, p_delivery_id)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Trigger function to notify restaurant when driver accepts delivery
CREATE OR REPLACE FUNCTION public.notify_on_delivery_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restaurant_user_id UUID;
  v_driver_user_id UUID;
  v_restaurant_name TEXT;
  v_driver_name TEXT;
BEGIN
  -- Get restaurant user_id
  SELECT r.user_id, r.business_name INTO v_restaurant_user_id, v_restaurant_name
  FROM restaurants r
  WHERE r.id = NEW.restaurant_id;

  -- Get driver user_id if driver is assigned
  IF NEW.driver_id IS NOT NULL THEN
    SELECT d.user_id, p.full_name INTO v_driver_user_id, v_driver_name
    FROM drivers d
    JOIN profiles p ON p.id = d.user_id
    WHERE d.id = NEW.driver_id;
  END IF;

  -- Notify restaurant when delivery is accepted
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    PERFORM create_notification(
      v_restaurant_user_id,
      'Entrega Aceita',
      'O motorista ' || COALESCE(v_driver_name, 'Motorista') || ' aceitou sua entrega!',
      'delivery_accepted',
      NEW.id
    );
  END IF;

  -- Notify restaurant when driver picks up
  IF NEW.status = 'picked_up' AND OLD.status = 'accepted' THEN
    PERFORM create_notification(
      v_restaurant_user_id,
      'Pedido Coletado',
      'O motorista coletou o pedido e está a caminho da entrega!',
      'delivery_picked_up',
      NEW.id
    );
  END IF;

  -- Notify restaurant when delivery is completed
  IF NEW.status = 'delivered' AND OLD.status = 'picked_up' THEN
    PERFORM create_notification(
      v_restaurant_user_id,
      'Entrega Concluída',
      'A entrega foi finalizada com sucesso!',
      'delivery_completed',
      NEW.id
    );
  END IF;

  -- Notify restaurant when delivery is cancelled
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    PERFORM create_notification(
      v_restaurant_user_id,
      'Entrega Cancelada',
      'Sua entrega foi cancelada.',
      'delivery_cancelled',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for delivery status changes
DROP TRIGGER IF EXISTS trigger_notify_delivery_status ON public.deliveries;
CREATE TRIGGER trigger_notify_delivery_status
  AFTER UPDATE OF status ON public.deliveries
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION notify_on_delivery_status_change();