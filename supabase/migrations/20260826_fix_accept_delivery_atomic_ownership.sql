-- SEC-001: Adiciona ownership check interno em accept_delivery_atomic
--
-- PROBLEMA: A função tinha GRANT EXECUTE TO authenticated sem verificar
-- se o p_driver_id pertence ao usuário chamador. Qualquer usuário autenticado
-- podia aceitar entregas em nome de qualquer motorista, ignorando a Edge Function.
--
-- CORREÇÃO: Adiciona verificação de auth.uid() no topo da função.
--
-- COMO FUNCIONA COM EDGE FUNCTION:
--   - Edge Function usa SERVICE_ROLE_KEY → auth.uid() retorna NULL
--     (JWTs de service role não possuem claim "sub") → check ignorado (trusted)
--   - Usuário autenticado direto → auth.uid() = UUID do usuário → verificação obrigatória
--
-- A proteção atômica contra race condition (FOR UPDATE) é preservada intacta.

CREATE OR REPLACE FUNCTION public.accept_delivery_atomic(
  p_delivery_id UUID,
  p_driver_id   UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery RECORD;
  v_result   JSON;
BEGIN
  -- ── OWNERSHIP CHECK ────────────────────────────────────────────
  -- Quando chamada por usuário autenticado diretamente (auth.uid() != NULL),
  -- exige que p_driver_id pertença à conta do chamador.
  -- Quando chamada pela Edge Function via SERVICE_ROLE_KEY, auth.uid() é NULL
  -- e o check é ignorado (service role é trusted).
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.drivers
      WHERE id      = p_driver_id
        AND user_id = auth.uid()
    ) THEN
      RETURN json_build_object(
        'success', false,
        'error',   'Não autorizado: este motorista não pertence à sua conta'
      );
    END IF;
  END IF;

  -- ── ATOMIC ACCEPT (lógica original preservada) ─────────────────
  -- Lock pessimista: impede dois motoristas de aceitar a mesma entrega
  SELECT * INTO v_delivery
  FROM public.deliveries
  WHERE id = p_delivery_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error',   'Entrega não encontrada'
    );
  END IF;

  IF v_delivery.status != 'pending' THEN
    RETURN json_build_object(
      'success', false,
      'error',   'Esta entrega já foi aceita por outro motorista'
    );
  END IF;

  UPDATE public.deliveries
  SET
    driver_id   = p_driver_id,
    status      = 'accepted',
    accepted_at = now()
  WHERE id = p_delivery_id;

  SELECT json_build_object(
    'success',  true,
    'delivery', row_to_json(d.*)
  ) INTO v_result
  FROM public.deliveries d
  WHERE d.id = p_delivery_id;

  RETURN v_result;
END;
$$;

-- GRANT mantido: a Edge Function (service role) continua funcionando,
-- e usuários autenticados que tentarem chamar diretamente agora são bloqueados
-- pelo ownership check interno.
GRANT EXECUTE ON FUNCTION public.accept_delivery_atomic(UUID, UUID) TO authenticated;
