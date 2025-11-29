# 💰 Sistema de Carteiras e Transações - Movvi

## Implementação Completa ✅

Sistema de wallets com lógica 80/20 (motorista/plataforma) totalmente atômico e com logs detalhados.

---

## 🏗️ Arquitetura

### Tabelas Principais

#### 1. **restaurants**
- `wallet_balance` (NUMERIC): Saldo disponível para pagar entregas
- Atualizado atomicamente na conclusão da entrega

#### 2. **drivers**
- `earnings_balance` (NUMERIC): Ganhos acumulados (80% das entregas)
- Creditado automaticamente ao finalizar entrega

#### 3. **transactions**
- Registro completo de todas as movimentações financeiras
- Campos: `amount`, `type`, `driver_earnings`, `platform_fee`, `description`
- Tipos (enum): `delivery_payment`, `platform_fee`, `withdrawal`

---

## 🔄 Fluxo de Transação Atômica

### Função DB: `finalize_delivery_transaction`

**Localização:** Migration no Supabase

**Parâmetros:**
- `p_delivery_id` (UUID): ID da entrega
- `p_driver_id` (UUID): ID do motorista

**Processo (ATÔMICO):**

```
1. LOCK na entrega (FOR UPDATE) - evita race conditions
2. Validações:
   ✓ Entrega existe?
   ✓ Status = 'picked_up'?
   ✓ Motorista correto?
   ✓ Restaurante tem saldo suficiente?

3. Cálculos:
   - Taxa plataforma: 20% do valor ajustado
   - Ganho motorista: 80% do valor ajustado

4. LOCKS nos wallets:
   - LOCK no wallet do restaurante
   - LOCK no wallet do motorista

5. Atualizações (TODAS ou NENHUMA):
   a) Deduzir do restaurante
   b) Creditar motorista (80%)
   c) Atualizar status da entrega para 'delivered'
   d) Criar 3 transações:
      - Débito do restaurante (-100%)
      - Crédito do motorista (+80%)
      - Taxa da plataforma (+20%)

6. Retorno detalhado com saldos before/after
```

**Em caso de erro:** ROLLBACK automático - nada é alterado

---

## 📡 Edge Functions

### 1. `complete-delivery` ✅

**Endpoint:** `https://[project].supabase.co/functions/v1/complete-delivery`

**Método:** POST

**Body:**
```json
{
  "delivery_id": "uuid",
  "driver_id": "uuid"
}
```

**Processo:**
1. Valida autenticação
2. Verifica ownership do motorista
3. Chama `finalize_delivery_transaction` (atômica)
4. Envia notificação ao restaurante
5. Retorna detalhes da transação

**Logs detalhados:**
```
[Complete-Delivery] {request-id} - New request received
[Complete-Delivery] {request-id} - User authenticated
[Complete-Delivery] {request-id} - Driver verified
[Complete-Delivery] {request-id} - Calling finalize_delivery_transaction
[Complete-Delivery] {request-id} - ✅ Transaction completed successfully
  - Total Amount: R$XX.XX
  - Driver Earnings (80%): R$XX.XX
  - Platform Fee (20%): R$XX.XX
  - Restaurant Balance: R$XX.XX → R$XX.XX
  - Driver Balance: R$XX.XX → R$XX.XX
```

### 2. `add_restaurant_funds` (DB Function) ✅

**Uso via RPC:**
```typescript
const { data } = await supabase.rpc('add_restaurant_funds', {
  p_restaurant_id: 'uuid',
  p_amount: 100.00
});
```

**Processo:**
1. Adiciona saldo ao wallet do restaurante
2. Cria transação de tipo `delivery_payment` (recarga)
3. Retorna novo saldo

---

## 💳 Interfaces Implementadas

### 1. **RestaurantWallet** (`/restaurant/wallet`) ✅

**Funcionalidades:**
- Exibe saldo disponível em card destacado
- Formulário para adicionar saldo
- Histórico de transações (últimas 20)
- Diferenciação visual: verde (créditos) / vermelho (débitos)

**Hook usado:** `useAddFunds`

### 2. **DriverWallet** (`/driver/wallet`) ✅

**Funcionalidades:**
- Exibe saldo de ganhos (earnings_balance)
- Estatísticas: total de ganhos, entregas pagas
- Histórico detalhado com breakdown 80/20
- Mostra: valor total, quanto recebeu (80%), taxa (20%)

### 3. **AdminTransactions** (`/admin/transactions`) ✅ NOVO

**Funcionalidades:**
- Dashboard com 4 cards de estatísticas:
  - Total de transações
  - Total de taxas da plataforma (20%)
  - Total pago aos motoristas (80%)
  - Total de pagamentos
- Filtro por tipo de transação
- Lista completa de transações com detalhes
- Badges coloridos por tipo
- Breakdown de valores em cada transação

**Filtros disponíveis:**
- Todas
- Pagamentos (delivery_payment)
- Taxas (platform_fee)
- Saques (withdrawal)

---

## 🔐 Segurança

### RLS Policies

**transactions table:**
- Admins: podem ver TODAS as transações
- Motoristas: podem ver apenas SUAS transações
- Restaurantes: implícito via queries diretas

