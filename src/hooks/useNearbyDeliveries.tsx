import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Delivery {
  id: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  distance_km: number;
  price: number;
  description: string | null;
  created_at: string;
  distanceFromDriver?: number;
  product_type?: string | null;
  product_note?: string | null;
}

// Haversine formula to calculate distance between two points
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface UseNearbyDeliveriesProps {
  driverId: string;
  isAvailable: boolean;
  maxDistanceKm?: number; // Fallback if no setting found
}

export function useNearbyDeliveries({
  driverId,
  isAvailable,
  maxDistanceKm = 20,
}: UseNearbyDeliveriesProps) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [driverLocation, setDriverLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [configuredRadius, setConfiguredRadius] = useState<number | null>(null);

  console.log('useNearbyDeliveries initialized:', {
    driverId,
    isAvailable,
    maxDistanceKm,
    configuredRadius,
    currentDeliveriesCount: deliveries.length,
  });

  // Fetch driver location and vehicle type
  const fetchDriverInfo = async () => {
    const { data } = await supabase
      .from('drivers')
      .select('latitude, longitude, vehicle_type')
      .eq('id', driverId)
      .single();

    if (data?.latitude && data?.longitude) {
      setDriverLocation({
        lat: Number(data.latitude),
        lng: Number(data.longitude),
      });

      // Fetch radius setting for this vehicle type
      if (data.vehicle_type) {
        const { data: radiusSetting } = await supabase
          .from('delivery_radius_settings')
          .select('max_radius_km')
          .eq('vehicle_type', data.vehicle_type)
          .eq('is_active', true)
          .maybeSingle();

        if (radiusSetting?.max_radius_km) {
          setConfiguredRadius(Number(radiusSetting.max_radius_km));
        }
      }
    }
  };

  // Get effective radius (configured or fallback)
  const effectiveRadius = configuredRadius ?? maxDistanceKm;

  const fetchDeliveries = async () => {
    setLoading(true);
    console.log('🔍 Fetching deliveries for driver:', driverId, 'radius:', effectiveRadius);
    
    const { data, error } = await supabase
      .from('deliveries')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    console.log('📦 Deliveries fetched:', { data, error, count: data?.length });

    if (data && driverLocation) {
      // Calculate distance from driver to each delivery pickup point
      const deliveriesWithDistance = data.map((delivery) => ({
        ...delivery,
        distanceFromDriver: calculateDistance(
          driverLocation.lat,
          driverLocation.lng,
          Number(delivery.pickup_latitude),
          Number(delivery.pickup_longitude)
        ),
      }));

      // Filter by effective radius and sort by proximity
      const nearbyDeliveries = deliveriesWithDistance
        .filter((d) => d.distanceFromDriver! <= effectiveRadius)
        .sort((a, b) => a.distanceFromDriver! - b.distanceFromDriver!);

      console.log('📍 Nearby deliveries:', nearbyDeliveries.length, 'within', effectiveRadius, 'km');
      
      if (!Array.isArray(nearbyDeliveries)) {
        console.error('nearbyDeliveries is not an array!', nearbyDeliveries);
        setDeliveries([]);
      } else {
        setDeliveries(nearbyDeliveries);
      }
    } else if (data) {
      console.log('⚠️ No driver location, showing all deliveries');
      
      if (!Array.isArray(data)) {
        console.error('data is not an array!', data);
        setDeliveries([]);
      } else {
        setDeliveries(data);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAvailable && driverId) {
      fetchDriverInfo();
    }
  }, [driverId, isAvailable]);

  useEffect(() => {
    if (isAvailable && driverLocation) {
      fetchDeliveries();

      console.log('[NearbyDeliveries] Setting up realtime subscription');
      
      // Subscribe to realtime updates with debounce
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      const channelName = `pending-deliveries-nearby-${Date.now()}`;
      
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'deliveries',
            filter: 'status=eq.pending',
          },
          (payload) => {
            console.log('[NearbyDeliveries] 🔄 Delivery change detected:', {
              event: payload.eventType,
              id: (payload.new as any)?.id || (payload.old as any)?.id,
            });

            // Debounce refetch
            if (debounceTimer) {
              clearTimeout(debounceTimer);
            }
            
            debounceTimer = setTimeout(() => {
              fetchDeliveries();
            }, 500);
          }
        )
        .subscribe((status, error) => {
          console.log('[NearbyDeliveries] Subscription status:', status, error);
        });

      return () => {
        console.log('[NearbyDeliveries] 🧹 Cleaning up subscription');
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        supabase.removeChannel(channel);
      };
    } else if (isAvailable) {
      setLoading(false);
    }
  }, [isAvailable, driverLocation, effectiveRadius]);

  return { 
    deliveries: Array.isArray(deliveries) ? deliveries : [], 
    loading: typeof loading === 'boolean' ? loading : false, 
    driverLocation,
    radiusKm: effectiveRadius,
  };
}
