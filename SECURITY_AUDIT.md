# SECURITY_AUDIT.md — levei.ai

**Data:** 2026-08-26  
**Escopo:** Frontend (React/TypeScript), Supabase (PostgreSQL + Auth + RLS + Edge Functions + RPCs), migrations, dependências  
**Metodologia:** Revisão estática de código — sem alterações de código, banco ou configuração  
**Status:** ⚠️ NÃO APTO PARA PRODUÇÃO sem correção dos itens CRÍTICOS em aberto

---

## Resumo Executivo — 10 Riscos Mais Importantes

| # | Severidade | Título | Status |
|---|-----------|--------|--------|
| 1 | 🔴 CRÍTICO | `accept_delivery_atomic` tem GRANT para `authenticated` sem ownership check interno — qualquer usuário aceita entrega por qualquer motorista | **ABERTO** |
| 2 | 🔴 CRÍTICO | Edge Function `send-push` sem autenticação — spam de push para qualquer usuário | **ABERTO** |
| 3 | 🔴 CRÍTICO | RPC `add_restaurant_funds` sem verificação de autorização — saldo infinito | **ABERTO** |
| 4 | 🔴 CRÍTICO | RPC `increment_driver_points` sem auth — pontos infinitos para qualquer motorista | **ABERTO** |
| 5 | 🔴 CRÍTICO | CPF, endereço completo e placa em `localStorage` — exposição via XSS | **ABERTO** |
| 6 | 🔁 ALTO | Rating do motorista calculado e gravado client-side | **ABERTO** |
| 7 | 🔁 ALTO | `delivery_status_history` aceita inserção de qualquer usuário autenticado | **ABERTO** |
| 8 | 🔁 ALTO | `create_notification` sem verificação de autorização — spam de notificações | **ABERTO** |
| 9 | 🔁 ALTO | RPCs `register_referral` e `process_referral_completion` sem auth — fraude de indicação | **ABERTO** |
| 10 | 🔁 ALTO | CORS wildcard `*` em todas as Edge Functions | **ABERTO** |

> **Nota sobre SEC histórico:** A escalada de privilégio via `user_roles` INSERT (auto-atribuição de role `admin`) foi **corrigida** na migration `20260113002050`. Porém, contas criadas entre 21/10/2025 e 13/01/2026 devem ser auditadas — ver SEC-H01.

---

## Findings Detalhados

---

### 🔴 CRÍTICO — SEC-001: `accept_delivery_atomic` com GRANT para `authenticated` sem Ownership Check

**Arquivo:** `supabase/migrations/20251024184839_366b0b84...sql`  
**Linha:** `GRANT EXECUTE ON FUNCTION public.accept_delivery_atomic(UUID, UUID) TO authenticated;`  
**Arquivo:** Definição da função em migração anterior  

**Problema:**  
A função `accept_delivery_atomic(p_delivery_id UUID, p_driver_id UUID)` faz UPDATE diretamente na tabela `deliveries`, atribuindo o motorista e mudando o status para `accepted`. Ela recebeu `GRANT EXECUTE TO authenticated`, mas a função **não verifica internamente** que o usuário autenticado é o dono do `p_driver_id` informado.

A verificação de ownership (`driver.user_id === user.id`) existe **apenas** na Edge Function `accept-delivery`. Chamando o RPC diretamente, essa verificação é contornada:

```javascript
// Qualquer usuário autenticado pode executar:
await supabase.rpc('accept_delivery_atomic', {
  p_delivery_id: 'uuid-de-qualquer-entrega-pendente',
  p_driver_id: 'uuid-de-qualquer-motorista'
})
// Resultado: entrega aceita em nome de outro motorista sem consentimento
```

**Impacto:**  
- Aceitar entregas em nome de qualquer motorista sem seu conhecimento
- Desvio de renda: o `driver_id` atribuído é quem recebe o pagamento
- Bloqueio de motoristas (todos têm no max 1 entrega ativa — aceitar por eles os bloqueia)
- Manipulação de disputas e histórico

