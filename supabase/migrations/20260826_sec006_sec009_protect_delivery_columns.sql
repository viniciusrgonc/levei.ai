-- SEC-006 + SEC-009: Trigger BEFORE UPDATE em deliveries
--
-- ══════════════════════════════════════════════════════════════════════════════
-- VULNERABILIDADES CORRIGIDAS
-- ══════════════════════════════════════════════════════════════════════════════
--
-- [SEC-006 / CRÍTICO]
--   Driver podia executar: UPDATE deliveries SET price_adjusted = 9999
--   A policy "Drivers can update their accepted deliveries" não restringia colunas.
--   finalize_delivery_transaction usava delivery.price_adjusted para calcular
--   o crédito → driver inflava artificialmente o ganho.
--
-- [SEC-009 / HIGH]
--   Driver podia executar: UPDATE deliveries SET financial_status = 'blocked'
--   em uma entrega cancelada/refundada, depois chamar finalize_delivery_transaction
--   para gerar crédito sem fundos reais bloqueados.
--
--   Driver também podia: UPDATE deliveries SET status = 'picked_up'
--   em uma entrega delivered/cancelled, tentando ressuscitar o fluxo.
--
-- ══════════════════════════════════════════════════════════════════════════════
-- DESIGN: current_user vs auth.uid()
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Este trigger usa current_user = 'authenticated' em vez de auth.uid() IS NOT NULL.
--
-- RAZÃO: auth.uid() lê request.jwt.claims, variável de sessão que persiste
-- mesmo dentro de funções SECURITY DEFINER. Quando um usuário autenticado
-- chama refund_delivery_funds (SECURITY DEFINER owned by postgres):
--   • current_user = 'postgres'  ← muda para o dono da função
--   • auth.uid()   = UUID        ← NÃO muda; ainda tem o sub do caller
--
-- Se o check fosse auth.uid() IS NOT NULL, o trigger bloquearia refund_delivery_funds
-- ao tentar atualizar financial_status = 'refunded' — quebrando todos os cancelamentos.
--
-- current_user resolve isso corretamente:
--   • Direct call by authenticated user → current_user = 'authenticated' → trigger aplica
--   • Inside SECURITY DEFINER owned by postgres → current_user = 'postgres' → trigger passa
--
-- ══════════════════════════════════════════════════════════════════════════════
-- FUNÇÕES SECURITY DEFINER QUE CONTINUAM FUNCIONANDO SEM ALTERAÇÃO
-- ══════════════════════════════════════════════════════════════════════════════
--
--   block_delivery_funds          → current_user = 'postgres' → passa
--   refund_delivery_funds         → current_user = 'postgres' → passa
--   finalize_delivery_transaction → current_user = 'postgres' → passa
--   accept_delivery_atomic        → current_user = 'postgres' → passa
--
-- ══════════════════════════════════════════════════════════════════════════════
-- TRANSIÇÕES DE STATUS LEGÍTIMAS PARA authenticated (SEC-009)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- O trigger NÃO bloqueia transições de estado "forward" (ex: pending→accepted).
-- Bloqueia somente a RESSURREIÇÃO de estados terminais:
--   FROM terminal (cancelled, delivered, cancellation_completed, package_returned)
--   → qualquer outro estado
--
-- Transições do driver que usam UPDATE direto (DeliveryInProgress + ReturnInProgress):
--   picked_up → returning     : NÃO é terminal → NÃO bloqueado ✓
--   returning → picked_up     : NÃO é terminal → NÃO bloqueado ✓
--
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.protect_delivery_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- ── Guard: só aplica a chamadas diretas do role 'authenticated' ──────────
  --
  -- SECURITY DEFINER functions owned by postgres executam como
  -- current_user = 'postgres' → retornam aqui sem restrição.
  -- service_role faz chamadas como current_user = 'service_role' → idem.
  IF current_user != 'authenticated' THEN
    RETURN NEW;
  END IF;

  -- ── SEC-006a: price_adjusted é imutável para authenticated ───────────────
  --
  -- O valor é definido uma vez no INSERT pelo restaurante e é usado por
  -- finalize_delivery_transaction para calcular ganhos do entregador.
  -- Nenhuma atualização direta por authenticated é legítima após a criação.
  IF NEW.price_adjusted IS DISTINCT FROM OLD.price_adjusted THEN
    RAISE EXCEPTION 'price_adjusted só pode ser alterado por operações internas'
      USING ERRCODE = '42501';
  END IF;

  -- ── SEC-006b: financial_status é gerenciado exclusivamente pelas funções ─
  --
  -- Única origem legítima de mudanças:
  --   block_delivery_funds          → 'blocked'
  --   finalize_delivery_transaction → 'transferring' / 'paid'
  --   refund_delivery_funds         → 'refunded'
  -- Todas são SECURITY DEFINER → current_user = 'postgres' → passam no guard.
  IF NEW.financial_status IS DISTINCT FROM OLD.financial_status THEN
    RAISE EXCEPTION 'financial_status só pode ser alterado por operações internas'
      USING ERRCODE = '42501';
  END IF;

  -- ── SEC-009: Ressurreição de estados terminais bloqueada ─────────────────
  --
  -- Impede que um driver (ou restaurante) altere o status de uma entrega que
  -- já atingiu um estado terminal de volta para um estado ativo.
  --
  -- Estados terminais: cancelled, delivered, cancellation_completed, package_returned
  --
  -- Transições do driver via UPDATE direto que NÃO são terminais:
  --   picked_up → returning  (DeliveryInProgress.tsx:306)
  --   returning → picked_up  (ReturnInProgress.tsx:277)
  -- Ambas continuam funcionando (OLD.status não é terminal).
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status IN (
      'cancelled',
      'delivered',
      'cancellation_completed',
      'package_returned'
    ) THEN
      RAISE EXCEPTION
        'Não é possível alterar o status de uma entrega em estado terminal (atual: %)',
        OLD.status
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Idempotente: remove se existir antes de recriar
DROP TRIGGER IF EXISTS protect_delivery_columns_trigger ON public.deliveries;

CREATE TRIGGER protect_delivery_columns_trigger
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_delivery_columns();
