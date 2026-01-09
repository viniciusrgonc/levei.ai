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
  regular_base_price?: number;
  regular_price_per_km?: number;
  reason?: string;
}

interface UseActiveDriverResult {
  activeDriver: ActiveDriverInfo | null;
  loading: boolean;
  noEligibleDriver: boolean;
  noEligibleReason: string | null;
}

export function useActiveDriver(restaurantId: string | undefined): UseActiveDriverResult {
  const [activeDriver, setActiveDriver] = useState<ActiveDriverInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [noEligibleDriver, setNoEligibleDriver] = useState(false);
  const [noEligibleReason, setNoEligibleReason] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    const checkActiveDriver = async () => {
      setLoading(true);
      setNoEligibleDriver(false);
      setNoEligibleReason(null);

      try {
        // Find drivers currently picking up at this restaurant
        const { data: pickingUpDeliveries, error } = await supabase
          .from('deliveries')
          .select('id, driver_id, vehicle_category, accepted_at')
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
              // Also fetch regular pricing for comparison
              const { data: regularSettings } = await supabase
                .from('delivery_categories')
                .select('base_price, price_per_km')
                .eq('is_active', true)
                .limit(1)
                .single();

              setActiveDriver({
                ...driverInfo,
                regular_base_price: regularSettings?.base_price || 5.00,
                regular_price_per_km: regularSettings?.price_per_km || 2.50
              });
              setLoading(false);
              return;
            } else if (driverInfo.reason) {
              // Driver exists but is not eligible
              setNoEligibleDriver(true);
              setNoEligibleReason(driverInfo.reason);
            }
          }
        }

        // If we got here, there are picking_up deliveries but none are eligible
        if (pickingUpDeliveries.length > 0 && !noEligibleReason) {
          setNoEligibleDriver(true);
          setNoEligibleReason('Janela de tempo expirada ou limite de entregas atingido');
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

  return { activeDriver, loading, noEligibleDriver, noEligibleReason };
}
