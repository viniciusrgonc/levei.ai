# 💰 Sistema de Carteiras e Transações - Movvi (com Escrow)

## Implementação Completa ✅

Sistema de wallets com **escrow interno (saldo bloqueado)** e lógica 80/20 (motorista/plataforma) totalmente atômico.

---

## 🏗️ Arquitetura

### Tabelas Principais

#### 1. **restaurants**
- `wallet_balance` (NUMERIC): Saldo disponível para novas entregas
- `blocked_balance` (NUMERIC): Saldo bloqueado em entregas em andamento
- O total do cliente é: `wallet_balance + blocked_balance`

#### 2. **drivers**
- `earnings_balance` (NUMERIC): Ganhos disponíveis (80% das entregas concluídas)
- `pending_balance` (NUMERIC): Ganhos pendentes (entregas em andamento)

#### 3. **transactions**
- Registro completo de todas as movimentações financeiras
- Campos: `amount`, `type`, `driver_earnings`, `platform_fee`, `description`
- Tipos (enum): `delivery_payment`, `platform_fee`, `withdrawal`, `escrow_block`, `escrow_release`, `escrow_refund`

#### 4. **platform_fees** (NOVO)
- Tabela dedicada para rastrear taxas acumuladas da plataforma
- Campos: `id`, `delivery_id`, `amount`, `created_at`
- Permite visualização do total acumulado no painel admin

#### 5. **deliveries.financial_status** (NOVO)
- Enum: `blocked`, `refunded`, `transferring`, `paid`
- Rastreia o estado financeiro de cada entrega

---

## 🔄 Fluxo Financeiro com Escrow

### Estados Financeiros:
1. **blocked**: Valor bloqueado do saldo do solicitante ao criar entrega
2. **refunded**: Valor estornado ao solicitante após cancelamento
3. **transferring**: Em processo de transferência (uso futuro)
4. **paid**: Valor liberado ao entregador após conclusão

---

## 📋 Regras de Negócio

### 1. Criação da Entrega
```
- Valor total é BLOQUEADO no saldo do solicitante
- NÃO é repassado ao entregador ainda
- wallet_balance diminui
- blocked_balance aumenta
- financial_status = 'blocked'
- Transação tipo 'escrow_block' é registrada
```

### 2. Cancelamento (antes da coleta)
```
- Se status = 'pending' ou 'accepted':
  - Valor bloqueado retorna 100% ao saldo disponível
  - Nenhuma taxa aplicada
  - blocked_balance diminui
  - wallet_balance aumenta
  - financial_status = 'refunded'
  - Transação tipo 'escrow_refund' é registrada
```

### 3. Durante a Coleta/Entrega
```
- Valor permanece bloqueado
- Nenhuma movimentação financeira
- financial_status continua 'blocked'
```

### 4. Conclusão da Entrega
```
- Após confirmação de entrega:
  - 80% do valor vai para earnings_balance do motorista
  - 20% é registrado como taxa da plataforma
  - blocked_balance do restaurante é zerado
  - financial_status = 'paid'
  - 3 transações criadas:
    1. escrow_release (débito final do restaurante)
    2. delivery_payment (crédito do motorista 80%)
    3. platform_fee (taxa da plataforma 20%)
  - Registro em platform_fees para total acumulado
```

---

## 🔧 Funções de Banco de Dados

### 1. `block_delivery_funds(p_restaurant_id, p_delivery_id, p_amount)`
Bloqueia o valor no momento da criação da entrega.

**Processo:**
1. Lock no restaurante
2. Verifica saldo disponível
3. Move de wallet_balance para blocked_balance
4. Atualiza financial_status para 'blocked'
5. Cria transação tipo 'escrow_block'

### 2. `refund_delivery_funds(p_delivery_id)`
Estorna o valor em caso de cancelamento.

**Processo:**
1. Lock na entrega
2. Verifica se status permite cancelamento (pending/accepted)
3. Verifica se financial_status = 'blocked'
4. Move de blocked_balance de volta para wallet_balance
5. Atualiza status para 'cancelled', financial_status para 'refunded'
6. Cria transação tipo 'escrow_refund'

