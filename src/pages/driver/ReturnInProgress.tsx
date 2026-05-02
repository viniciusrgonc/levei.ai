import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MapPin, Navigation, Clock, CheckCircle, AlertCircle,
  PartyPopper, LayoutDashboard, X,
} from 'lucide-react';
import { useCompleteDelivery } from '@/hooks/useCompleteDelivery';
import { useDriverLocationTracking } from '@/hooks/useDriverLocationTracking';
import { useMapNavigation } from '@/hooks/useMapNavigation';
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
} from '@/components/ui/dialog';
import { formatAddress } from '@/lib/utils';

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
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

function MapBounds({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => { map.fitBounds(bounds, { padding: [60, 60] }); }, [map, bounds]);
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
  pickup_latitude: number;
  pickup_longitude: number;
  delivery_latitude: number;
  delivery_longitude: number;
  driver_id: string;
  requires_return: boolean | null;
}

export default function ReturnInProgress() {
  const { deliveryId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [earnings, setEarnings] = useState(0);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const { completeDelivery, loading: completing } = useCompleteDelivery({
    onSuccess: (_, __, transaction) => {
      setEarnings(transaction?.driver_earnings ?? Number(delivery?.price_adjusted || delivery?.price || 0) * 0.8);
      setShowSuccess(true);
    },
  });

  // Destination for the return leg = pickup coordinates
  const destination: [number, number] | null = delivery
    ? [Number(delivery.pickup_latitude), Number(delivery.pickup_longitude)]
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
      (pos) => { setCurrentPosition([pos.coords.latitude, pos.coords.longitude]); setGeoError(false); },
      () => setGeoError(true),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => { if (deliveryId && user) fetchDriver(); }, [deliveryId, user]);
  useEffect(() => { if (driverId && deliveryId) fetchDelivery(); }, [driverId, deliveryId]);

  const fetchDriver = async () => {
    const { data } = await supabase.from('drivers').select('id').eq('user_id', user?.id).single();
    if (data) setDriverId(data.id);
  };

  const fetchDelivery = async () => {
    const { data, error } = await supabase.from('deliveries').select('*').eq('id', deliveryId).single();
    if (error || !data) {
      toast({ title: 'Erro', description: 'Entrega não encontrada', variant: 'destructive' });
      navigate('/driver/dashboard');
      return;
    }
    if (!data.driver_id || data.driver_id !== driverId) {
      toast({ title: 'Acesso Negado', variant: 'destructive' });
      navigate('/driver/dashboard');
      return;
    }

    console.log('[ReturnInProgress] Status atual ao carregar:', data.status);

    // Aceita 'returning' ou 'picked_up' com requires_return (recupera fluxo interrompido)
    if (data.status === 'returning') {
      setDelivery(data);
      setLoading(false);
      return;
    }

    // Se status é picked_up e a entrega requer retorno, forçamos para 'returning'
    if (data.status === 'picked_up' && data.requires_return) {
      console.log('[ReturnInProgress] Forçando status para returning...');
      const { error: fixErr } = await supabase
        .from('deliveries')
        .update({ status: 'returning' })
        .eq('id', deliveryId!);
      if (!fixErr) {
        data.status = 'returning';
        setDelivery(data);
        setLoading(false);
        return;
      }
    }

    // Redireciona baseado no status atual
    if (['accepted', 'picking_up'].includes(data.status)) {
      navigate(`/driver/pickup/${deliveryId}`, { replace: true });
    } else if (['picked_up', 'delivering'].includes(data.status)) {
      navigate(`/driver/delivery/${deliveryId}`, { replace: true });
    } else if (data.status === 'delivered') {
      navigate('/driver/dashboard', { replace: true });
    } else {
      navigate('/driver/dashboard');
    }
  };

  const handleConfirmReturn = async () => {
    if (!deliveryId || !driverId || !delivery) return;

    // Busca o status mais recente do banco (não confia só no estado local)
    const { data: fresh } = await supabase
      .from('deliveries')
      .select('status')
      .eq('id', deliveryId)
      .single();

    console.log('[ReturnInProgress] Status atual antes de finalizar:', fresh?.status);

    const currentStatus = fresh?.status as string | undefined;

    // Se já foi finalizada, mostra sucesso diretamente
    if (currentStatus === 'delivered') {
      setEarnings(Number(delivery.price_adjusted || delivery.price) * 0.8);
      setShowSuccess(true);
      return;
    }

    // Garante que o status é 'returning' antes de chamar completeDelivery
    if (currentStatus !== 'returning') {
      console.log('[ReturnInProgress] Status incorreto, corrigindo para returning...');
      const { error: fixErr } = await supabase
        .from('deliveries')
        .update({ status: 'returning' })
        .eq('id', deliveryId);

      if (fixErr) {
        console.error('[ReturnInProgress] Erro ao corrigir status:', fixErr);
        toast({
          title: 'Erro',
          description: 'Não foi possível confirmar o status da entrega. Tente novamente.',
          variant: 'destructive',
        });
        return;
      }
      console.log('[ReturnInProgress] Status corrigido para returning ✓');
    }

    // Registra returned_at e finaliza
    await supabase
      .from('deliveries')
      .update({ returned_at: new Date().toISOString() })
      .eq('id', deliveryId);

    await completeDelivery(deliveryId, driverId, Number(delivery.price));
  };

  const openGPS = () => {
    if (!delivery) return;
    const url = getGoogleMapsLink(
      currentPosition || undefined,
      [delivery.pickup_latitude, delivery.pickup_longitude],
    );
    window.open(url, '_blank');
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    navigate('/driver/dashboard', { replace: true });
  };

  if (loading) {
    return (
      <div className="flex-mobile-column bg-background">
        <div className="flex-1 relative"><Skeleton className="absolute inset-0" /></div>
        <div className="p-responsive space-y-3 safe-bottom shrink-0">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!delivery) return null;

  const estimatedTime = route
    ? Math.ceil(route.duration / 60)
    : Math.ceil(Number(delivery.distance_km) * 3);
  const routeDistance = route ? (route.distance / 1000).toFixed(1) : null;

  return (
    <>
      <div className="flex-mobile-column bg-background">

        {/* Header flutuante */}
        <div className="floating-header p-3 sm:p-4">
          <Card className="glass">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <Button
                  variant="ghost" size="sm"
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('/driver/dashboard')}
                >
                  <LayoutDashboard className="w-4 h-4 mr-1" />
                  <span className="hidden xs:inline">Dashboard</span>
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShowCancelModal(true)}
                >
                  <X className="w-4 h-4 mr-1" />
                  <span className="hidden xs:inline">Cancelar</span>
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-base">↩️</span>
                    <p className="text-responsive-xs font-medium text-orange-600 uppercase tracking-wide">
                      RETORNANDO
                    </p>
                  </div>
                  <p className="text-responsive-sm font-semibold text-foreground truncate">
                    Voltando ao ponto de coleta
                  </p>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  {routeDistance && (
                    <Badge className="bg-orange-100 text-orange-700 border-none text-xs">
                      <Navigation className="w-3 h-3 mr-1" />{routeDistance} km
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    <Clock className="w-3 h-3 mr-1" />~{estimatedTime} min
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
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapBounds
                bounds={route?.coordinates?.length ? route.coordinates : [currentPosition, destination]}
              />
              <Marker position={currentPosition} icon={driverIcon} />
              {route && route.coordinates.length > 0 && (
                <Polyline positions={route.coordinates} color="#f97316" weight={5} opacity={0.8} />
              )}
              <Marker position={destination} icon={pickupIcon} />
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

        {/* Bottom sheet */}
        <div className="bg-background border-t border-border p-responsive space-y-3 safe-bottom animate-slide-up-sheet shrink-0">

          {/* Ponto de retorno */}
          <Card className="card-dynamic border-orange-200">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="avatar-responsive-sm rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                  <MapPin className="icon-responsive-sm text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-responsive-xs font-medium text-orange-500 uppercase tracking-wide">
                    PONTO DE RETORNO
                  </p>
                  <p className="text-responsive-sm text-foreground line-clamp-2">
                    {formatAddress(delivery.pickup_address)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Confirme o retorno ao chegar no local
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-responsive-lg font-bold text-orange-600">
                    R$ {Number(delivery.price_adjusted || delivery.price).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">ao retornar</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ações */}
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <Button onClick={openGPS} variant="outline" size="lg" className="btn-touch">
              <Navigation className="icon-responsive-sm mr-2" />
              <span className="text-responsive-sm">Abrir GPS</span>
            </Button>
            <Button
              onClick={handleConfirmReturn}
              disabled={completing}
              size="lg"
              className="btn-touch font-semibold bg-orange-500 hover:bg-orange-600 text-white"
            >
              <CheckCircle className="icon-responsive-sm mr-2" />
              <span className="text-responsive-sm">
                {completing ? 'Confirmando...' : 'Confirmar Retorno'}
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de sucesso */}
      <Dialog open={showSuccess} onOpenChange={handleSuccessClose}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader className="space-y-4">
            <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mx-auto animate-scale-in">
              <PartyPopper className="w-10 h-10 text-orange-500" />
            </div>
            <DialogTitle className="text-2xl">Retorno Confirmado! ↩️</DialogTitle>
            <DialogDescription className="text-base">
              Entrega concluída com sucesso.{' '}
              <span className="font-bold text-orange-600">
                R$ {earnings.toFixed(2)}
              </span>{' '}
              foi creditado na sua carteira.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={handleSuccessClose} size="lg" className="w-full mt-4 bg-orange-500 hover:bg-orange-600">
            Voltar ao Início
          </Button>
        </DialogContent>
      </Dialog>

      {/* Cancel Modal */}
      {deliveryId && (
        <CancelDeliveryModal
          deliveryId={deliveryId}
          open={showCancelModal}
          onOpenChange={setShowCancelModal}
          onCancelled={() => { setShowCancelModal(false); navigate('/driver/dashboard', { replace: true }); }}
        />
      )}
    </>
  );
}
