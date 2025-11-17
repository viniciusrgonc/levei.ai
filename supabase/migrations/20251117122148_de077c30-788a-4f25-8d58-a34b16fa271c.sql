-- Add price_adjusted column to deliveries table
ALTER TABLE public.deliveries 
ADD COLUMN price_adjusted NUMERIC NOT NULL DEFAULT 0.00;

-- Create product_type_settings table for admin to configure percentages
CREATE TABLE public.product_type_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_type TEXT NOT NULL UNIQUE,
  percentage_increase NUMERIC NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on product_type_settings
ALTER TABLE public.product_type_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can view active settings
CREATE POLICY "Anyone can view active product type settings"
ON public.product_type_settings
FOR SELECT
USING (is_active = true OR has_role(auth.uid(), 'admin'));

-- Only admins can manage settings
CREATE POLICY "Admins can manage product type settings"
ON public.product_type_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Insert default product type settings
INSERT INTO public.product_type_settings (product_type, percentage_increase) VALUES
  ('Produto Frágil', 10.00),
  ('Volumoso', 20.00),
  ('Eletrônicos', 5.00),
  ('Documentos', 0.00),
  ('Roupas', 0.00),
  ('Alimentos', 0.00),
  ('Medicamentos', 0.00),
  ('Encomenda Pequena', 0.00),
  ('Encomenda Média', 0.00),
  ('Encomenda Grande', 0.00),
  ('Outros', 0.00);

-- Add trigger to update updated_at
CREATE TRIGGER update_product_type_settings_updated_at
BEFORE UPDATE ON public.product_type_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();