**Recomendação:**  
Adicionar verificação de ownership dentro da função SQL:
```sql
IF NOT EXISTS (
  SELECT 1 FROM drivers WHERE id = p_driver_id AND user_id = auth.uid()
) THEN
  RETURN json_build_object('success', false, 'error', 'Unauthorized');
END IF;
```
**Ou** revogar o GRANT público e exigir que a função só seja chamada via Edge Function (que usa `SERVICE_ROLE_KEY`):
```sql
REVOKE EXECUTE ON FUNCTION public.accept_delivery_atomic(UUID, UUID) FROM authenticated;
```

---

### 🔴 CRÍTICO — SEC-002: Edge Function `send-push` sem Autenticação

**Arquivo:** `supabase/functions/send-push/index.ts`  
**Linhas:** 39–52

**Problema:**  
A Edge Function não verifica o token de autorização do chamador. Qualquer requisição com `user_id` e `title` é processada:

```typescript
// Linha 44-52: sem verificação de JWT do chamador
const { user_id, title, message, url } = await req.json()
if (!user_id || !title) {
  return new Response(JSON.stringify({ error: 'user_id e title são obrigatórios' }), { status: 400 })
}
// Segue para enviar pushes usando SERVICE_ROLE_KEY (linha 56) — sem autenticação
```

A chave `anon` é pública (exposta no bundle do frontend), então qualquer pessoa com acesso ao app pode descobri-la e usá-la para chamar a função.

**Impacto:**  
- Envio de notificações push com conteúdo arbitrário para qualquer usuário
- Phishing via push ("Sua conta foi suspensa. Clique para reativar")
- Spam massivo de push sem qualquer custo
- Não requer autenticação prévia

**Cenário de Exploração:**  
```bash
curl -X POST https://fryrjgodqyjkzkzscaxz.supabase.co/functions/v1/send-push \
  -H 'apikey: <anon-key>' \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"uuid-da-vitima","title":"Ação necessária","message":"Verifique sua conta","url":"https://site-malicioso.com"}'
```

**Recomendação:**  
Adicionar verificação de autenticação no início do handler, antes de qualquer processamento. Adicionalmente, verificar que o chamador tem permissão para notificar o `user_id` alvo (ex: admin, ou participante da mesma entrega).

---

### 🔴 CRÍTICO — SEC-003: RPC `add_restaurant_funds` sem Verificação de Autorização

**Arquivo:** `supabase/migrations/20251115020631_b9c4ee92...sql`  

**Problema:**  
Função `SECURITY DEFINER` sem verificação de quem está chamando:

```sql
CREATE OR REPLACE FUNCTION public.add_restaurant_funds(
  p_restaurant_id UUID,
  p_amount NUMERIC
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE restaurants
  SET wallet_balance = wallet_balance + p_amount
  WHERE id = p_restaurant_id;
  -- Nenhuma verificação de auth.uid() ou de role
END;
$$;
```

**Impacto:**  
- Qualquer usuário autenticado pode adicionar qualquer valor ao saldo de qualquer restaurante
- Restaurantes podem solicitar entregas sem pagar
- Viola completamente o fluxo financeiro da plataforma

**Cenário de Exploração:**  
```javascript
await supabase.rpc('add_restaurant_funds', {
  p_restaurant_id: 'uuid-de-qualquer-restaurante',
  p_amount: 999999.99
})
```

**Recomendação:**  
Adicionar guard de admin dentro da função:
```sql
IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
  RAISE EXCEPTION 'Acesso negado';
END IF;
```

---

### 🔴 CRÍTICO — SEC-004: RPC `increment_driver_points` sem Autenticação

**Arquivo:** `supabase/migrations/20260507_store_and_points_functions.sql`  
**Linhas:** 9–23

**Problema:**  
```sql
CREATE OR REPLACE FUNCTION public.increment_driver_points(
  p_driver_id UUID, p_points INTEGER
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE drivers SET points = points + p_points WHERE id = p_driver_id;
  -- Sem verificação de auth.uid()
END;
$$;
```

