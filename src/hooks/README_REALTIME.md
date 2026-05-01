# Hook useRealtimeDeliveries

Hook React para escutar mudanças em tempo real na tabela `deliveries` usando Supabase Realtime.

## Características

- ✅ Escuta eventos INSERT, UPDATE e DELETE
- ✅ Filtragem por restaurante ou motorista
- ✅ Notificações automáticas para mudanças de status
- ✅ Callbacks customizáveis
- ✅ Cleanup automático ao desmontar

## Uso Básico

```typescript
import { useRealtimeDeliveries } from '@/hooks/useRealtimeDeliveries';

function MyComponent() {
  const [deliveries, setDeliveries] = useState([]);

  useRealtimeDeliveries({
    restaurantId: 'restaurant-uuid', // Opcional: filtrar por restaurante
    showNotifications: true,
    onUpdate: (delivery) => {
      console.log('Entrega atualizada:', delivery);
      // Atualizar lista local
      setDeliveries(prev => 
        prev.map(d => d.id === delivery.id ? { ...d, ...delivery } : d)
      );
    },
    onInsert: (delivery) => {
      console.log('Nova entrega:', delivery);
      // Adicionar à lista
      setDeliveries(prev => [...prev, delivery]);
    },
    onDelete: (delivery) => {
      console.log('Entrega removida:', delivery);
      // Remover da lista
      setDeliveries(prev => prev.filter(d => d.id !== delivery.id));
    }
  });

  return <div>...</div>;
}
```

## Parâmetros

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `onUpdate` | `(delivery) => void` | Callback quando uma entrega é atualizada |
| `onInsert` | `(delivery) => void` | Callback quando uma entrega é criada |
| `onDelete` | `(delivery) => void` | Callback quando uma entrega é deletada |
| `showNotifications` | `boolean` | Exibir toasts automáticos (padrão: true) |
| `restaurantId` | `string` | Filtrar entregas de um restaurante específico |
| `driverId` | `string` | Filtrar entregas de um motorista específico |

## Notificações Automáticas

Quando `showNotifications` está ativo, o hook exibe toasts para:

- **Status 'accepted'**: "Motoboy a caminho!"
- **Status 'picked_up'**: "Pedido coletado!"
- **Status 'delivered'**: "Entrega concluída!"
- **Status 'cancelled'**: "Entrega cancelada"

## Exemplo: Dashboard do Restaurante

```typescript
import { useRealtimeDeliveries } from '@/hooks/useRealtimeDeliveries';

function RestaurantDashboard() {
  const [restaurant, setRestaurant] = useState(null);
  
  useRealtimeDeliveries({
    restaurantId: restaurant?.id,
    showNotifications: true,
    onUpdate: (delivery) => {
      // Recarregar lista de entregas
      fetchDeliveries();
    }
  });

  return <div>...</div>;
}
```

## Exemplo: Dashboard do Motorista

```typescript
import { useRealtimeDeliveries } from '@/hooks/useRealtimeDeliveries';

function DriverDashboard() {
  const [driver, setDriver] = useState(null);
  
  useRealtimeDeliveries({
    driverId: driver?.id,
    showNotifications: true,
    onUpdate: (delivery) => {
      // Atualizar entrega ativa
      if (delivery.status === 'delivered') {
        setActiveDelivery(null);
      }
    }
  });

  return <div>...</div>;
}
```

## Exemplo: React Native

```typescript
import { useRealtimeDeliveries } from '@/hooks/useRealtimeDeliveries';
import { Alert } from 'react-native';

function DeliveryScreen() {
  useRealtimeDeliveries({
    restaurantId: restaurantId,
    showNotifications: false, // Desativar toasts
    onUpdate: (delivery) => {
      if (delivery.status === 'accepted') {
        Alert.alert(
          'Motoboy a caminho!',
          'Um motorista aceitou sua entrega.'
        );
      }
      // Atualizar estado local
      setDeliveryList(prev => 
        prev.map(d => d.id === delivery.id ? delivery : d)
      );
    }
  });

  return <View>...</View>;
}
```

## Estrutura do Payload

```typescript
interface DeliveryUpdate {
  id: string;
  status: string;
  driver_id: string | null;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
}
```

## Notas Importantes

- O hook se inscreve automaticamente no canal ao montar
- Faz cleanup automático ao desmontar (unsubscribe)
- Logs no console para debug
- Suporta filtros por restaurante OU motorista
- Não requer configuração adicional no Supabase (já configurado)
