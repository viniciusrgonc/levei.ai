-- SEC-004: Protege colunas financeiras de public.restaurants contra alteração
-- direta por usuários autenticados via REST API, Supabase JS ou PATCH direto.
--
-- ══════════════════════════════════════════════════════════════════════════════
-- PROBLEMA IDENTIFICADO
-- ══════════════════════════════════════════════════════════════════════════════
--
-- A policy existente "Restaurants can update their own data" permite:
--   USING (auth.uid() = user_id)
--
-- Ela verifica IDENTIDADE (quem pode atualizar qual linha), mas não restringe
-- QUAIS COLUNAS podem ser alteradas. Qualquer restaurante autenticado pode:
--
--   PATCH /rest/v1/restaurants?id=eq.<meu-id>
--   { "wallet_balance": 999999 }
--
-- O banco aceita porque (a) auth.uid() = user_id ✓ e (b) 999999 >= 0 ✓.
-- Não há gateway, mas o saldo fictício pode ser inflado arbitrariamente.
-- Quando houver dinheiro real, isso seria fraude direta.
--
-- ══════════════════════════════════════════════════════════════════════════════
-- SOLUÇÃO: TRIGGER BEFORE UPDATE
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Um trigger BEFORE UPDATE é o mecanismo correto para proteger colunas
-- específicas sem alterar a RLS existente (que deve continuar permitindo
-- atualizações de outros campos como phone, address, etc.).
--
-- PostgreSQL não suporta column-level RLS nativo.
-- A alternativa WITH CHECK com subquery na mesma tabela cria recursão de RLS.
-- O trigger é direto, auditável e independente da RLS.
--
-- ══════════════════════════════════════════════════════════════════════════════
-- COMPORTAMENTO POR ROLE
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Role          | auth.uid()       | Resultado
-- ──────────────|──────────────────|──────────────────────────────────────────
-- authenticated | UUID do usuário  | BLOQUEADO se tentar mudar coluna financeira
-- anon          | NULL             | Trigger permite; RLS bloqueia UPDATE antes
-- service_role  | NULL (sem 'sub') | Trigger permite (trusted caller)
-- postgres      | NULL (sem JWT)   | Trigger permite (superusuário, SQL Editor)
--
-- Por que service_role tem auth.uid() = NULL?
--   JWTs de service_role não contêm o claim 'sub'. A função auth.uid() lê
--   current_setting('request.jwt.claims')::json->>'sub', que retorna NULL.
--
-- ══════════════════════════════════════════════════════════════════════════════
-- FUNÇÕES INTERNAS QUE CONTINUAM FUNCIONANDO
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Todas as funções abaixo são SECURITY DEFINER chamadas via service_role ou
-- postgres. auth.uid() = NULL em todos os casos → trigger não interfere.
--
--   add_restaurant_funds             (20251129020243)
--   finalize_delivery_transaction    (20251129015912, 20260107, 20260112,
--                                     20260429, 20260502)
--   Funções de cancelamento/refund   (20260105185419, 20260106235053)
--
-- ══════════════════════════════════════════════════════════════════════════════
-- IMPACTO NO FRONTEND
-- ══════════════════════════════════════════════════════════════════════════════
--
-- RestaurantProfile.tsx:97
--   .update({ phone: data.phone })          → NÃO afetado (campo não financeiro)
--
-- AdminRestaurants.tsx:98
--   .update({ is_blocked, is_approved, block_reason }) → NÃO afetado
--
-- RestaurantWallet.tsx:98
--   .update({ wallet_balance: newBalance }) → BLOQUEADO (42501)
--   (Este fluxo já estava quebrado: PASSO 2 sempre falhava por RLS em
--    transactions. Após esta migration, PASSO 1 também falha corretamente,
--    sem debitar o saldo antes de mostrar o erro.)
--
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Função do trigger ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.protect_restaurant_financial_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Bloqueia alterações de colunas financeiras quando há sessão autenticada.
  -- auth.uid() retorna NULL para service_role e postgres → trusted, libera.
  -- auth.uid() retorna UUID para qualquer usuário autenticado → verifica.
  IF auth.uid() IS NOT NULL THEN

    IF NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance THEN
      RAISE EXCEPTION
        'Não autorizado: wallet_balance não pode ser alterado diretamente. '
        'Utilize os fluxos financeiros autorizados.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.blocked_balance IS DISTINCT FROM OLD.blocked_balance THEN
      RAISE EXCEPTION
        'Não autorizado: blocked_balance não pode ser alterado diretamente. '
        'Utilize os fluxos financeiros autorizados.'
        USING ERRCODE = '42501';
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- ── Trigger ───────────────────────────────────────────────────────────────────

-- DROP para idempotência (caso a migration seja re-aplicada em ambiente local)
DROP TRIGGER IF EXISTS protect_restaurant_financial_columns_trigger
  ON public.restaurants;

CREATE TRIGGER protect_restaurant_financial_columns_trigger
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_restaurant_financial_columns();

-- Nota: funções de trigger não precisam de GRANT/REVOKE.
-- O banco invoca a função diretamente; o controle de acesso está na lógica interna.
