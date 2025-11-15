-- Create delivery_categories table
CREATE TABLE public.delivery_categories (
  id UUID NOT NULL DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  base_price NUMERIC NOT NULL DEFAULT 0.00,
  price_per_km NUMERIC NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delivery_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active categories"
  ON public.delivery_categories
  FOR SELECT
  USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage all categories"
  ON public.delivery_categories
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_delivery_categories_updated_at
  BEFORE UPDATE ON public.delivery_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default categories
INSERT INTO public.delivery_categories (name, base_price, price_per_km) VALUES
  ('Moto', 5.00, 2.50),
  ('Carro', 8.00, 3.00),
  ('Van', 12.00, 4.00),
  ('Caminhão', 20.00, 5.50);