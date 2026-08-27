-- SEC-004 (revisão 2): Troca guard de auth.uid() → current_user para wallet_balance
--
-- ══════════════════════════════════════════════════════════════════════════════
-- CONTEXTO
-- ══════════════════════════════════════════════════════════════════════════════
--
-- A revisão anterior usava auth.uid() IS NOT NULL como guarda:
--
--   IF auth.uid() IS NOT NULL
--   AND NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance THEN
--     RAISE EXCEPTION ...
--   END IF;
--
-- PROBLEMA: auth.uid() lê request.jwt.claims — variável de sessão que NÃO é
-- resetada pelo contexto SECURITY DEFINER. Quando block_delivery_funds
-- (SECURITY DEFINER, dono = postgres) é chamado por um usuário autenticado
-- via supabase.rpc(), o JWT permanece com 'sub' setado. Portanto auth.uid()
-- retornava o UUID do caller dentro da função, e o trigger bloqueava o UPDATE
-- legítimo de wallet_balance feito pela função interna.
--
-- SOLUÇÃO: usar current_user = 'authenticated'.
--
--   current_user muda para o dono da função quando SECURITY DEFINER está ativo.
--   Uma função owned by postgres executa com current_user = 'postgres', mesmo
--   que o chamador seja authenticated. O trigger checa current_user — se não
--   for 'authenticated', é uma operação interna confiável → passa.
--
-- Esse é o mesmo padrão adotado em protect_delivery_columns (SEC-006/009),
-- que distingue corretamente chamadas diretas de chamadas SECURITY DEFINER.
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
-- COMPORTAMENTO POR ROLE (atualizado para current_user)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Role/contexto                    | current_user   | Resultado
-- ─────────────────────────────────|────────────────|──────────────────────────
-- authenticated (UPDATE direto)    | authenticated  | BLOQUEADO (42501)
-- anon (UPDATE direto)             | anon           | Trigger passa; RLS bloqueia
-- SECURITY DEFINER owned by postgres (qualquer caller) | postgres | PASSA ✓
-- service_role (direto, superuser) | service_role   | Passa (não é 'authenticated')
-- postgres (SQL Editor / interno)  | postgres       | Passa
--
-- ══════════════════════════════════════════════════════════════════════════════
-- FUNÇÕES INTERNAS — continuam funcionando
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Independente do JWT do chamador, dentro dessas funções current_user = 'postgres'
-- (SECURITY DEFINER, owner = postgres) → trigger não interfere:
--
--   block_delivery_funds             (20251220 + SEC-005)
--   add_restaurant_funds             (20251129020243)
--   finalize_delivery_transaction    (20251129015912 + revisões)
--   refund_delivery_funds            (20251220)
--   Funções de cancelamento          (20260105, 20260106, 20260811)
--
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.protect_restaurant_financial_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Bloqueia alteração de wallet_balance por chamadas diretas do role authenticated.
  --
  -- Usa current_user (não auth.uid()) porque auth.uid() lê request.jwt.claims —
  -- variável de sessão que persiste dentro de funções SECURITY DEFINER. Se
  -- usássemos auth.uid(), funções internas como block_delivery_funds (SECURITY
  -- DEFINER, owner=postgres) seriam bloqueadas ao tentar atualizar wallet_balance
  -- quando chamadas por um usuário autenticado.
  --
  -- current_user muda para 'postgres' dentro de qualquer SECURITY DEFINER owned
  -- by postgres → o check 'authenticated' não dispara → UPDATE passa.
  -- Chamadas diretas do role authenticated → current_user = 'authenticated' → bloqueia.
  IF current_user = 'authenticated'
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
