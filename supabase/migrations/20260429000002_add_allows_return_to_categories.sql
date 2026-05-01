-- Adiciona suporte a "retorno" por categoria de entrega
-- Categorias com allows_return=true exibem o toggle de retorno na criação da entrega

ALTER TABLE public.delivery_categories
  ADD COLUMN IF NOT EXISTS allows_return BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.delivery_categories.allows_return IS
  'Quando true, o toggle "Exigir retorno ao ponto de coleta" é exibido na criação da entrega';

-- Categoria Farmácia — especializada, suporta retorno (ex: retirada de receita)
INSERT INTO public.delivery_categories (name, base_price, price_per_km, is_active, allows_return)
VALUES ('Farmácia', 7.00, 2.50, true, true)
ON CONFLICT DO NOTHING;
