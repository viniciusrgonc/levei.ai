import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RouteDelivery {
  id: string;
  delivery_sequence: number;
  delivery_address: string;
  status: string;
  price_adjusted: number;
}

interface RouteInfo {
  deliveries: RouteDelivery[];
  totalDeliveries: number;
  currentSequence: number;
  nextDeliveryAddress: string | undefined;
  accumulatedEarnings: number;
  completedCount: number;
}

export function useRouteDeliveries(driverId: string | null, currentDeliveryId: string | undefined) {
  const [routeInfo, setRouteInfo] = useState<RouteInfo>({
    deliveries: [],
    totalDeliveries: 0,
    currentSequence: 1,
    nextDeliveryAddress: undefined,
    accumulatedEarnings: 0,
    completedCount: 0
  });

  useEffect(() => {
    if (!driverId) return;

    const fetchRouteDeliveries = async () => {
      const { data, error } = await supabase
        .from('deliveries')
        .select('id, delivery_sequence, delivery_address, status, price_adjusted')
        .eq('driver_id', driverId)
        .in('status', ['accepted', 'picking_up', 'picked_up', 'delivering', 'delivered'])
        .order('delivery_sequence', { ascending: true });

      if (error || !data) return;

      // Filter to only include active route (not old delivered ones)
      // Find if there are any non-delivered deliveries
      const hasActiveDeliveries = data.some(d => d.status !== 'delivered');
      
      let routeDeliveries: RouteDelivery[] = [];
      
      if (hasActiveDeliveries) {
        // Get all deliveries that are part of current route
        // This includes completed ones in the same batch
        const activeDelivery = data.find(d => d.id === currentDeliveryId);
        if (activeDelivery) {
          // Get all deliveries with same parent or same batch
          routeDeliveries = data.filter(d => 
            d.status !== 'delivered' || 
            data.some(other => other.status !== 'delivered' && other.delivery_sequence !== undefined)
          );
        } else {
          routeDeliveries = data.filter(d => d.status !== 'delivered');
        }
      }

      if (routeDeliveries.length === 0) return;

      // Sort by sequence
      routeDeliveries.sort((a, b) => (a.delivery_sequence || 0) - (b.delivery_sequence || 0));

      // Find current delivery
      const currentDelivery = routeDeliveries.find(d => d.id === currentDeliveryId);
      const currentSequence = currentDelivery?.delivery_sequence || 1;

      // Find next delivery (next sequence after current that's not delivered)
      const nextDelivery = routeDeliveries.find(d => 
        (d.delivery_sequence || 0) > currentSequence && 
        d.status !== 'delivered'
      );

      // Calculate accumulated earnings (80% of gross for completed + current)
      const completedDeliveries = routeDeliveries.filter(d => d.status === 'delivered');
      const accumulatedGross = completedDeliveries.reduce((sum, d) => sum + Number(d.price_adjusted || 0), 0);
      const accumulatedEarnings = accumulatedGross * 0.80;

      setRouteInfo({
        deliveries: routeDeliveries,
        totalDeliveries: routeDeliveries.length,
        currentSequence,
        nextDeliveryAddress: nextDelivery?.delivery_address,
        accumulatedEarnings,
        completedCount: completedDeliveries.length
      });
    };

    fetchRouteDeliveries();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('route-deliveries-' + driverId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
          filter: `driver_id=eq.${driverId}`
        },
        () => {
          fetchRouteDeliveries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId, currentDeliveryId]);

  return routeInfo;
}
