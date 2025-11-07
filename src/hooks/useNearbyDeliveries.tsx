import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Delivery {
  id: string;
  pickup_address: string;
  delivery_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  distance_km: number;
  price: number;
  description: string | null;
  created_at: string;
  distanceFromDriver?: number;
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
  maxDistanceKm?: number;
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

  const fetchDriverLocation = async () => {
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
    }
  };

  const fetchDeliveries = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('deliveries')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

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

      // Filter by max distance and sort by proximity
      const nearbyDeliveries = deliveriesWithDistance
        .filter((d) => d.distanceFromDriver! <= maxDistanceKm)
        .sort((a, b) => a.distanceFromDriver! - b.distanceFromDriver!);

      setDeliveries(nearbyDeliveries);
    } else if (data) {
      setDeliveries(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAvailable) {
      fetchDriverLocation();
    }
  }, [driverId, isAvailable]);

  useEffect(() => {
    if (isAvailable && driverLocation) {
      fetchDeliveries();

      // Subscribe to realtime updates
      const channel = supabase
        .channel('pending-deliveries-nearby')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'deliveries',
            filter: 'status=eq.pending',
          },
          () => {
            fetchDeliveries();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAvailable, driverLocation]);

  return { deliveries, loading, driverLocation };
}
