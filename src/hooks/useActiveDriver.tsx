import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ActiveDriverInfo {
  available: boolean;
  driver_id?: string;
  parent_delivery_id?: string;
  current_count?: number;
  max_count?: number;
  time_remaining_minutes?: number;
  base_price?: number;
  price_per_km?: number;
  reason?: string;
}

export function useActiveDriver(restaurantId: string | undefined) {
  const [activeDriver, setActiveDriver] = useState<ActiveDriverInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    const checkActiveDriver = async () => {
      setLoading(true);
      try {
        // Find drivers currently picking up at this restaurant
        const { data: pickingUpDeliveries, error } = await supabase
          .from('deliveries')
          .select('driver_id')
          .eq('restaurant_id', restaurantId)
          .eq('status', 'picking_up')
          .not('driver_id', 'is', null);

        if (error || !pickingUpDeliveries || pickingUpDeliveries.length === 0) {
          setActiveDriver(null);
          setLoading(false);
          return;
        }

        // Check each driver for batch availability
        for (const delivery of pickingUpDeliveries) {
          const { data: result, error: rpcError } = await supabase
            .rpc('check_driver_available_for_batch', {
              p_driver_id: delivery.driver_id,
              p_restaurant_id: restaurantId
            });

          if (!rpcError && result && typeof result === 'object') {
            const driverInfo = result as unknown as ActiveDriverInfo;
            if (driverInfo.available) {
              setActiveDriver(driverInfo);
              setLoading(false);
              return;
            }
          }
        }

        setActiveDriver(null);
      } catch (err) {
        console.error('Error checking active driver:', err);
        setActiveDriver(null);
      } finally {
        setLoading(false);
      }
    };

    checkActiveDriver();

    // Subscribe to realtime updates for deliveries
    const channel = supabase
      .channel('active-driver-check')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
          filter: `restaurant_id=eq.${restaurantId}`
        },
        () => {
          checkActiveDriver();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  return { activeDriver, loading };
}
