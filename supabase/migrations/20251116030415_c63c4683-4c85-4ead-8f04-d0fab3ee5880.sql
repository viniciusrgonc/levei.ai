-- Adicionar campos product_type e product_note na tabela deliveries
ALTER TABLE public.deliveries
ADD COLUMN IF NOT EXISTS product_type TEXT,
ADD COLUMN IF NOT EXISTS product_note TEXT;

-- Adicionar comentários para documentação
COMMENT ON COLUMN public.deliveries.product_type IS 'Tipo do produto sendo entregue (Documentos, Eletrônicos, etc)';
COMMENT ON COLUMN public.deliveries.product_note IS 'Observações adicionais sobre o produto';