### Functions com SECURITY DEFINER:
- `finalize_delivery_transaction`: Executa com privilégios elevados
- `add_restaurant_funds`: Executa com privilégios elevados
- Ambas usam `SET search_path = 'public'` para segurança

### Proteções Implementadas:
- ✅ Validação de ownership (motorista pertence ao usuário)
- ✅ Verificação de saldo antes de processar
- ✅ Transações atômicas (todas ou nenhuma)
- ✅ Locks para evitar race conditions
- ✅ Rollback automático em caso de erro

---

## 🧪 Como Testar

### 1. Adicionar Saldo ao Restaurante
```typescript
// Via interface ou programaticamente
await supabase.rpc('add_restaurant_funds', {
  p_restaurant_id: 'restaurant-uuid',
  p_amount: 100.00
});

// Verificar no wallet do restaurante
// Deve aparecer: +R$ 100.00 - "Recarga de saldo na carteira"
```

### 2. Criar e Finalizar Entrega
```typescript
// 1. Restaurante cria entrega (price_adjusted = R$ 50.00)
// 2. Motorista aceita
// 3. Motorista coleta
// 4. Motorista finaliza

await supabase.functions.invoke('complete-delivery', {
  body: {
    delivery_id: 'delivery-uuid',
    driver_id: 'driver-uuid'
  }
});

// Resultados esperados:
// - Restaurante: -R$ 50.00
// - Motorista: +R$ 40.00 (80%)
// - Plataforma: +R$ 10.00 (20%)
// - 3 transações criadas
```

### 3. Verificar no Admin
```
/admin/transactions

Stats esperados:
- Total Transações: 4 (1 recarga + 3 da entrega)
- Taxas: R$ 10.00
- Motoristas: R$ 40.00
- Pagamentos: R$ 50.00
```

---

## 📊 Estrutura de Transações

### Ao Adicionar Saldo (Restaurante)
```json
{
  "restaurant_id": "uuid",
  "amount": 100.00,
  "type": "delivery_payment",
  "description": "Recarga de saldo na carteira",
  "driver_earnings": null,
  "platform_fee": null
}
```

### Ao Finalizar Entrega (3 transações criadas)

**1. Débito do Restaurante:**
```json
{
  "restaurant_id": "uuid",
  "delivery_id": "uuid",
  "amount": -50.00,
  "type": "delivery_payment",
  "description": "Pagamento de entrega #uuid",
  "driver_earnings": null,
  "platform_fee": null
}
```

**2. Crédito do Motorista (80%):**
```json
{
  "driver_id": "uuid",
  "delivery_id": "uuid",
  "amount": 40.00,
  "driver_earnings": 40.00,
  "type": "delivery_payment",
  "description": "Recebimento de entrega (80%)",
  "platform_fee": null
}
```

**3. Taxa da Plataforma (20%):**
```json
{
  "delivery_id": "uuid",
  "amount": 10.00,
  "platform_fee": 10.00,
  "type": "platform_fee",
  "description": "Taxa da plataforma (20%)",
  "driver_earnings": null
}
```

---

## 🚨 Tratamento de Erros

### Saldo Insuficiente
```json
{
  "success": false,
  "error": "Restaurante não possui saldo suficiente",
  "required": 50.00,
  "available": 30.00
}
```

**O que acontece:**
- Nenhuma alteração é feita
- Frontend exibe erro ao usuário
- Restaurante precisa adicionar fundos

### Status Incorreto
```json
{
  "success": false,
  "error": "Entrega não está no status correto para conclusão"
}
```

### Ownership Inválido
```json
{
  "success": false,
  "error": "Entrega não está atribuída a este motorista"
}
```

---

## 📈 Melhorias Futuras

- [ ] Sistema de saques para motoristas
- [ ] Integração com gateway de pagamento (Stripe/Mercado Pago)
- [ ] Reembolsos automáticos em caso de cancelamento
- [ ] Relatórios financeiros exportáveis (PDF/CSV)
- [ ] Dashboard de receitas para admin
- [ ] Histórico de saldos ao longo do tempo (gráficos)
- [ ] Alertas de saldo baixo para restaurantes
- [ ] Comissões variáveis por categoria/distância

---

## ✅ Checklist de Implementação

### Database ✅
- [x] Função `finalize_delivery_transaction` (atômica)
- [x] Função `add_restaurant_funds` corrigida
- [x] Enums corretos nas transactions
- [x] RLS policies configuradas
- [x] Logs em todas as operações

### Edge Functions ✅
- [x] `complete-delivery` usando função atômica
- [x] Validações de ownership e saldo
- [x] Logs detalhados com request-id
- [x] Notificações ao restaurante
- [x] Tratamento de erros

### Frontend ✅
- [x] RestaurantWallet com adicionar saldo
- [x] DriverWallet com histórico detalhado
- [x] AdminTransactions com stats e filtros
- [x] Hooks useAddFunds
- [x] Rota `/admin/transactions` adicionada
- [x] Menu admin atualizado

---

**Status:** ✅ Sistema completo e funcional
**Última atualização:** 2025-11-29
