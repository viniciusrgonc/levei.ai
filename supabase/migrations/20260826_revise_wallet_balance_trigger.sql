-- SEC-004 (revisão): Restringe o trigger de proteção a APENAS wallet_balance
--
-- ══════════════════════════════════════════════════════════════════════════════
-- CONTEXTO
-- ══════════════════════════════════════════════════════════════════════════════
--
-- A migration anterior (20260826_protect_restaurant_financial_columns.sql)
-- incluiu blocked_balance na proteção sem que isso tivesse sido explicitamente
-- solicitado. Esta migration substitui a função do trigger para proteger
-- EXCLUSIVAMENTE wallet_balance, conforme a regra definida:
--
--   IF auth.uid() IS NOT NULL
--   AND NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance
--   THEN
--     RAISE EXCEPTION ...
--   END IF;
--
-- blocked_balance: avaliação separada
-- ──────────────────────────────────────────────────────────────────────────────
-- blocked_balance é uma coluna financeira interna que representa fundos
-- reservados para entregas em andamento. Ela é sempre movimentada
-- atomicamente com wallet_balance pelas funções SECURITY DEFINER
-- (finalize_delivery_transaction, cancelamentos).
--
-- Se um restaurante autenticado zerar blocked_balance via REST API enquanto
-- uma entrega está em andamento, a lógica de débito ao finalizar encontrará
-- um valor inconsistente.
--
-- Recomendação: proteger blocked_balance também (migration adicional explícita).
-- Decisão: pendente de aprovação explícita.
--
-- ══════════════════════════════════════════════════════════════════════════════
-- COMPORTAMENTO POR ROLE (inalterado)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Role          | auth.uid()       | Resultado
-- ──────────────|──────────────────|──────────────────────────────────────────
-- authenticated | UUID do usuário  | BLOQUEADO se tentar mudar wallet_balance
-- anon          | NULL             | Trigger permite; RLS bloqueia o UPDATE
-- service_role  | NULL (sem 'sub') | Trigger permite (trusted caller)
-- postgres      | NULL (sem JWT)   | Trigger permite (superusuário)
--
-- ══════════════════════════════════════════════════════════════════════════════
-- FUNÇÕES INTERNAS — continuam funcionando sem alteração
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Todas são chamadas via service_role (Edge Functions) ou postgres (SQL Editor).
-- auth.uid() = NULL nesses contextos → trigger não interfere.
--
--   add_restaurant_funds             (20251129020243)
--   finalize_delivery_transaction    (20251129015912 + revisões)
--   Funções de cancelamento/refund   (20260105, 20260106)
--
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.protect_restaurant_financial_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Bloqueia alteração de wallet_balance por sessões autenticadas.
  -- auth.uid() = NULL para service_role e postgres → trusted, libera.
  -- auth.uid() = UUID para qualquer usuário autenticado → verifica.
  IF auth.uid() IS NOT NULL
  AND NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance THEN
    RAISE EXCEPTION 'wallet_balance só pode ser alterado por operações internas'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- O trigger já existe (criado na migration anterior); não é necessário
-- recriar. A substituição da função é suficiente.
-- DROP/CREATE por idempotência caso esta migration seja a primeira a rodar
-- (ex.: ambiente limpo onde a anterior não foi aplicada).
DROP TRIGGER IF EXISTS protect_restaurant_financial_columns_trigger
  ON public.restaurants;

CREATE TRIGGER protect_restaurant_financial_columns_trigger
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_restaurant_financial_columns();
