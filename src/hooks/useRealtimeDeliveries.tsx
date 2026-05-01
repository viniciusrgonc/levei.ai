import { useEffect, useRef, useCallback, useState } from 'react';
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
  enabled?: boolean;
}

type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export const useRealtimeDeliveries = ({
  onUpdate,
  onInsert,
  onDelete,
  showNotifications = true,
  restaurantId,
  driverId,
  enabled = true,
}: UseRealtimeDeliveriesParams = {}) => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('DISCONNECTED');

  // Stable refs for callbacks — break dep cycle, avoid channel churn
  const onUpdateRef = useRef(onUpdate);
  const onInsertRef = useRef(onInsert);
  const onDeleteRef = useRef(onDelete);
  const showNotificationsRef = useRef(showNotifications);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);
  useEffect(() => { onInsertRef.current = onInsert; }, [onInsert]);
  useEffect(() => { onDeleteRef.current = onDelete; }, [onDelete]);
  useEffect(() => { showNotificationsRef.current = showNotifications; }, [showNotifications]);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000; // 3 seconds
  const DEBOUNCE_DELAY = 300; // 300ms

  // Debounced callback wrapper
  const debounce = useCallback((callback: () => void, delay: number) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(callback, delay);
  }, []);

  const setupChannel = useCallback(() => {
    if (!enabled) return null;

    setConnectionStatus('CONNECTING');

    // Criar filtro baseado nos parâmetros
    let filter = '';
    if (restaurantId) {
      filter = `restaurant_id=eq.${restaurantId}`;
    } else if (driverId) {
      filter = `driver_id=eq.${driverId}`;
    }

    // Nome de canal estável (determinístico, sem Date.now)
    const channelName = `deliveries-rt-${restaurantId || driverId || 'all'}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries',
          ...(filter && { filter }),
        },
        (payload) => {
          const delivery = payload.new as DeliveryUpdate;

          // Debounce para evitar atualizações múltiplas
          debounce(() => {
            // Notificações para mudanças de status
            if (showNotificationsRef.current && payload.old?.status !== delivery.status) {
              const notifications: Record<string, { title: string; description: string; variant?: 'default' | 'destructive' }> = {
                accepted: {
                  title: 'Entregador a caminho! 🚗',
                  description: 'Um entregador aceitou sua entrega e está indo buscar o pedido.',
                },
                picked_up: {
                  title: 'Pedido coletado! 📦',
                  description: 'O entregador coletou o pedido e está a caminho da entrega.',
                },
                delivered: {
                  title: 'Entrega concluída! ✨',
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

            // Callback via ref (estável, não causa re-subscribe)
            onUpdateRef.current?.(delivery);
          }, DEBOUNCE_DELAY);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'deliveries',
          ...(filter && { filter }),
        },
        (payload) => {
          const delivery = payload.new as DeliveryUpdate;

          debounce(() => {
            if (showNotificationsRef.current && driverId && delivery.driver_id === driverId) {
              toast({
                title: 'Nova entrega disponível! 🆕',
                description: 'Uma nova entrega está disponível na sua região.',
              });
            }

            onInsertRef.current?.(delivery);
          }, DEBOUNCE_DELAY);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'deliveries',
          ...(filter && { filter }),
        },
        (payload) => {
          const delivery = payload.old as DeliveryUpdate;
          debounce(() => {
            onDeleteRef.current?.(delivery);
          }, DEBOUNCE_DELAY);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('CONNECTED');
          reconnectAttemptsRef.current = 0;
        } else if (status === 'CLOSED') {
          setConnectionStatus('DISCONNECTED');
          attemptReconnect();
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionStatus('ERROR');
          attemptReconnect();
        }
      });

    return channel;
  }, [enabled, restaurantId, driverId, debounce]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[Realtime] ⚠️ Max reconnection attempts reached — running in polling-only mode');
      setConnectionStatus('ERROR');
      return;
    }

    reconnectAttemptsRef.current++;

    reconnectTimeoutRef.current = setTimeout(() => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      channelRef.current = setupChannel();
    }, RECONNECT_DELAY);
  }, [setupChannel]);

  const cleanup = useCallback(() => {

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setConnectionStatus('DISCONNECTED');
  }, []);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    channelRef.current = setupChannel();

    return cleanup;
    // restaurantId/driverId changes rebuild the channel via setupChannel dep chain
  }, [enabled, restaurantId, driverId, setupChannel, cleanup]);

  return {
    channel: channelRef.current,
    connectionStatus,
    isConnected: connectionStatus === 'CONNECTED',
    reconnect: () => {
      reconnectAttemptsRef.current = 0;
      cleanup();
      channelRef.current = setupChannel();
    },
  };
};
