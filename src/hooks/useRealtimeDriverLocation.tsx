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

  console.log('[Realtime Location] Hook initialized:', {
    deliveryId,
    enabled,
    connectionStatus,
    currentLocationExists: !!currentLocation,
    historyLength: locationHistory.length,
    timestamp: new Date().toISOString(),
  });

  const fetchInitialLocation = useCallback(async () => {
    if (!deliveryId || !enabled) return;

    console.log('[Location] Fetching initial location for delivery:', deliveryId);
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
        console.log('[Location] ✅ Initial location fetched:', {
          lat: data.latitude,
          lng: data.longitude,
          timestamp: data.created_at,
        });
        setCurrentLocation(data);
      } else {
        console.log('[Location] ⚠️ No location found yet');
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
        console.log('[Location] ✅ Location history fetched:', historyData.length, 'points');
        setLocationHistory(historyData);
      }
    } catch (error) {
      console.error('[Location] Exception fetching location:', error);
    } finally {
      setIsLoading(false);
    }
  }, [deliveryId, enabled]);

  const setupChannel = useCallback(() => {
    if (!deliveryId || !enabled) {
      console.log('[Location] Channel setup skipped (disabled or no deliveryId)');
      return null;
    }

    console.log('[Location] Setting up realtime channel...', {
      deliveryId,
      attempt: reconnectAttemptsRef.current + 1,
      timestamp: new Date().toISOString(),
    });

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
          console.log('[Location] 📍 New location received:', {
            lat: payload.new.latitude,
            lng: payload.new.longitude,
            timestamp: payload.new.created_at,
          });

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
        console.log('[Location] Subscription status:', {
          status,
          error,
          channelName,
          timestamp: new Date().toISOString(),
        });

        if (status === 'SUBSCRIBED') {
          setConnectionStatus('CONNECTED');
          reconnectAttemptsRef.current = 0;
          console.log('[Location] ✅ Successfully subscribed to location updates');
        } else if (status === 'CLOSED') {
          setConnectionStatus('DISCONNECTED');
          console.log('[Location] ⚠️ Channel closed, attempting reconnect...');
          attemptReconnect();
        } else if (status === 'CHANNEL_ERROR') {
          setConnectionStatus('ERROR');
          console.error('[Location] ❌ Channel error:', error);
          attemptReconnect();
        }
      });

    return channel;
  }, [deliveryId, enabled]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[Location] ❌ Max reconnection attempts reached');
      setConnectionStatus('ERROR');
      return;
    }

    reconnectAttemptsRef.current++;
    console.log(`[Location] 🔄 Reconnecting... (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      channelRef.current = setupChannel();
    }, RECONNECT_DELAY);
  }, [setupChannel]);

  const cleanup = useCallback(() => {
    console.log('[Location] 🧹 Cleaning up...');

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