**Impacto:**  
- Qualquer usuário autenticado pode adicionar pontos ilimitados a qualquer motorista
- `p_points` aceita valores negativos → pode zerar pontos de concorrentes
- Resgate ilimitado de itens da loja

**Recomendação:**  
Remover GRANT público para esta função. Criar versão interna (sem GRANT público) para uso nos triggers de entrega e referrals.

---

### 🔴 CRÍTICO — SEC-005: PII Sensível (CPF, Endereço, Placa) em `localStorage`

**Arquivo:** `src/pages/driver/DriverSetup.tsx`  
**Linhas:** ~390–395

**Problema:**  
```typescript
localStorage.setItem(draftKey, JSON.stringify({
  email, fullName, cpf, birthDate, phone,
  cep, street, number, complement, neighborhood, city, stateUF,
  vehicleType, plate, vehicleModel, vehicleColor, vehicleYear,
  hasBag, bagType, categories, referralCode
}))
```

`localStorage` é acessível a qualquer JavaScript na mesma origem. O token de sessão do Supabase também é armazenado em `localStorage` (padrão do SDK). Em modo de registro (chave fixa `levei-driver-reg-draft`), dados de qualquer usuário que iniciou o cadastro ficam persistidos entre sessões.

**Impacto:**  
- XSS → exfiltração de CPF, data de nascimento, endereço completo, placa
- Dados suficientes para fraude de identidade e estelionato

**Recomendação:**  
- Usar `sessionStorage` em vez de `localStorage` (não persiste após fechar o browser)
- Preferir salvar o draft no servidor (tabela `drivers` com `driver_status = 'draft'`)
- Implementar Content Security Policy rigorosa

---

### 🔁 ALTO — SEC-006: Rating do Motorista Calculado e Gravado Client-Side

**Arquivo:** `src/components/RatingModal.tsx`  
**Linhas:** 81–94

**Problema:**  
```typescript
// Cálculo feito no frontend
const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length
// UPDATE direto na tabela drivers com valor calculado pelo cliente
await supabase.from('drivers')
  .update({ rating: parseFloat(avg.toFixed(2)) })
  .eq('user_id', targetUserId)
```

`targetUserId` vem como prop. A lógica de rating é completamente client-side.

**Impacto:**  
- Qualquer valor pode ser enviado para o campo `rating` de qualquer motorista
- Sem validação de que o avaliador tem entrega concluída com aquele motorista

**Recomendação:**  
Mover para RPC server-side que valida entrega concluída, calcula média com dados do servidor e aplica o update.

---

### 🔁 ALTO — SEC-007: `delivery_status_history` INSERT Aceita Qualquer Usuário Autenticado

**Arquivo:** `supabase/migrations/20260811_cancellation_return_flow.sql`  
**Linha:** Policy `history_insert`

**Problema:**  
```sql
CREATE POLICY "history_insert"
  ON delivery_status_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL)
```

Qualquer usuário autenticado pode inserir registros de histórico para qualquer `delivery_id`, com qualquer `from_status`, `to_status` e `changed_by_role`.

**Impacto:**  
- Falsificação do audit trail de entregas
- Adulteração de evidências em disputas
- Registros falsos de cancelamento ou entrega

**Recomendação:**  
```sql
WITH CHECK (
  auth.uid() IN (
    SELECT r.user_id FROM restaurants r JOIN deliveries d ON d.restaurant_id = r.id WHERE d.id = delivery_id
    UNION
    SELECT dr.user_id FROM drivers dr JOIN deliveries d ON d.driver_id = dr.id WHERE d.id = delivery_id
  )
)
```

---

### 🔁 ALTO — SEC-008: `create_notification` sem Verificação de Autorização

**Arquivo:** `supabase/migrations/20251021031150_2d596cb1...sql`

**Problema:**  
```sql
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id UUID, p_title TEXT, p_message TEXT, p_type TEXT, p_delivery_id UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER ...
-- Sem verificação de quem está chamando
```

