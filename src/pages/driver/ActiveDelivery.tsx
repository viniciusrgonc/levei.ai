import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { MapPin, Package, CheckCircle, Camera, ArrowLeft, Navigation, Clock, Route } from 'lucide-react';
import { useDriverLocationTracking } from '@/hooks/useDriverLocationTracking';
import { useMapNavigation } from '@/hooks/useMapNavigation';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons for map markers
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

const deliveryIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to auto-fit bounds
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
  recipient_name: string | null;
  recipient_phone: string | null;
  pickup_latitude: number;
  pickup_longitude: number;
  delivery_latitude: number;
  delivery_longitude: number;
  created_at: string;
  accepted_at: string | null;
  picked_up_at: string | null;
  driver_id: string;
}

export default function ActiveDelivery() {
  const { deliveryId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);

  // Determine destination based on delivery status
  const destination: [number, number] | null = delivery
    ? delivery.status === 'accepted'
      ? [Number(delivery.pickup_latitude), Number(delivery.pickup_longitude)]
      : delivery.status === 'picked_up'
      ? [Number(delivery.delivery_latitude), Number(delivery.delivery_longitude)]
      : null
    : null;

  // Get navigation route
  const { route, loading: routeLoading } = useMapNavigation(currentPosition, destination);

  // Enable location tracking when delivery is active
  useDriverLocationTracking({
    driverId: driverId || '',
    deliveryId: deliveryId || '',
    isActive: !!driverId && !!deliveryId && delivery?.status !== 'delivered',
  });

  // Track current GPS position
  useEffect(() => {
    if (delivery?.status !== 'delivered') {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setCurrentPosition([position.coords.latitude, position.coords.longitude]);
        },
        (error) => console.error('Error getting location:', error),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [delivery?.status]);

  useEffect(() => {
    if (deliveryId) {
      fetchDelivery();
      
      const channel = supabase
        .channel(`delivery-${deliveryId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'deliveries',
            filter: `id=eq.${deliveryId}`
          },
          (payload) => {
            setDelivery(payload.new as Delivery);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [deliveryId]);

  const fetchDelivery = async () => {
    const { data, error } = await supabase
      .from('deliveries')
      .select('*')
      .eq('id', deliveryId)
      .single();

    if (error || !data) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os dados da entrega'
      });
      navigate('/driver/dashboard');
    } else {
      setDelivery(data);
      if (data.driver_id) {
        setDriverId(data.driver_id);
      }
    }
    setLoading(false);
  };

  const acceptDelivery = async () => {
    const { error } = await supabase
      .from('deliveries')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        driver_id: driverId
      })
      .eq('id', deliveryId);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível aceitar a entrega'
      });
    } else {
      toast({
        title: '✅ Entrega aceita!',
        description: 'Status atualizado. Dirija-se ao local de coleta.'
      });
      fetchDelivery(); // Refresh data
    }
  };

  const markAsPickedUp = async () => {
    const { error } = await supabase
      .from('deliveries')
      .update({
        status: 'picked_up',
        picked_up_at: new Date().toISOString()
      })
      .eq('id', deliveryId);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar o status'
      });
    } else {
      toast({
        title: '📦 Pedido coletado!',
        description: 'Status atualizado. Agora siga para o endereço de entrega.'
      });
      fetchDelivery(); // Refresh data
    }
  };

  const markAsDelivered = async () => {
    const { error } = await supabase
      .from('deliveries')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString()
      })
      .eq('id', deliveryId);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar o status'
      });
    } else {
      toast({
        title: '🎉 Entrega concluída!',
        description: `Status atualizado. Você ganhou R$ ${Number(delivery?.price).toFixed(2)}`
      });
      setTimeout(() => navigate('/driver/dashboard'), 1500);
    }
  };

  const openInMaps = (lat: number, lng: number, address: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      accepted: { variant: 'default', label: 'Aceito' },
      picked_up: { variant: 'default', label: 'Coletado' },
      delivered: { variant: 'default', label: 'Entregue' },
    };
    const config = variants[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 animate-fade-in">
      <div className="max-w-4xl mx-auto pt-8">
        <Button 
          variant="outline" 
          onClick={() => navigate('/driver/dashboard')} 
          className="mb-4 transition-all duration-300 hover:scale-105 active:scale-95"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <div className="grid gap-6">
          {/* Location Tracking Alert */}
          {delivery.status !== 'delivered' && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Navigation className="h-5 w-5 text-primary mt-0.5 animate-pulse" />
                  <div>
                    <p className="font-medium text-sm">Rastreamento Ativo</p>
                    <p className="text-xs text-muted-foreground">
                      Sua localização está sendo compartilhada automaticamente a cada 10 segundos
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Real-time Map */}
          {delivery.status !== 'delivered' && currentPosition && destination && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Route className="h-5 w-5" />
                  Navegação em Tempo Real
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
                <div className="h-[450px] rounded-lg overflow-hidden border-2 border-primary/20">
                  <MapContainer
                    center={currentPosition}
                    zoom={14}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={true}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    
                    {/* Auto-fit bounds */}
                    <MapBounds 
                      bounds={route?.coordinates.length ? route.coordinates : [currentPosition, destination]} 
                    />
                    
                    {/* Current driver position */}
                    <Marker position={currentPosition} icon={driverIcon}>
                      <Popup>
                        <div className="text-center">
                          <strong>📍 Você está aqui</strong>
                          <br />
                          <span className="text-xs text-muted-foreground">
                            Atualizado em tempo real
                          </span>
                        </div>
                      </Popup>
                    </Marker>
                    
                    {/* Route polyline */}
                    {route && route.coordinates.length > 0 && (
                      <Polyline
                        positions={route.coordinates}
                        color={delivery.status === 'accepted' ? '#22c55e' : '#ef4444'}
                        weight={4}
                        opacity={0.7}
                      />
                    )}
                    
                    {/* Pickup location */}
                    {delivery.status === 'accepted' && (
                      <Marker 
                        position={[Number(delivery.pickup_latitude), Number(delivery.pickup_longitude)]}
                        icon={pickupIcon}
                      >
                        <Popup>
                          <div className="text-center">
                            <strong>📦 Local de Coleta</strong>
                            <br />
                            <span className="text-xs">{delivery.pickup_address}</span>
                            <br />
                            {route && (
                              <span className="text-xs text-muted-foreground">
                                {(route.distance / 1000).toFixed(1)} km • {Math.ceil(route.duration / 60)} min
                              </span>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    )}
                    
                    {/* Delivery location */}
                    {delivery.status === 'picked_up' && (
                      <Marker 
                        position={[Number(delivery.delivery_latitude), Number(delivery.delivery_longitude)]}
                        icon={deliveryIcon}
                      >
                        <Popup>
                          <div className="text-center">
                            <strong>🎯 Local de Entrega</strong>
                            <br />
                            <span className="text-xs">{delivery.delivery_address}</span>
                            <br />
                            {route && (
                              <span className="text-xs text-muted-foreground">
                                {(route.distance / 1000).toFixed(1)} km • {Math.ceil(route.duration / 60)} min
                              </span>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    )}
                  </MapContainer>
                </div>
                
                {/* Navigation Info Card */}
                {route && (
                  <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold text-primary">
                          {(route.distance / 1000).toFixed(1)} km
                        </p>
                        <p className="text-xs text-muted-foreground">Distância</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-primary">
                          {Math.ceil(route.duration / 60)} min
                        </p>
                        <p className="text-xs text-muted-foreground">Tempo Estimado</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {routeLoading && (
                  <div className="mt-4 text-center text-sm text-muted-foreground">
                    Calculando melhor rota...
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Status Card */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Entrega #{delivery.id.slice(0, 8)}</CardTitle>
                  <CardDescription>
                    {Number(delivery.distance_km).toFixed(1)} km • R$ {Number(delivery.price).toFixed(2)}
                  </CardDescription>
                </div>
                {getStatusBadge(delivery.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Pickup */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <Package className="h-5 w-5 text-primary" />
                    Coleta
                  </div>
                  <p className="text-sm text-muted-foreground ml-7">{delivery.pickup_address}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-7 transition-all duration-300 hover:scale-105 active:scale-95"
                    onClick={() => openInMaps(Number(delivery.pickup_latitude), Number(delivery.pickup_longitude), delivery.pickup_address)}
                  >
                    <MapPin className="mr-2 h-4 w-4" />
                    Abrir no Maps
                  </Button>
                  {delivery.status === 'pending' && (
                    <Button 
                      onClick={acceptDelivery} 
                      className="ml-7 mt-2 animate-scale-in transition-all duration-300 hover:scale-110 active:scale-95"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Aceitar Coleta
                    </Button>
                  )}
                  {delivery.status === 'accepted' && (
                    <Button 
                      onClick={markAsPickedUp} 
                      className="ml-7 mt-2 animate-scale-in transition-all duration-300 hover:scale-110 active:scale-95"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Coletado
                    </Button>
                  )}
                </div>

                {/* Delivery */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <MapPin className="h-5 w-5 text-primary" />
                    Entrega
                  </div>
                  <p className="text-sm text-muted-foreground ml-7">{delivery.delivery_address}</p>
                  
                  {/* Recipient contact info - only visible to assigned driver */}
                  {(delivery.status === 'accepted' || delivery.status === 'picked_up') && (
                    <div className="ml-7 mt-3 p-3 bg-muted/50 rounded-lg border">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Contato do Destinatário</p>
                      {delivery.recipient_name && (
                        <p className="text-sm">
                          <span className="font-medium">Nome:</span> {delivery.recipient_name}
                        </p>
                      )}
                      {delivery.recipient_phone && (
                        <p className="text-sm">
                          <span className="font-medium">Tel:</span> {delivery.recipient_phone}
                        </p>
                      )}
                    </div>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-7 transition-all duration-300 hover:scale-105 active:scale-95"
                    onClick={() => openInMaps(Number(delivery.delivery_latitude), Number(delivery.delivery_longitude), delivery.delivery_address)}
                  >
                    <MapPin className="mr-2 h-4 w-4" />
                    Abrir no Maps
                  </Button>
                  {delivery.status === 'picked_up' && (
                    <Button 
                      onClick={markAsDelivered} 
                      className="ml-7 mt-2 animate-scale-in transition-all duration-300 hover:scale-110 active:scale-95"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Entregue
                    </Button>
                  )}
                </div>

                {delivery.description && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-1">Observações</p>
                    <p className="text-sm text-muted-foreground">{delivery.description}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Linha do Tempo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-2 bg-primary rounded-full"></div>
                  <div className="flex-1 pb-4">
                    <p className="font-medium">Entrega Aceita</p>
                    <p className="text-sm text-muted-foreground">
                      {delivery.accepted_at ? new Date(delivery.accepted_at).toLocaleString('pt-BR') : '—'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className={`w-2 rounded-full ${delivery.picked_up_at ? 'bg-primary' : 'bg-muted'}`}></div>
                  <div className="flex-1 pb-4">
                    <p className="font-medium">Pedido Coletado</p>
                    <p className="text-sm text-muted-foreground">
                      {delivery.picked_up_at ? new Date(delivery.picked_up_at).toLocaleString('pt-BR') : 'Aguardando...'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className={`w-2 rounded-full ${delivery.status === 'delivered' ? 'bg-primary' : 'bg-muted'}`}></div>
                  <div className="flex-1">
                    <p className="font-medium">Entrega Concluída</p>
                    <p className="text-sm text-muted-foreground">
                      {delivery.status === 'delivered' ? 'Concluído' : 'Aguardando...'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
