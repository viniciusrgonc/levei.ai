import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Clock, CheckCircle, Phone, User, AlertCircle, PartyPopper, MessageCircle } from 'lucide-react';
import { useCompleteDelivery } from '@/hooks/useCompleteDelivery';
import { useDriverLocationTracking } from '@/hooks/useDriverLocationTracking';
import { useMapNavigation } from '@/hooks/useMapNavigation';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from '@/hooks/use-toast';
import { getGoogleMapsLink } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

const deliveryIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
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
  recipient_name: string | null;
  recipient_phone: string | null;
  pickup_latitude: number;
  pickup_longitude: number;
  delivery_latitude: number;
  delivery_longitude: number;
  driver_id: string;
}

export default function DeliveryInProgress() {
  const { deliveryId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const { completeDelivery, loading: completing } = useCompleteDelivery({
    onSuccess: () => {
      setShowSuccess(true);
    }
  });

  const destination: [number, number] | null = delivery
    ? [Number(delivery.delivery_latitude), Number(delivery.delivery_longitude)]
    : null;

  const { route } = useMapNavigation(currentPosition, destination);

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

    if (data.status !== 'picked_up') {
      if (data.status === 'accepted') {
        navigate(`/driver/pickup/${deliveryId}`, { replace: true });
      } else {
        navigate('/driver/dashboard');
      }
      return;
    }

    setDelivery(data);
    setLoading(false);
  };

  const handleCompleteDelivery = async () => {
    if (!deliveryId || !driverId || !delivery) return;
    await completeDelivery(deliveryId, driverId, Number(delivery.price));
  };

  const openGPS = () => {
    if (!delivery) return;
    const url = getGoogleMapsLink(currentPosition || undefined, [delivery.delivery_latitude, delivery.delivery_longitude]);
    window.open(url, '_blank');
  };

  const callRecipient = () => {
    const phone = delivery?.recipient_phone;
    if (phone && phone.trim()) {
      const formattedPhone = phone.replace(/[^\d+]/g, '');
      window.location.href = `tel:${formattedPhone}`;
    } else {
      toast({
        title: 'Telefone indisponível',
        description: 'Número de telefone não cadastrado para este destinatário',
        variant: 'destructive',
      });
    }
  };

  const openWhatsApp = () => {
    const phone = delivery?.recipient_phone;
    if (phone && phone.trim()) {
      // Remove all non-digits for wa.me (no + needed)
      const formattedPhone = phone.replace(/\D/g, '');
      window.open(`https://wa.me/${formattedPhone}`, '_blank');
    } else {
      toast({
        title: 'WhatsApp indisponível',
        description: 'Número de telefone não cadastrado para este destinatário',
        variant: 'destructive',
      });
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    navigate('/driver/dashboard', { replace: true });
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
    <>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header flutuante sobre o mapa */}
        <div className="absolute top-0 left-0 right-0 z-[1000] p-4 safe-top">
          <Card className="glass">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">ENTREGA</p>
                  <p className="font-semibold text-foreground">Levando ao destino</p>
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
                  color="#ef4444"
                  weight={5}
                  opacity={0.8}
                />
              )}
              <Marker position={destination} icon={deliveryIcon} />
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
          {/* Endereço de entrega e destinatário */}
          <Card>
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">DESTINO</p>
                  <p className="text-sm text-foreground">{delivery.delivery_address}</p>
                  
                  {/* Info do destinatário */}
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border">
                    {delivery.recipient_name && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        {delivery.recipient_name}
                      </div>
                    )}
                    <Button 
                      onClick={callRecipient} 
                      variant="ghost" 
                      size="sm"
                      className="h-6 px-2 text-xs"
                    >
                      <Phone className="w-3 h-3 mr-1" />
                      Ligar
                    </Button>
                    <Button 
                      onClick={openWhatsApp} 
                      variant="ghost" 
                      size="sm"
                      className="h-6 px-2 text-xs text-green-600 hover:text-green-700"
                    >
                      <MessageCircle className="w-3 h-3 mr-1" />
                      WhatsApp
                    </Button>
                  </div>
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
              onClick={handleCompleteDelivery}
              disabled={completing}
              size="lg"
              className="h-14 font-semibold bg-success hover:bg-success/90"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              {completing ? 'Finalizando...' : 'Finalizar Entrega'}
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de sucesso */}
      <Dialog open={showSuccess} onOpenChange={handleSuccessClose}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader className="space-y-4">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto animate-scale-in">
              <PartyPopper className="w-10 h-10 text-success" />
            </div>
            <DialogTitle className="text-2xl">Entrega Concluída!</DialogTitle>
            <DialogDescription className="text-base">
              Parabéns! Você ganhou{' '}
              <span className="font-bold text-success">
                R$ {delivery ? (Number(delivery.price_adjusted || delivery.price) * 0.8).toFixed(2) : '0.00'}
              </span>
              {' '}com essa entrega.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={handleSuccessClose} size="lg" className="w-full mt-4">
            Voltar ao Início
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}