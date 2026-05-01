-- Create table for delivery radius settings per vehicle type
CREATE TABLE public.delivery_radius_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_type public.vehicle_type NOT NULL UNIQUE,
  max_radius_km NUMERIC NOT NULL DEFAULT 15.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delivery_radius_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can view active settings
CREATE POLICY "Anyone can view active radius settings" 
ON public.delivery_radius_settings 
FOR SELECT 
USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

-- Only admins can manage settings
CREATE POLICY "Admins can manage radius settings" 
ON public.delivery_radius_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default values for each vehicle type
INSERT INTO public.delivery_radius_settings (vehicle_type, max_radius_km) VALUES
  ('motorcycle', 15.00),
  ('bicycle', 8.00),
  ('car', 20.00),
  ('van', 25.00),
  ('truck', 30.00),
  ('hourly_service', 15.00);

-- Create trigger for updated_at
CREATE TRIGGER update_delivery_radius_settings_updated_at
BEFORE UPDATE ON public.delivery_radius_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();