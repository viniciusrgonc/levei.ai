import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Haversine ─────────────────────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Types ─────────────────────────────────────────────────────────────────
interface Delivery {
  id: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  distance_km: number;
  price: number;
  price_adjusted?: number | null;
  description: string | null;
  created_at: string;
  distanceFromDriver?: number;
  product_type?: string | null;
  product_note?: string | null;
}

interface DriverInfo {
  lat: number;
  lng: number;
  radiusKm: number;
}

interface UseNearbyDeliveriesProps {
  driverId: string;
  isAvailable: boolean;
  maxDistanceKm?: number;
}

// ── Query fn 1: driver location + configured radius ───────────────────────
async function fetchDriverInfo(driverId: string, maxDistanceKm: number): Promise<DriverInfo | null> {
  const { data } = await supabase
    .from('drivers')
    .select('latitude, longitude, vehicle_type')
    .eq('id', driverId)
    .single();

  if (!data?.latitude || !data?.longitude) return null;

  let radiusKm = maxDistanceKm;
  if (data.vehicle_type) {
    const { data: radiusSetting } = await supabase
      .from('delivery_radius_settings')
      .select('max_radius_km')
      .eq('vehicle_type', data.vehicle_type)
      .eq('is_active', true)
      .maybeSingle();
    if (radiusSetting?.max_radius_km) {
      radiusKm = Number(radiusSetting.max_radius_km);
    }
  }

  return { lat: Number(data.latitude), lng: Number(data.longitude), radiusKm };
}

// ── Query fn 2: pending deliveries filtered by radius ─────────────────────
async function fetchNearbyDeliveries(info: DriverInfo): Promise<Delivery[]> {
  const { data } = await supabase
    .from('deliveries')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (!data) return [];

  return data
    .map((d) => ({
      ...d,
      distanceFromDriver: haversine(
        info.lat, info.lng,
        Number(d.pickup_latitude), Number(d.pickup_longitude)
      ),
    }))
    .filter((d) => d.distanceFromDriver <= info.radiusKm)
    .sort((a, b) => a.distanceFromDriver - b.distanceFromDriver);
}

// ── Hook ──────────────────────────────────────────────────────────────────
export function useNearbyDeliveries({
  driverId,
  isAvailable,
  maxDistanceKm = 20,
}: UseNearbyDeliveriesProps) {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // 1️⃣ Driver info (location + radius) — cached 5 min, rare to change
  const { data: driverInfo } = useQuery({
    queryKey: ['driver-info', driverId],
    queryFn: () => fetchDriverInfo(driverId, maxDistanceKm),
    enabled: isAvailable && !!driverId,
    staleTime: 5 * 60 * 1000,   // 5 min — position rarely changes mid-shift
    gcTime: 10 * 60 * 1000,
  });

  // 2️⃣ Nearby deliveries — depends on location; stale after 30s
  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ['nearby-deliveries', driverId, driverInfo?.lat, driverInfo?.lng, driverInfo?.radiusKm],
    queryFn: () => fetchNearbyDeliveries(driverInfo!),
    enabled: isAvailable && !!driverInfo,
    staleTime: 30 * 1000,        // 30s — deliveries change frequently
    gcTime: 2 * 60 * 1000,
  });

  // 3️⃣ Realtime: invalidate query when any pending delivery changes
  useEffect(() => {
    if (!isAvailable || !driverId) return;

    const channel = supabase
      .channel(`nearby-deliveries-rt-${driverId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deliveries', filter: 'status=eq.pending' },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['nearby-deliveries', driverId],
          });
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [isAvailable, driverId, queryClient]);

  return {
    deliveries,
    loading: isLoading,
    driverLocation: driverInfo ? { lat: driverInfo.lat, lng: driverInfo.lng } : null,
    radiusKm: driverInfo?.radiusKm ?? maxDistanceKm,
  };
}
