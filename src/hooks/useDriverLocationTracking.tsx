import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseDriverLocationTrackingProps {
  driverId: string;
  deliveryId: string;
  isActive: boolean;
}

interface LastLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
}

export function useDriverLocationTracking({ 
  driverId, 
  deliveryId, 
  isActive 
}: UseDriverLocationTrackingProps) {
  const intervalRef = useRef<ReturnType<typeof setTimeout>>();
  const [lastLocation, setLastLocation] = useState<LastLocation | null>(null);

  const calculateSpeed = (last: LastLocation, current: { latitude: number; longitude: number }, timestamp: number): number => {
    // Haversine formula to calculate distance in km
    const R = 6371;
    const dLat = (current.latitude - last.latitude) * Math.PI / 180;
    const dLon = (current.longitude - last.longitude) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(last.latitude * Math.PI / 180) * Math.cos(current.latitude * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    const timeInHours = (timestamp - last.timestamp) / (1000 * 60 * 60);
    return distance / timeInHours;
  };

  const updateLocation = async (position: GeolocationPosition) => {
    try {
      const { latitude, longitude, accuracy } = position.coords;
      const timestamp = Date.now();

      // Validate coordinate bounds
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        console.error('Coordenadas GPS inválidas');
        return;
      }

      // Check GPS accuracy (reject if > 50 meters)
      if (accuracy > 50) {
        toast.warning('Precisão GPS baixa. Aguardando sinal melhor...');
        return;
      }

      // Validate physically possible speed if we have a previous location
      if (lastLocation) {
        const speed = calculateSpeed(lastLocation, { latitude, longitude }, timestamp);
        if (speed > 150) {
          console.error('Velocidade impossível detectada - possível spoofing de GPS');
          return;
        }
      }

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

      // Store last location for speed validation
      setLastLocation({ latitude, longitude, timestamp });

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
        updateLocation(position);
      },
      (error) => {
        console.error('Erro ao obter localização inicial:', error);
        toast.error('Não foi possível obter sua localização');
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );

    // Update every 10 seconds
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          updateLocation(position);
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