Chamada via `supabase.rpc('create_notification', {...})` por múltiplos componentes frontend. Qualquer usuário autenticado pode enviar notificações para qualquer `user_id`.

**Recomendação:**  
Adicionar verificação interna de que o `p_user_id` é o chamador (auto-notificação), ou que o chamador tem uma entrega em comum com o `p_user_id`, ou é admin.

---

### 🔁 ALTO — SEC-009: RPCs `register_referral` e `process_referral_completion` sem Auth

**Arquivo:** `supabase/migrations/20260507_store_and_points_functions.sql`  
**Linhas:** 26–112

**Problema:**  
Ambas as funções são `SECURITY DEFINER` sem verificação de caller:

- `register_referral(p_referral_code, p_new_driver_id)` — qualquer usuário pode registrar referências entre motoristas
- `process_referral_completion(p_driver_id)` — qualquer usuário pode simular completar entregas para acionar bônus de pontos

**Impacto:**  
Criação de referências falsas e acionamento do bônus de 100 pontos sem realizar entregas reais.

**Recomendação:**  
- `register_referral`: chamar apenas por trigger server-side durante criação de driver
- `process_referral_completion`: chamar apenas dentro de `finalize_delivery_transaction`, não expor como RPC público

---

### 🔁 ALTO — SEC-010: CORS Wildcard `*` em Todas as Edge Functions

**Arquivo:** `supabase/functions/_shared/cors.ts`

