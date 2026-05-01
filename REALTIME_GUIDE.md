# 📡 Guia Completo de Realtime - Sistema Movvi

## Status da Implementação

✅ **TODOS os hooks Realtime foram reforçados com:**
- Reconexão automática (até 5 tentativas)
- Debounce para evitar atualizações excessivas
- Logs detalhados para debug
- Gerenciamento correto de subscribe/unsubscribe
- Status de conexão exposto
- Limpeza adequada de recursos

## 🔧 Hooks Implementados

### 1. `useRealtimeDeliveries` ✅
**Localização:** `src/hooks/useRealtimeDeliveries.tsx`

**Funcionalidades:**
- Escuta mudanças em entregas (INSERT, UPDATE, DELETE)
- Reconexão automática com backoff
- Debounce de 300ms
- Notificações toast automáticas
- Filtros por restaurante ou motorista

**Exemplo de uso:**
```typescript
const { connectionStatus, isConnected, reconnect } = useRealtimeDeliveries({
  restaurantId: restaurant.id,
  showNotifications: true,
  enabled: true,
  onUpdate: (delivery) => {
    // Atualizar estado
    setDeliveries(prev => prev.map(d => 
      d.id === delivery.id ? delivery : d
    ));
  },
});
```

**Logs no console:**
```
[Realtime] useRealtimeDeliveries initialized
[Realtime] Setting up channel...
[Realtime] ✅ Successfully subscribed to deliveries
[Realtime] Delivery UPDATE received
[Realtime] 🧹 Cleaning up channel...
```

### 2. `useRealtimeDriverLocation` ✅
**Localização:** `src/hooks/useRealtimeDriverLocation.tsx`

**Funcionalidades:**
- Rastreamento de localização do motorista
- Histórico de localizações
- Debounce de 500ms (específico para localizações)
- Reconexão automática

**Exemplo de uso:**
```typescript
const { 
  currentLocation, 
  locationHistory, 
  isConnected,
  refetch 
} = useRealtimeDriverLocation(deliveryId, true);
```

**Logs no console:**
```
[Realtime Location] Hook initialized
[Location] Fetching initial location
[Location] ✅ Initial location fetched
[Location] 📍 New location received
```

### 3. `useNotifications` ✅
**Localização:** `src/hooks/useNotifications.tsx`

**Funcionalidades:**
- Notificações em tempo real
- Contador de não lidas
- Notificações do navegador (browser notifications)
- Reconexão automática
- Funções para marcar como lida

**Exemplo de uso:**
```typescript
const { 
  notifications, 
  unreadCount, 
  isConnected,
  markAsRead,
  markAllAsRead 
} = useNotifications();
```

**Logs no console:**
```
[Notifications] Hook initialized
[Notifications] Fetching notifications
[Notifications] 🔔 New notification received
[Notifications] ✅ Browser notification shown
```

### 4. `useNearbyDeliveries` ✅
**Localização:** `src/hooks/useNearbyDeliveries.tsx`

**Funcionalidades:**
- Lista entregas pendentes próximas
- Cálculo automático de distância
- Debounce de 500ms
- Atualização em tempo real

**Exemplo de uso:**
```typescript
const { deliveries, loading } = useNearbyDeliveries({
  driverId: driver.id,
  isAvailable: true,
  maxDistanceKm: 20,
});
```

**Logs no console:**
```
[NearbyDeliveries] Setting up realtime subscription
[NearbyDeliveries] 🔄 Delivery change detected
[NearbyDeliveries] Refetching deliveries after change
```

## 🎯 Páginas Atualizadas

### DeliveryTracking ✅
**Localização:** `src/pages/restaurant/DeliveryTracking.tsx`

- Subscrição melhorada com logs
- Gerenciamento adequado de canal único
- Status de conexão monitorado

**Logs:**
```
[DeliveryTracking] Setting up realtime subscription
[DeliveryTracking] 🔄 Delivery updated
[DeliveryTracking] 🧹 Cleaning up subscription
```

### RestaurantDashboard ✅
**Localização:** `src/pages/restaurant/RestaurantDashboard.tsx`

- Removida subscrição duplicada
- Agora usa apenas `useRealtimeDeliveries`
- Melhor performance e menos conexões WebSocket

## 🔍 Como Debugar

