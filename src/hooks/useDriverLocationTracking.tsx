import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseDriverLocationTrackingProps {
  driverId: string;
  deliveryId: string;
  isActive: boolean;
}

export function useDriverLocationTracking({ 
  driverId, 
  deliveryId, 
  isActive 
}: UseDriverLocationTrackingProps) {
  const intervalRef = useRef<NodeJS.Timeout>();

  const updateLocation = async (latitude: number, longitude: number) => {
    try {
      const { error } = await supabase
        .from('driver_locations')
        .insert({
          driver_id: driverId,
          delivery_id: deliveryId,
          latitude,
          longitude,
        });

      if (error) throw error;

      // Update driver's last location
      await supabase
        .from('drivers')
        .update({
          latitude,
          longitude,
          last_location_update: new Date().toISOString(),
        })
        .eq('id', driverId);

    } catch (error) {
      console.error('Erro ao atualizar localização:', error);
    }
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocalização não suportada neste dispositivo');
      return;
    }

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateLocation(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        console.error('Erro ao obter localização inicial:', error);
        toast.error('Não foi possível obter sua localização');
      }
    );

    // Update every 10 seconds
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          updateLocation(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error('Erro ao obter localização:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    }, 10000);
  };

  const stopTracking = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  };

  useEffect(() => {
    if (isActive) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => {
      stopTracking();
    };
  }, [isActive, driverId, deliveryId]);

  return { startTracking, stopTracking };
}