**Problema:**  
```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

Combinado com a ausência de autenticação em `send-push` (SEC-002), qualquer site pode disparar pushes para usuários do sistema.

**Recomendação:**  
```typescript
'Access-Control-Allow-Origin': 'https://levei.ai'
```
Usar variável de ambiente para alternar entre `*` (dev) e domínio de produção.

---

### 🔁 ALTO — SEC-011: `block_delivery_funds` e `refund_delivery_funds` Chamados Client-Side sem Ownership Check Interno

**Arquivo:** `src/pages/restaurant/NewDelivery.tsx:348`, `src/components/CancelDeliveryModal.tsx:120`, `src/pages/restaurant/RestaurantScheduling.tsx:147`

**Problema:**  
As RPCs são `SECURITY DEFINER` mas não verificam internamente se o `p_delivery_id` pertence ao restaurante do usuário autenticado. O `p_amount` em `block_delivery_funds` é calculado client-side.

- `refund_delivery_funds`: um restaurante poderia tentar reembolsar entrega de outro restaurante
- `block_delivery_funds`: valor pode ser manipulado para bloquear menos saldo

**Recomendação:**  
Adicionar verificações internas nas funções:
```sql
IF NOT EXISTS (
  SELECT 1 FROM deliveries d
  JOIN restaurants r ON r.id = d.restaurant_id
  WHERE d.id = p_delivery_id AND r.user_id = auth.uid()
) THEN RAISE EXCEPTION 'Não autorizado'; END IF;
```

---

### 🟡 MÉDIO — SEC-012: `senderRole` em `delivery_messages` Controlado pelo Chamador

**Arquivo:** `src/hooks/useDeliveryChat.tsx`  
**Linhas:** 69–74

**Problema:**  
```typescript
await supabase.from('delivery_messages').insert({
  delivery_id: deliveryId,
  sender_id: user.id,
  sender_role: senderRole,  // parâmetro do hook
  message: message.trim(),
})
```

A policy `delivery_messages_access` verifica se o usuário é participante da entrega, mas não valida que `sender_role` corresponde à role real do usuário.

**Recomendação:**  
Derivar `sender_role` server-side via trigger com base no `sender_id`, ou adicionar validação na RLS policy.

---

### 🟡 MÉDIO — SEC-013: Rota `/chat/:deliveryId` Acessível por Qualquer Usuário Autenticado

**Arquivo:** `src/App.tsx`  
**Linhas:** 352–358

**Problema:**  
Rota envolve apenas `ProtectedRoute` (autenticação), não `RoleRoute`. Admin, restaurante ou motorista sem relação com a entrega pode acessar o chat se conhecer o `deliveryId`. Segurança depende exclusivamente de RLS em `delivery_messages`.

**Recomendação:**  
Verificar na query do chat que o usuário é participante da entrega específica.

---

### 🟡 MÉDIO — SEC-014: Cache de Role por 5 Minutos Após Revogação

**Arquivo:** `src/hooks/useUserSetup.tsx`  
**Linhas:** 74–76

**Problema:**  
```typescript
staleTime: 5 * 60 * 1000   // 5 minutos sem nova query
```

Role revogada (ex: bloqueio de restaurante) não tem efeito no frontend por até 5 minutos.

**Recomendação:**  
Reduzir `staleTime` para 60 segundos ou usar Supabase Realtime para invalidar o cache quando `user_roles` mudar para o usuário atual.

---

### 🟡 MÉDIO — SEC-015: `IS_DEV_MODE` Sempre `true` — CPF Nunca Validado

**Arquivo:** `src/lib/appConfig.ts`

**Problema:**  
```typescript
export const IS_DEV_MODE = import.meta.env.VITE_APP_ENV !== 'production';
// VITE_APP_ENV não está definido no .env → undefined !== 'production' → true
export const appConfig = {
  strictCpfValidation: !IS_DEV_MODE,  // sempre false
  requireEmailConfirmation: false,
}
```

Em produção, `VITE_APP_ENV` nunca é definido como `'production'`, então:
- Validação de CPF nunca é aplicada (CPFs inválidos ou fictícios são aceitos)
- Confirmação de email está desativada (contas criadas com emails de terceiros sem verificação)

**Recomendação:**  
Definir `VITE_APP_ENV=production` no ambiente de build de produção. Ativar `requireEmailConfirmation: true` para produção.

---

### 🟡 MÉDIO — SEC-016: Session JWT em `localStorage` (Amplifica Risco de XSS)

**Arquivo:** `src/integrations/supabase/client.ts`  
**Linha:** 13

**Problema:**  
```typescript
auth: { storage: localStorage, persistSession: true, autoRefreshToken: true }
```

Token de sessão acessível a qualquer JavaScript. Combinado com PII em `localStorage` (SEC-005), um XSS no app é catastrófico.

**Recomendação:**  
Implementar Content Security Policy rigorosa. Avaliar `sessionStorage` para menor superfície de ataque.

---

### 🟡 MÉDIO — SEC-017: Google Maps API Key Exposta no Bundle do Cliente

**Arquivo:** `.env:4`

**Problema:**  
```
VITE_GOOGLE_MAPS_API_KEY="AIzaSyCLwy-CgreMhCejW_MHUfI4GsA1oD3nvcw"
```

Prefixo `VITE_` inclui a chave no bundle JS entregue ao cliente. Usada diretamente em chamadas REST do browser (`places.googleapis.com`, `maps.googleapis.com`). Sem restrições de HTTP Referrer, pode ser abusada por terceiros gerando custos.

**Recomendação:**  
Restringir a key a domínios autorizados no Google Cloud Console. Criar key separada para ambiente de produção.

---

### 🟡 MÉDIO — SEC-018: Cancelamento Registra `cancelled_by_role` Client-Side

**Arquivo:** `src/components/CancelDeliveryModal.tsx`  
**Linhas:** 145–152

**Problema:**  
```typescript
await supabase.from('deliveries').update({
  cancelled_by_role: cancellerRole,  // prop do componente
  cancelled_by_user_id: user?.id ?? null,
}).eq('id', deliveryId)
```

`cancellerRole` vem como prop e pode ser qualquer valor, comprometendo a auditoria.

**Recomendação:**  
Derivar `cancelled_by_role` server-side com base no `auth.uid()` e na role real do usuário.

---

### 🟡 MÉDIO — SEC-019: `saved_addresses` Sem Verificação de Owner no Frontend

**Arquivo:** `src/pages/restaurant/RestaurantAddresses.tsx`  
**Linhas:** 143–146, 165

**Problema:**  
```typescript
await supabase.from('saved_addresses').delete().eq('id', id)
await supabase.from('saved_addresses').update(row).eq('id', payload.id)
```

Sem filtro de `restaurant_id` no frontend. Segurança depende inteiramente da RLS policy em `saved_addresses`.

**Recomendação:**  
Verificar que as RLS policies incluem `USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()))`.

---

### 🟡 MÉDIO — SEC-020: Versão do `supabase-js` Desatualizada nas Edge Functions

**Arquivo:** `supabase/functions/send-push/index.ts:2` (e demais Edge Functions)

**Problema:**  
- Frontend: `@supabase/supabase-js: ^2.76.0`
- Edge Functions: `https://esm.sh/@supabase/supabase-js@2.39.3` (versão fixada)

