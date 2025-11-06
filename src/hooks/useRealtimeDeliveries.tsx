import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { RealtimeChannel } from '@supabase/supabase-js';

interface DeliveryUpdate {
  id: string;
  status: string;
  driver_id: string | null;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
}

interface UseRealtimeDeliveriesParams {
  onUpdate?: (delivery: DeliveryUpdate) => void;
  onInsert?: (delivery: DeliveryUpdate) => void;
  onDelete?: (delivery: DeliveryUpdate) => void;
  showNotifications?: boolean;
  restaurantId?: string;
  driverId?: string;
}

export const useRealtimeDeliveries = ({
  onUpdate,
  onInsert,
  onDelete,
  showNotifications = true,
  restaurantId,
  driverId,
}: UseRealtimeDeliveriesParams = {}) => {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    // Criar canal de realtime
    const channel = supabase
      .channel('deliveries-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries',
          ...(restaurantId && { filter: `restaurant_id=eq.${restaurantId}` }),
          ...(driverId && { filter: `driver_id=eq.${driverId}` }),
        },
        (payload) => {
          console.log('Delivery updated:', payload);
          const delivery = payload.new as DeliveryUpdate;

          // Notificações para mudanças de status
          if (showNotifications) {
            const notifications: Record<string, { title: string; description: string; variant?: 'default' | 'destructive' }> = {
              accepted: {
                title: 'Entregador a caminho!',
                description: 'Um entregador aceitou sua entrega e está indo buscar o pedido.',
              },
              picking_up: {
                title: 'Coletando pedido!',
                description: 'O entregador está coletando o pedido no local.',
              },
              picked_up: {
                title: 'Pedido coletado!',
                description: 'O entregador coletou o pedido e está a caminho da entrega.',
              },
              delivering: {
                title: 'A caminho!',
                description: 'O entregador está a caminho do destino.',
              },
              delivered: {
                title: 'Entrega concluída!',
                description: 'O pedido foi entregue com sucesso.',
              },
              cancelled: {
                title: 'Entrega cancelada',
                description: 'A entrega foi cancelada.',
                variant: 'destructive',
              },
            };

            const notification = notifications[delivery.status];
            if (notification) {
              toast(notification);
            }
          }

          // Callback customizado
          onUpdate?.(delivery);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'deliveries',
          ...(restaurantId && { filter: `restaurant_id=eq.${restaurantId}` }),
          ...(driverId && { filter: `driver_id=eq.${driverId}` }),
        },
        (payload) => {
          console.log('Delivery inserted:', payload);
          const delivery = payload.new as DeliveryUpdate;

          if (showNotifications && driverId && delivery.driver_id === driverId) {
            toast({
              title: 'Nova entrega disponível!',
              description: 'Uma nova entrega está disponível na sua região.',
            });
          }

          onInsert?.(delivery);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'deliveries',
          ...(restaurantId && { filter: `restaurant_id=eq.${restaurantId}` }),
          ...(driverId && { filter: `driver_id=eq.${driverId}` }),
        },
        (payload) => {
          console.log('Delivery deleted:', payload);
          const delivery = payload.old as DeliveryUpdate;
          onDelete?.(delivery);
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    channelRef.current = channel;

    // Cleanup
    return () => {
      console.log('Unsubscribing from deliveries channel');
      supabase.removeChannel(channel);
    };
  }, [restaurantId, driverId, showNotifications]);

  return {
    channel: channelRef.current,
  };
};
