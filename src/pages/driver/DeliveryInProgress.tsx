import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Clock, CheckCircle, Phone, User, AlertCircle, PartyPopper, MessageCircle, LayoutDashboard, X, Camera } from 'lucide-react';
import { useCompleteDelivery } from '@/hooks/useCompleteDelivery';
import { useDriverLocationTracking } from '@/hooks/useDriverLocationTracking';
import { useMapNavigation } from '@/hooks/useMapNavigation';
import { useRouteDeliveries } from '@/hooks/useRouteDeliveries';
import { RouteProgressHeader } from '@/components/RouteProgressHeader';
import { CancelDeliveryModal } from '@/components/CancelDeliveryModal';
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
  is_additional_delivery: boolean | null;
  delivery_sequence: number | null;
  parent_delivery_id: string | null;
}

interface CompletionResult {
  earnings: number;
  isLastDelivery: boolean;
  totalRouteEarnings: number;
}

interface ConfirmationSettings {
  max_distance_meters: number;
  allow_outside_radius: boolean;
}

const calculateDistanceMeters = (from: [number, number], to: [number, number]) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(to[0] - from[0]);
  const dLng = toRad(to[1] - from[1]);
  const lat1 = toRad(from[0]);
  const lat2 = toRad(to[0]);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

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
  const [completionResult, setCompletionResult] = useState<CompletionResult | null>(null);
  const [remainingDeliveries, setRemainingDeliveries] = useState(0);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [confirmationSettings, setConfirmationSettings] = useState<ConfirmationSettings>({ max_distance_meters: 100, allow_outside_radius: true });
  const [isPreparingCompletion, setIsPreparingCompletion] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const { completeDelivery, loading: completing } = useCompleteDelivery({
    onSuccess: (_, __, transaction) => {
      if (transaction) {
        setCompletionResult({
          earnings: transaction.driver_earnings,
          isLastDelivery: transaction.is_last_delivery,
          totalRouteEarnings: transaction.total_route_earnings
        });
      } else {
        setCompletionResult({
          earnings: delivery ? Number(delivery.price_adjusted || delivery.price) * 0.80 : 0,
          isLastDelivery: true,
          totalRouteEarnings: 0
        });
      }
      setShowSuccess(true);
    }
  });

  const destination: [number, number] | null = delivery
    ? [Number(delivery.delivery_latitude), Number(delivery.delivery_longitude)]
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

  useEffect(() => {
    const fetchConfirmationSettings = async () => {
      const { data } = await (supabase as any)
        .from('delivery_confirmation_settings')
        .select('max_distance_meters, allow_outside_radius')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) setConfirmationSettings(data);
    };

    fetchConfirmationSettings();
  }, []);

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

  const getCompletionPosition = () => new Promise<[number, number]>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve([position.coords.latitude, position.coords.longitude]),
      reject,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
    );
  });

  const uploadConfirmationPhoto = async (file: File) => {
    if (!user || !deliveryId) throw new Error('Sessão inválida');
    const extension = file.name.split('.').pop() || 'jpg';
    const path = `${user.id}/${deliveryId}/${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from('delivery-photos').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

    if (error) throw error;
    return path;
  };

  const handlePhotoSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !deliveryId || !driverId || !delivery) return;

    setIsPreparingCompletion(true);
    try {
      const position = await getCompletionPosition();
      setCurrentPosition(position);
      const target: [number, number] = [Number(delivery.delivery_latitude), Number(delivery.delivery_longitude)];
      const distanceMeters = calculateDistanceMeters(position, target);
      const isWithinRadius = distanceMeters <= confirmationSettings.max_distance_meters;

      if (!isWithinRadius) {
        const message = `Você está a ${Math.round(distanceMeters)}m do destino. O limite configurado é ${confirmationSettings.max_distance_meters}m.`;
        if (!confirmationSettings.allow_outside_radius) {
          toast({ title: 'Fora do local de entrega', description: message, variant: 'destructive' });
          return;
        }
        const shouldContinue = window.confirm(`${message}\n\nDeseja finalizar mesmo assim?`);
        if (!shouldContinue) return;
      }

      const photoPath = await uploadConfirmationPhoto(file);
      await completeDelivery(deliveryId, driverId, Number(delivery.price), {
        photo_url: photoPath,
        latitude: position[0],
        longitude: position[1],
        outside_radius_allowed: !isWithinRadius && confirmationSettings.allow_outside_radius,
        metadata: {
          captured_at: new Date().toISOString(),
          distance_meters: Math.round(distanceMeters),
          otp_ready: true,
        },
      });
    } catch (error) {
      console.error('Delivery confirmation error:', error);
      toast({
        title: 'Não foi possível finalizar',
        description: 'Capture a foto e permita o acesso à localização para concluir a entrega.',
        variant: 'destructive',
      });
    } finally {
      setIsPreparingCompletion(false);
    }
  };

  const handleCompleteDelivery = async () => {
    if (!deliveryId || !driverId || !delivery) return;
    photoInputRef.current?.click();
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
      <div className="flex-mobile-column bg-background">
        <div className="flex-1 relative">
          <Skeleton className="absolute inset-0" />
        </div>
        <div className="p-responsive space-y-3 safe-bottom shrink-0">
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
      <div className="flex-mobile-column bg-background">
        {/* Header flutuante sobre o mapa */}
        <div className="floating-header p-3 sm:p-4">
          <Card className="glass">
            <CardContent className="p-3 space-y-2">
              {/* Dashboard button */}
              <div className="flex items-center justify-between mb-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('/driver/dashboard')}
                >
                  <LayoutDashboard className="w-4 h-4 mr-1" />
                  <span className="hidden xs:inline">Dashboard</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShowCancelModal(true)}
                >
                  <X className="w-4 h-4 mr-1" />
                  <span className="hidden xs:inline">Cancelar</span>
                </Button>
              </div>
              
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
                <div className="min-w-0 flex-1">
                  <p className="text-responsive-xs font-medium text-muted-foreground">ENTREGA</p>
                  <p className="text-responsive-sm font-semibold text-foreground truncate">Levando ao destino</p>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  {routeDistance && (
                    <Badge variant="secondary" className="text-xs">
                      <Navigation className="w-3 h-3 mr-1" />
                      {routeDistance} km
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    ~{estimatedTime} min
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mapa fullscreen */}
        <div className="flex-1 relative" style={{ minHeight: '40vh' }}>
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
                <div className="text-center p-responsive">
                  <AlertCircle className="icon-responsive-lg text-warning mx-auto mb-2" />
                  <p className="text-responsive-base font-medium">Localização indisponível</p>
                  <p className="text-responsive-sm text-muted-foreground">Ative o GPS do seu dispositivo</p>
                </div>
              ) : (
                <div className="animate-pulse text-muted-foreground">Obtendo localização...</div>
              )}
            </div>
          )}
        </div>

        {/* Bottom sheet com ações */}
        <div className="bg-background border-t border-border p-responsive space-y-3 safe-bottom animate-slide-up-sheet shrink-0">
          {/* Endereço de entrega e destinatário */}
          <Card className="card-dynamic">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="avatar-responsive-sm rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <MapPin className="icon-responsive-sm text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-responsive-xs font-medium text-muted-foreground">DESTINO</p>
                  <p className="text-responsive-sm text-foreground line-clamp-2">{delivery.delivery_address}</p>
                  
                  {/* Info do destinatário */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 pt-2 border-t border-border">
                    {delivery.recipient_name && (
                      <div className="flex items-center gap-1 text-responsive-xs text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span className="truncate max-w-[100px]">{delivery.recipient_name}</span>
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
                <div className="text-right shrink-0">
                  <p className="text-responsive-lg font-bold text-primary">
                    R$ {Number(delivery.price_adjusted || delivery.price).toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botões de ação */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <Button 
              onClick={openGPS}
              variant="outline"
              size="lg"
              className="btn-touch"
            >
              <Navigation className="icon-responsive-sm mr-2" />
              <span className="text-responsive-sm">Abrir GPS</span>
            </Button>

            <Button 
              onClick={handleCompleteDelivery}
              disabled={completing}
              size="lg"
              className="btn-touch font-semibold bg-success hover:bg-success/90"
            >
              <CheckCircle className="icon-responsive-sm mr-2" />
              <span className="text-responsive-sm">{completing ? 'Finalizando...' : 'Finalizar Entrega'}</span>
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
            <DialogTitle className="text-2xl">
              {completionResult?.isLastDelivery ? 'Rota Concluída!' : 'Entrega Concluída!'}
            </DialogTitle>
            <DialogDescription className="text-base">
              {completionResult?.isLastDelivery ? (
                <>
                  Parabéns! Sua rota foi finalizada.{' '}
                  <span className="font-bold text-success">
                    R$ {(completionResult?.totalRouteEarnings || completionResult?.earnings || 0).toFixed(2)}
                  </span>
                  {' '}foi creditado na sua carteira.
                </>
              ) : (
                <>
                  Continue para a próxima entrega da rota. O pagamento será creditado ao final.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <Button onClick={handleSuccessClose} size="lg" className="w-full mt-4">
            {completionResult?.isLastDelivery ? 'Voltar ao Início' : 'Próxima Entrega'}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Cancel Modal */}
      {deliveryId && (
        <CancelDeliveryModal
          deliveryId={deliveryId}
          open={showCancelModal}
          onOpenChange={setShowCancelModal}
          onCancelled={() => {
            setShowCancelModal(false);
            navigate('/driver/dashboard', { replace: true });
          }}
        />
      )}
    </>
  );
}