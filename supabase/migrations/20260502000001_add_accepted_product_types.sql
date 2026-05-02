-- Adiciona coluna accepted_product_types na tabela drivers
-- Armazena quais tipos de produto o motoboy aceita transportar
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS accepted_product_types TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.drivers.accepted_product_types IS
  'Lista dos tipos de produto que o motorista aceita transportar. '
  'Array vazio = não configurado (bloqueado de ficar online).';
