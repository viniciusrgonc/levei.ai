import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { RealtimeChannel, RealtimeChannelSendResponse } from '@supabase/supabase-js';

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

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000; // 3 seconds
  const DEBOUNCE_DELAY = 300; // 300ms

  console.log('[Realtime] useRealtimeDeliveries initialized:', {
    restaurantId,
    driverId,
    showNotifications,
    enabled,
    connectionStatus,
    timestamp: new Date().toISOString(),
  });

  // Debounced callback wrapper
  const debounce = useCallback((callback: () => void, delay: number) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(callback, delay);
  }, []);

  const setupChannel = useCallback(() => {
    if (!enabled) {
      console.log('[Realtime] Subscription disabled, skipping setup');
      return null;
    }

    console.log('[Realtime] Setting up channel...', {
      restaurantId,
      driverId,
      attempt: reconnectAttemptsRef.current + 1,
      timestamp: new Date().toISOString(),
    });

    setConnectionStatus('CONNECTING');

    // Criar filtro baseado nos parâmetros
    let filter = '';
    if (restaurantId) {
      filter = `restaurant_id=eq.${restaurantId}`;
    } else if (driverId) {
      filter = `driver_id=eq.${driverId}`;
    }

    // Gerar nome de canal único
    const channelName = `deliveries-${restaurantId || driverId || 'all'}-${Date.now()}`;

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
          console.log('[Realtime] Delivery UPDATE received:', {
            id: payload.new.id,
            status: payload.new.status,
            old_status: payload.old?.status,
            timestamp: new Date().toISOString(),
          });

          const delivery = payload.new as DeliveryUpdate;

          // Debounce para evitar atualizações múltiplas
          debounce(() => {
            // Notificações para mudanças de status
            if (showNotifications && payload.old?.status !== delivery.status) {
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

            // Callback customizado
            onUpdate?.(delivery);
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
          console.log('[Realtime] Delivery INSERT received:', {
            id: payload.new.id,
            status: payload.new.status,
            timestamp: new Date().toISOString(),
          });

          const delivery = payload.new as DeliveryUpdate;

          debounce(() => {
            if (showNotifications && driverId && delivery.driver_id === driverId) {
              toast({
                title: 'Nova entrega disponível! 🆕',
                description: 'Uma nova entrega está disponível na sua região.',
              });
            }

            onInsert?.(delivery);
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
          console.log('[Realtime] Delivery DELETE received:', {
            id: payload.old.id,
            timestamp: new Date().toISOString(),
          });

          const delivery = payload.old as DeliveryUpdate;
          debounce(() => {
            onDelete?.(delivery);
          }, DEBOUNCE_DELAY);
        }
      )
      .subscribe((status, error) => {
        console.log('[Realtime] Subscription status changed:', {
          status,
          error,
          channelName,
          timestamp: new Date().toISOString(),
        });

        if (status === 'SUBSCRIBED') {
          setConnectionStatus('CONNECTED');
          reconnectAttemptsRef.current = 0;
          console.log('[Realtime] ✅ Successfully subscribed to deliveries');
        } else if (status === 'CLOSED') {
          setConnectionStatus('DISCONNECTED');
          console.log('[Realtime] ⚠️ Channel closed, attempting reconnect...');
          attemptReconnect();
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionStatus('ERROR');
          console.error('[Realtime] ❌ Channel error:', error);
          attemptReconnect();
        }
      });

    return channel;
  }, [enabled, restaurantId, driverId, showNotifications, onUpdate, onInsert, onDelete, debounce]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[Realtime] ❌ Max reconnection attempts reached');
      setConnectionStatus('ERROR');
      toast({
        title: 'Erro de conexão',
        description: 'Não foi possível reconectar. Recarregue a página.',
        variant: 'destructive',
      });
      return;
    }

    reconnectAttemptsRef.current++;
    console.log(`[Realtime] 🔄 Reconnecting... (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      channelRef.current = setupChannel();
    }, RECONNECT_DELAY);
  }, [setupChannel]);

  const cleanup = useCallback(() => {
    console.log('[Realtime] 🧹 Cleaning up channel...');
    
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
  }, [enabled, setupChannel, cleanup]);

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
