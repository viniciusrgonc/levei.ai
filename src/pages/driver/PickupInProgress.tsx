import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Package, Navigation, ArrowLeft, Route, Clock, CheckCircle } from 'lucide-react';
import { usePickupDelivery } from '@/hooks/usePickupDelivery';
import { useDriverLocationTracking } from '@/hooks/useDriverLocationTracking';
import { useMapNavigation } from '@/hooks/useMapNavigation';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getStatusConfig } from '@/lib/deliveryStatus';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { DriverSidebar } from '@/components/DriverSidebar';
import NotificationBell from '@/components/NotificationBell';

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
    map.fitBounds(bounds, { padding: [50, 50] });
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
  description: string | null;
  pickup_latitude: number;
  pickup_longitude: number;
  delivery_latitude: number;
  delivery_longitude: number;
  driver_id: string;
}

export default function PickupInProgress() {
  const { deliveryId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);

  const { pickupDelivery, loading: pickingUp } = usePickupDelivery({
    onSuccess: () => {
      navigate(`/driver/delivery/${deliveryId}`);
    }
  });

  const destination: [number, number] | null = delivery
    ? [Number(delivery.pickup_latitude), Number(delivery.pickup_longitude)]
    : null;

  const { route, loading: routeLoading } = useMapNavigation(currentPosition, destination);

  useDriverLocationTracking({
    driverId: driverId || '',
    deliveryId: deliveryId || '',
    isActive: !!driverId && !!deliveryId,
  });

  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        console.log('[Geo] watchPosition success:', { lat, lng });
        setCurrentPosition([lat, lng]);
      },
      (error) => console.error('Error getting location:', error),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (deliveryId && user) {
      fetchDelivery();
      fetchDriver();
    }
  }, [deliveryId, user]);

  const fetchDriver = async () => {
    const { data } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user?.id)
      .single();

    if (data) {
      setDriverId(data.id);
    }
  };

  const fetchDelivery = async () => {
    const { data } = await supabase
      .from('deliveries')
      .select('*')
      .eq('id', deliveryId)
      .single();

    if (data) {
      setDelivery(data);
    }
    setLoading(false);
  };

  const handleConfirmPickup = async () => {
    if (!deliveryId || !driverId) return;
    await pickupDelivery(deliveryId, driverId);
  };

  const openInMaps = () => {
    if (!delivery) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${delivery.pickup_latitude},${delivery.pickup_longitude}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!delivery) return null;

  const statusConfig = getStatusConfig(delivery.status as any);

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full">
        <DriverSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-primary">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
              <h1 className="text-xl font-bold text-primary-foreground">Coleta em Andamento</h1>
            </div>
            <NotificationBell />
          </header>

          <main className="flex-1 p-6 bg-background overflow-auto">
            <div className="max-w-4xl mx-auto space-y-6">
              <Button 
                variant="outline" 
                onClick={() => navigate('/driver/dashboard')}
                className="transition-all duration-300 hover:scale-105"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>

              {/* Location Tracking Alert */}
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Navigation className="h-5 w-5 text-primary mt-0.5 animate-pulse" />
                    <div>
                      <p className="font-medium text-sm">Rastreamento Ativo</p>
                      <p className="text-xs text-muted-foreground">
                        Sua localização está sendo compartilhada automaticamente
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Map */}
              {currentPosition && destination && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Route className="h-5 w-5" />
                      Rota para Coleta
                    </CardTitle>
                    {route && (
                      <CardDescription className="flex flex-wrap gap-4 mt-2">
                        <span className="flex items-center gap-1">
                          <Route className="h-4 w-4" />
                          {(route.distance / 1000).toFixed(1)} km
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {Math.ceil(route.duration / 60)} min
                        </span>
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="h-[400px] rounded-lg overflow-hidden border-2 border-primary/20">
                      <MapContainer
                        center={currentPosition}
                        zoom={14}
                        style={{ height: '100%', width: '100%' }}
                        scrollWheelZoom={true}
                      >
                        <TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution='&copy; OpenStreetMap'
                        />
                        
                        <MapBounds 
                          bounds={route?.coordinates?.length ? route.coordinates : [currentPosition, destination]} 
                        />
                        
                        <Marker position={currentPosition} icon={driverIcon}>
                          <Popup>Você está aqui</Popup>
                        </Marker>
                        
                        {route && route.coordinates.length > 0 && (
                          <Polyline
                            positions={route.coordinates}
                            color="#22c55e"
                            weight={4}
                            opacity={0.7}
                          />
                        )}
                        
                        <Marker position={destination} icon={pickupIcon}>
                          <Popup>Local de Coleta</Popup>
                        </Marker>
                      </MapContainer>
                    </div>
                    
                    <Button 
                      onClick={openInMaps} 
                      variant="outline" 
                      className="w-full mt-4"
                    >
                      <Navigation className="mr-2 h-4 w-4" />
                      Abrir no Google Maps
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Delivery Details */}
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Detalhes da Coleta</CardTitle>
                      <CardDescription>
                        {Number(delivery.distance_km).toFixed(1)} km • R$ {Number(delivery.price).toFixed(2)}
                      </CardDescription>
                    </div>
                    <Badge variant={statusConfig.variant}>
                      {statusConfig.icon} {statusConfig.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2 font-medium mb-2">
                      <Package className="h-5 w-5 text-primary" />
                      Local de Coleta
                    </div>
                    <p className="text-sm text-muted-foreground ml-7">{delivery.pickup_address}</p>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 font-medium mb-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      Destino Final
                    </div>
                    <p className="text-sm text-muted-foreground ml-7">{delivery.delivery_address}</p>
                  </div>

                  {delivery.description && (
                    <div>
                      <p className="font-medium mb-2">Observações</p>
                      <p className="text-sm text-muted-foreground">{delivery.description}</p>
                    </div>
                  )}

                  <Button 
                    onClick={handleConfirmPickup}
                    disabled={pickingUp}
                    className="w-full transition-all duration-300 hover:scale-105"
                    size="lg"
                  >
                    <CheckCircle className="mr-2 h-5 w-5" />
                    Confirmar Coleta Realizada
                  </Button>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