### 1. Console do Navegador
Abra o console (F12) e procure por:
- `[Realtime]` - Logs gerais de entregas
- `[Location]` - Logs de localização
- `[Notifications]` - Logs de notificações
- `[NearbyDeliveries]` - Logs de entregas próximas

### 2. Verificar Status de Conexão
```typescript
const { connectionStatus, isConnected } = useRealtimeDeliveries(...);

console.log('Status:', connectionStatus); // CONNECTED, DISCONNECTED, ERROR
console.log('Conectado?', isConnected);   // true/false
```

### 3. Forçar Reconexão
```typescript
const { reconnect } = useRealtimeDeliveries(...);

// Em caso de problemas
reconnect();
```

## ⚙️ Configuração do Supabase

### Tabelas com Realtime Habilitado ✅

```sql
-- Verificar status (já configurado)
ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
```

## 📊 Métricas e Performance

### Debounce Configurado
- **Entregas**: 300ms (evita atualizações excessivas)
- **Localizações**: 500ms (otimizado para GPS)
- **Notificações**: Sem debounce (máxima prioridade)

### Reconexão
- **Tentativas**: 5 máximo
- **Delay**: 3 segundos entre tentativas
- **Backoff**: Exponencial (planejado para próxima versão)

## 🚨 Troubleshooting

### Problema: Não recebe atualizações
**Verificar:**
1. `connectionStatus === 'CONNECTED'`?
2. Filtros corretos (restaurantId, driverId)?
3. RLS policies permitem SELECT?
4. Logs no console mostram subscrição?

**Solução:**
```typescript
// Verificar logs
console.log('Connection:', connectionStatus);

// Forçar reconexão
reconnect();

// Verificar filtros
console.log('Filter:', { restaurantId, driverId });
```

### Problema: "Max reconnection attempts reached"
**Causa:** Falha persistente na conexão

**Solução:**
1. Recarregar a página
2. Verificar internet
3. Verificar se Supabase está online
4. Verificar RLS policies

### Problema: Muitas atualizações (loop infinito)
**Causa:** Callback causa re-render que dispara nova subscrição

**Solução:**
```typescript
// ❌ Errado
useRealtimeDeliveries({
  onUpdate: () => {
    fetchDeliveries(); // Pode causar loop
  }
});

// ✅ Correto
const debouncedFetch = useMemo(
  () => debounce(fetchDeliveries, 1000),
  []
);

useRealtimeDeliveries({
  onUpdate: debouncedFetch
});
```

## 📈 Próximas Melhorias

- [ ] Exponential backoff na reconexão
- [ ] Métricas de performance (latência, pacotes perdidos)
- [ ] Cache local com sincronização otimista
- [ ] Compressão de dados para localizações
- [ ] Batch updates para múltiplas mudanças

## ✅ Checklist de Integração

Ao adicionar Realtime em novo componente:

1. [ ] Usar hook existente ao invés de criar subscrição direta
2. [ ] Verificar se `enabled` está correto
3. [ ] Adicionar tratamento de `connectionStatus` na UI
4. [ ] Testar reconexão (desconectar internet)
5. [ ] Verificar logs no console
6. [ ] Garantir cleanup correto (useEffect return)
7. [ ] Adicionar debounce se necessário

## 🎓 Exemplo Completo

```typescript
import { useRealtimeDeliveries } from '@/hooks/useRealtimeDeliveries';
import { Badge } from '@/components/ui/badge';

function DeliveryList({ restaurantId }: { restaurantId: string }) {
  const [deliveries, setDeliveries] = useState([]);
  
  const { connectionStatus, isConnected } = useRealtimeDeliveries({
    restaurantId,
    enabled: !!restaurantId,
    showNotifications: true,
    onUpdate: (delivery) => {
      setDeliveries(prev => 
        prev.map(d => d.id === delivery.id ? delivery : d)
      );
    },
    onInsert: (delivery) => {
      setDeliveries(prev => [delivery, ...prev]);
    },
  });

  return (
    <div>
      {/* Indicador de conexão */}
      <Badge variant={isConnected ? 'default' : 'destructive'}>
        {connectionStatus}
      </Badge>

      {/* Lista de entregas */}
      {deliveries.map(delivery => (
        <DeliveryCard key={delivery.id} delivery={delivery} />
      ))}
    </div>
  );
}
```

---

**Última atualização:** 2025-11-29
**Status:** ✅ Produção Ready
