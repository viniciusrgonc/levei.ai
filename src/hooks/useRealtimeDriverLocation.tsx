import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DriverLocation {
  id: string;
  driver_id: string;
  delivery_id: string;
  latitude: number;
  longitude: number;
  created_at: string;
}

export function useRealtimeDriverLocation(deliveryId: string) {
  const [currentLocation, setCurrentLocation] = useState<DriverLocation | null>(null);
  const [locationHistory, setLocationHistory] = useState<DriverLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch initial location
    const fetchInitialLocation = async () => {
      const { data, error } = await supabase
        .from('driver_locations')
        .select('*')
        .eq('delivery_id', deliveryId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data && !error) {
        setCurrentLocation(data);
      }

      // Fetch location history
      const { data: historyData } = await supabase
        .from('driver_locations')
        .select('*')
        .eq('delivery_id', deliveryId)
        .order('created_at', { ascending: true });

      if (historyData) {
        setLocationHistory(historyData);
      }

      setIsLoading(false);
    };

    fetchInitialLocation();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('driver-location-changes')
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
          setCurrentLocation(newLocation);
          setLocationHistory((prev) => [...prev, newLocation]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deliveryId]);

  return { currentLocation, locationHistory, isLoading };
}
