import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Clock, CheckCircle, Package, AlertCircle } from 'lucide-react';
import { usePickupDelivery } from '@/hooks/usePickupDelivery';
import { useDriverLocationTracking } from '@/hooks/useDriverLocationTracking';
import { useMapNavigation } from '@/hooks/useMapNavigation';
import { useRouteDeliveries } from '@/hooks/useRouteDeliveries';
import { RouteProgressHeader } from '@/components/RouteProgressHeader';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from '@/hooks/use-toast';
import { getGoogleMapsLink } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// Fix Leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const driverIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapBounds({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [map, bounds]);
  return null;
}

interface Delivery {
  id: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  distance_km: number;
  price: number;
  price_adjusted: number;
  product_type: string | null;
  product_note: string | null;
  pickup_latitude: number;
  pickup_longitude: number;
  delivery_latitude: number;
  delivery_longitude: number;
  driver_id: string;
  delivery_sequence: number | null;
}

export default function PickupInProgress() {
  const { deliveryId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState(false);

  const { pickupDelivery, loading: pickingUp } = usePickupDelivery({
    onSuccess: (id: string) => {
      navigate(`/driver/delivery/${id}`, { replace: true });
    }
  });

  const destination: [number, number] | null = delivery
    ? [Number(delivery.pickup_latitude), Number(delivery.pickup_longitude)]
    : null;

  const { route } = useMapNavigation(currentPosition, destination);

  // Hook for route info
  const routeInfo = useRouteDeliveries(driverId, deliveryId);

  useDriverLocationTracking({
    driverId: driverId || '',
    deliveryId: deliveryId || '',
    isActive: !!driverId && !!deliveryId,
  });

  // Geolocation
  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPosition([position.coords.latitude, position.coords.longitude]);
        setGeoError(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setGeoError(true);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (deliveryId && user) fetchDriver();
  }, [deliveryId, user]);

  useEffect(() => {
    if (driverId && deliveryId) fetchDelivery();
  }, [driverId, deliveryId]);

  const fetchDriver = async () => {
    const { data } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user?.id)
      .single();
    if (data) setDriverId(data.id);
  };

  const fetchDelivery = async () => {
    const { data, error } = await supabase
      .from('deliveries')
      .select('*')
      .eq('id', deliveryId)
      .single();

    if (error || !data) {
      toast({ title: 'Erro', description: 'Entrega não encontrada', variant: 'destructive' });
      navigate('/driver/dashboard');
      return;
    }

    if (!data.driver_id || data.driver_id !== driverId) {
      toast({ title: 'Acesso Negado', description: 'Esta entrega não está atribuída a você', variant: 'destructive' });
      navigate('/driver/dashboard');
      return;
    }

    if (data.status !== 'accepted') {
      if (data.status === 'picked_up') {
        navigate(`/driver/delivery/${deliveryId}`, { replace: true });
      } else {
        navigate('/driver/dashboard');
      }
      return;
    }

    setDelivery(data);
    setLoading(false);
  };

  const handleConfirmPickup = async () => {
    if (!deliveryId || !driverId) return;
    await pickupDelivery(deliveryId, driverId);
  };

  const openGPS = () => {
    if (!delivery) return;
    const url = getGoogleMapsLink(currentPosition || undefined, [delivery.pickup_latitude, delivery.pickup_longitude]);
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 relative">
          <Skeleton className="absolute inset-0" />
        </div>
        <div className="p-4 space-y-3 safe-bottom">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!delivery) return null;

  const estimatedTime = route ? Math.ceil(route.duration / 60) : Math.ceil(Number(delivery.distance_km) * 3);
  const routeDistance = route ? (route.distance / 1000).toFixed(1) : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header flutuante sobre o mapa */}
      <div className="absolute top-0 left-0 right-0 z-[1000] p-4 safe-top">
        <Card className="glass">
          <CardContent className="p-3 space-y-2">
            {/* Route progress for batch deliveries */}
            {routeInfo.totalDeliveries > 1 && (
              <RouteProgressHeader
                currentSequence={delivery.delivery_sequence || 1}
                totalDeliveries={routeInfo.totalDeliveries}
                nextDeliveryAddress={routeInfo.nextDeliveryAddress}
                accumulatedEarnings={routeInfo.accumulatedEarnings}
              />
            )}
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">COLETA</p>
                <p className="font-semibold text-foreground">Indo buscar o pedido</p>
              </div>
              <div className="flex items-center gap-2">
                {routeDistance && (
                  <Badge variant="secondary">
                    <Navigation className="w-3 h-3 mr-1" />
                    {routeDistance} km
                  </Badge>
                )}
                <Badge variant="secondary">
                  <Clock className="w-3 h-3 mr-1" />
                  ~{estimatedTime} min
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mapa fullscreen */}
      <div className="flex-1 relative">
        {currentPosition && destination ? (
          <MapContainer
            center={currentPosition}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='OpenStreetMap'
            />
            <MapBounds 
              bounds={route?.coordinates?.length ? route.coordinates : [currentPosition, destination]} 
            />
            <Marker position={currentPosition} icon={driverIcon} />
            {route && route.coordinates.length > 0 && (
              <Polyline
                positions={route.coordinates}
                color="#22c55e"
                weight={5}
                opacity={0.8}
              />
            )}
            <Marker position={destination} icon={pickupIcon} />
          </MapContainer>
        ) : (
          <div className="h-full flex items-center justify-center bg-muted">
            {geoError ? (
              <div className="text-center p-4">
                <AlertCircle className="w-12 h-12 text-warning mx-auto mb-2" />
                <p className="font-medium">Localização indisponível</p>
                <p className="text-sm text-muted-foreground">Ative o GPS do seu dispositivo</p>
              </div>
            ) : (
              <div className="animate-pulse text-muted-foreground">Obtendo localização...</div>
            )}
          </div>
        )}
      </div>

      {/* Bottom sheet com ações */}
      <div className="bg-background border-t border-border p-4 space-y-3 safe-bottom animate-slide-up">
        {/* Endereço de coleta */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground">LOCAL DE COLETA</p>
                <p className="text-sm text-foreground">{delivery.pickup_address}</p>
                {delivery.product_type && (
                  <Badge variant="outline" className="mt-1 text-xs">
                    {delivery.product_type}
                  </Badge>
                )}
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary">
                  R$ {Number(delivery.price_adjusted || delivery.price).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botões de ação */}
        <div className="grid grid-cols-2 gap-3">
          <Button 
            onClick={openGPS}
            variant="outline"
            size="lg"
            className="h-14"
          >
            <Navigation className="w-5 h-5 mr-2" />
            Abrir GPS
          </Button>

          <Button 
            onClick={handleConfirmPickup}
            disabled={pickingUp}
            size="lg"
            className="h-14 font-semibold"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            {pickingUp ? 'Confirmando...' : 'Confirmar Coleta'}
          </Button>
        </div>
      </div>
    </div>
  );
}