Diferença de ~37 versões menores. Patches de segurança e correções de comportamento não são recebidos.

**Recomendação:**  
Atualizar para `^2.76.x` nas Edge Functions.

---

### 🟢 BAIXO — SEC-021: `console.error` com Objetos Internos em Produção

**Arquivos:** `src/hooks/useAcceptDelivery.tsx:105`, `src/pages/admin/AdminFinancialReports.tsx:213`, `src/pages/NotFound.tsx:8`

Detalhes internos de Edge Functions e estrutura de dados financeiros visíveis no DevTools.

**Recomendação:** Substituir por logging estruturado server-side (Sentry, LogFlare).

---

### 🟢 BAIXO — SEC-022: Email do Motorista Atualizado como Fire-and-Forget

**Arquivo:** `src/pages/driver/DriverSetup.tsx:~572`

```typescript
auth.updateUser({ email }).catch(() => {})  // falha silenciosa
```

Falha silenciosa pode gerar email inconsistente entre `auth.users` e o formulário.

**Recomendação:** Tratar o erro e exibir feedback ao usuário.

---

### 🟢 BAIXO — SEC-023: Inconsistência de Status em `pickup-delivery` Edge Function

**Arquivo:** `supabase/functions/pickup-delivery/index.ts`

`DriverDashboard` redireciona para pickup com status `accepted` e `picking_up`, mas a Edge Function só aceita `accepted`. Motoristas com status `picking_up` recebem erros inesperados.

**Recomendação:** Adicionar `picking_up` como status aceito na Edge Function.

---

### ⚠️ HISTÓRICO — SEC-H01: Escalada de Privilégio para Admin (PATCHADO, Auditoria Necessária)

**Arquivo:** `supabase/migrations/20251021021724_*.sql` (vulnerável)  
**Patch:** `supabase/migrations/20260113002050_*.sql`  
**Janela de Vulnerabilidade:** 21/10/2025 a 13/01/2026

**O que era a vulnerabilidade:**  
```sql
-- Policy original (REMOVIDA):
CREATE POLICY "Users can insert their first role"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
-- Sem restrição sobre qual role → qualquer usuário podia inserir role='admin'
```

**Como foi corrigida:**  
```sql
-- Policy atual:
CREATE POLICY "Users can insert their first non-admin role"
  ON public.user_roles FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND role IN ('restaurant'::app_role, 'driver'::app_role)
    AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );
```

**Ação necessária:**  
Auditar a tabela `user_roles` no banco para identificar usuários com `role = 'admin'` que não são administradores legítimos:
```sql
SELECT ur.user_id, ur.role, ur.created_at, p.email
FROM user_roles ur
JOIN auth.users p ON p.id = ur.user_id
WHERE ur.role = 'admin'
ORDER BY ur.created_at;
```

---

### ℹ️ INFO — SEC-I01: Logs com Dados Financeiros nas Edge Functions

**Arquivo:** `supabase/functions/complete-delivery/index.ts`

```typescript
console.log(`  - Driver Earnings (80%): R$${result.driver_earnings}`)
console.log(`  - Platform Fee (20%): R$${result.platform_fee}`)
```

Valores financeiros e IDs de entrega aparecem nos logs do Supabase Dashboard. Quem tem acesso ao painel pode ver transações individuais.

---

### ℹ️ INFO — SEC-I02: Sem Rate Limiting Visível

