import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface DriverLocation {
  id: string;
  driver_id: string;
  delivery_id: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export function useRealtimeDriverLocation(deliveryId: string, enabled = true) {
  const [currentLocation, setCurrentLocation] = useState<DriverLocation | null>(null);
  const [locationHistory, setLocationHistory] = useState<DriverLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('DISCONNECTED');
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;
  const DEBOUNCE_DELAY = 500; // 500ms para localizações

  const fetchInitialLocation = useCallback(async () => {
    if (!deliveryId || !enabled) return;

    setIsLoading(true);

    try {
      // Fetch latest location
      const { data, error } = await supabase
        .from('driver_locations')
        .select('*')
        .eq('delivery_id', deliveryId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[Location] Error fetching location:', error);
      } else if (data) {
        setCurrentLocation(data);
      }

      // Fetch location history
      const { data: historyData, error: historyError } = await supabase
        .from('driver_locations')
        .select('*')
        .eq('delivery_id', deliveryId)
        .order('created_at', { ascending: true });

      if (historyError) {
        console.error('[Location] Error fetching history:', historyError);
      } else if (historyData) {
        setLocationHistory(historyData);
      }
    } catch (error) {
      console.error('[Location] Exception fetching location:', error);
    } finally {
      setIsLoading(false);
    }
  }, [deliveryId, enabled]);

  const setupChannel = useCallback(() => {
    if (!deliveryId || !enabled) return null;

    setConnectionStatus('CONNECTING');

    const channelName = `driver-location-${deliveryId}-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'driver_locations',
          filter: `delivery_id=eq.${deliveryId}`,
        },
        (payload) => {
          const newLocation = payload.new as DriverLocation;

          // Debounce location updates
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }

          debounceTimerRef.current = setTimeout(() => {
            setCurrentLocation(newLocation);
            setLocationHistory((prev) => {
              // Evitar duplicatas
              if (prev.some(loc => loc.id === newLocation.id)) {
                return prev;
              }
              return [...prev, newLocation];
            });
          }, DEBOUNCE_DELAY);
        }
      )
      .subscribe((status, error) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('CONNECTED');
          reconnectAttemptsRef.current = 0;
        } else if (status === 'CLOSED') {
          setConnectionStatus('DISCONNECTED');
          attemptReconnect();
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionStatus('ERROR');
          console.error('[Location] Channel error:', error);
          attemptReconnect();
        }
      });

    return channel;
  }, [deliveryId, enabled]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
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

    fetchInitialLocation();
    channelRef.current = setupChannel();

    return cleanup;
  }, [deliveryId, enabled, fetchInitialLocation, setupChannel, cleanup]);

  return {
    currentLocation,
    locationHistory,
    isLoading,
    connectionStatus,
    isConnected: connectionStatus === 'CONNECTED',
    refetch: fetchInitialLocation,
  };
}