### 3. `finalize_delivery_transaction(p_delivery_id, p_driver_id)`
Libera o valor após conclusão da entrega.

**Processo:**
1. Lock na entrega
2. Validações (status, motorista, financial_status)
3. Calcula 80/20
4. Remove de blocked_balance do restaurante
5. Adiciona em earnings_balance do motorista
6. Atualiza status para 'delivered', financial_status para 'paid'
7. Insere em platform_fees
8. Cria 3 transações

---

## 💳 Interfaces Atualizadas

### 1. **RestaurantWallet** (`/restaurant/wallet`) ✅

**Funcionalidades:**
- **Saldo Disponível** (card verde): wallet_balance
- **Saldo Bloqueado** (card âmbar): blocked_balance - em entregas em andamento
- Formulário para adicionar saldo
- Histórico de transações com tipos de escrow

### 2. **DriverWallet** (`/driver/wallet`) ✅

**Funcionalidades:**
- **Saldo Disponível**: earnings_balance
- **Saldo Pendente**: pending_balance (entregas em andamento)
- Total de ganhos
- Histórico detalhado

### 3. **AdminFinancialReports** (`/admin/financial-reports`) ✅

**Funcionalidades:**
- **Total Acumulado da Plataforma**: soma de todos os registros em platform_fees
- Receita por período
- Taxa da plataforma (20%)
- Pagamentos a entregadores (80%)
- Gráficos e exportação

---

## 🔐 Segurança

### RLS Policies
- **platform_fees**: Apenas admins podem visualizar
- **transactions**: Admins veem todas, motoristas veem as suas
- **restaurants/drivers**: Usuários veem apenas seus próprios dados

### Functions SECURITY DEFINER
- Todas as funções de escrow executam com privilégios elevados
- Usam `SET search_path = 'public'`
- Validam ownership antes de processar

---

## 🧪 Fluxo de Teste

### 1. Restaurante adiciona R$ 100
```
wallet_balance: R$ 100
blocked_balance: R$ 0
```

### 2. Cria entrega de R$ 30
```
wallet_balance: R$ 70 (-30)
blocked_balance: R$ 30 (+30)
financial_status: 'blocked'
```

### 3a. Se CANCELAR (antes da coleta):
```
wallet_balance: R$ 100 (+30 estornado)
blocked_balance: R$ 0 (-30)
financial_status: 'refunded'
```

### 3b. Se CONCLUIR entrega:
```
wallet_balance: R$ 70 (inalterado)
blocked_balance: R$ 0 (-30)
financial_status: 'paid'

Motorista earnings_balance: +R$ 24 (80%)
platform_fees total: +R$ 6 (20%)
```

---

## 📊 Tipos de Transação

| Tipo | Descrição |
|------|-----------|
| `escrow_block` | Bloqueio de valor na criação da entrega |
| `escrow_refund` | Estorno por cancelamento |
| `escrow_release` | Liberação do escrow na conclusão |
| `delivery_payment` | Pagamento ao motorista (80%) |
| `platform_fee` | Taxa da plataforma (20%) |
| `withdrawal` | Saque (futuro) |

---

## ✅ Checklist de Implementação

### Database ✅
- [x] Enum `financial_status` criado
- [x] Campo `blocked_balance` em restaurants
- [x] Campo `pending_balance` em drivers
- [x] Campo `financial_status` em deliveries
- [x] Tabela `platform_fees` criada
- [x] Novos tipos em `transaction_type` enum
- [x] Função `block_delivery_funds`
- [x] Função `refund_delivery_funds`
- [x] Função `finalize_delivery_transaction` atualizada
- [x] RLS policies configuradas

### Frontend ✅
- [x] RestaurantWallet mostra saldo disponível e bloqueado
- [x] DriverWallet mostra saldo disponível e pendente
- [x] NewDelivery bloqueia fundos via RPC
- [x] CancelDeliveryModal usa refund_delivery_funds
- [x] AdminFinancialReports mostra total acumulado plataforma

---

**Status:** ✅ Sistema de Escrow completo e funcional
**Última atualização:** 2025-12-20