Nenhuma Edge Function ou RPC implementa rate limiting. Operações como `block_delivery_funds`, `create_notification` e `send-push` podem ser executadas em loop sem limitação.

---

### ℹ️ INFO — SEC-I03: Chave Anon do Supabase Exposta no Bundle (Comportamento Esperado)

A `VITE_SUPABASE_PUBLISHABLE_KEY` (chave `anon`) é pública por design no Supabase. Por si só não é vulnerabilidade — a segurança real vem das RLS policies. Mas amplifica o impacto de falhas de RLS.

---

### ℹ️ INFO — SEC-I04: Proteção de Rotas Admin é Exclusivamente Client-Side

**Arquivo:** `src/lib/AdminRoute.tsx`

O controle de acesso a `/admin/*` no frontend é baseado em redirecionamento de navegação. A segurança real **deve** estar nas RLS policies do banco. Ver checklist abaixo.

---

### ℹ️ INFO — SEC-I05: Bucket `driver-documents` Privado (Correto)

Documentos dos motoristas (CNH, selfie) estão em bucket privado. Acesso apenas via signed URLs. Nenhuma ação necessária.

---

## Checklist de Remediação por Prioridade

### Antes de qualquer deploy em produção

- [ ] **SEC-001:** Adicionar ownership check dentro de `accept_delivery_atomic` **ou** revogar `GRANT TO authenticated`
- [ ] **SEC-002:** Adicionar autenticação Bearer na Edge Function `send-push`
- [ ] **SEC-003:** Adicionar verificação de admin na RPC `add_restaurant_funds`
- [ ] **SEC-004:** Remover GRANT público de `increment_driver_points`
- [ ] **SEC-005:** Remover PII (CPF, endereço, placa) do `localStorage` — usar `sessionStorage` ou draft server-side
- [ ] **SEC-H01:** Auditar tabela `user_roles` para contas com role `admin` ilegítimas
- [ ] **SEC-015:** Definir `VITE_APP_ENV=production` no build de produção; ativar validação de CPF e confirmação de email

### Alta prioridade (próximo sprint)

- [ ] **SEC-006:** Mover cálculo e escrita de rating para RPC server-side
- [ ] **SEC-007:** Restringir INSERT em `delivery_status_history` a participantes da entrega
- [ ] **SEC-008:** Adicionar verificação de autorização na RPC `create_notification`
- [ ] **SEC-009:** Remover exposição pública de `register_referral` e `process_referral_completion`
- [ ] **SEC-010:** Substituir CORS `*` pela origem de produção
- [ ] **SEC-011:** Adicionar ownership check dentro de `block_delivery_funds` e `refund_delivery_funds`

### Média prioridade

- [ ] **SEC-012:** Validar `sender_role` server-side em `delivery_messages`
- [ ] **SEC-013:** Adicionar verificação de participação na rota `/chat/:deliveryId`
- [ ] **SEC-014:** Reduzir cache de role para 60s ou invalidar via Realtime
- [ ] **SEC-016:** Implementar Content Security Policy rigorosa
- [ ] **SEC-017:** Restringir Google Maps API Key a domínios autorizados no Google Cloud Console
- [ ] **SEC-018:** Derivar `cancelled_by_role` server-side
- [ ] **SEC-019:** Verificar/adicionar RLS adequada em `saved_addresses`
- [ ] **SEC-020:** Atualizar `supabase-js` nas Edge Functions para `^2.76.x`

### Baixa prioridade / housekeeping

- [ ] **SEC-021:** Substituir `console.error` por logging estruturado server-side
- [ ] **SEC-022:** Tratar erro de atualização de email no `DriverSetup`
- [ ] **SEC-023:** Adicionar status `picking_up` na Edge Function `pickup-delivery`

---

*Auditoria realizada por análise estática de código. Não foram feitas alterações em código, banco de dados, migrações ou Edge Functions. Todos os achados devem ser verificados e corrigidos em ambiente de desenvolvimento antes de qualquer deploy em produção.*
