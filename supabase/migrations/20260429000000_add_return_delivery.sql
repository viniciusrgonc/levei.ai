-- ── Entrega com Retorno ───────────────────────────────────────────────────
-- Adiciona suporte ao fluxo de ida e volta (ex: farmácia com retenção de receita)

-- 1. Novas colunas na tabela deliveries
ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS requires_return BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;

-- 2. Adicionar 'returning' ao enum delivery_status
--    (caso o enum não exista, o bloco é ignorado silenciosamente)
DO $$
BEGIN
  ALTER TYPE delivery_status ADD VALUE IF NOT EXISTS 'returning';
EXCEPTION WHEN invalid_parameter_value THEN
  -- enum já possui o valor
  NULL;
END;
$$;

-- 3. Comentários
COMMENT ON COLUMN public.deliveries.requires_return IS
  'Quando true, o entregador deve retornar ao ponto de coleta após a entrega';
COMMENT ON COLUMN public.deliveries.returned_at IS
  'Timestamp de quando o entregador confirmou o retorno ao ponto de coleta';
