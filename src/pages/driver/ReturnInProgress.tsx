import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MapPin, Navigation, Clock, CheckCircle, AlertCircle,
  PartyPopper, LayoutDashboard, X, Star,
} from 'lucide-react';
import { useCompleteDelivery } from '@/hooks/useCompleteDelivery';
import { useDriverLocationTracking } from '@/hooks/useDriverLocationTracking';
import { useMapNavigation } from '@/hooks/useMapNavigation';
import { CancelDeliveryModal } from '@/components/CancelDeliveryModal';
import { RatingModal } from '@/components/RatingModal';
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
  restaurant_id: string | null;
}

export default function ReturnInProgress() {
  const { deliveryId } = useParams<{ deliveryId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [earnings, setEarnings] = useState(0);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [restaurantForRating, setRestaurantForRating] = useState<{ userId: string; name: string } | null>(null);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: driverData } = useQuery({
    queryKey: ['driver-id', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('drivers').select('id').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
  const driverId = driverData?.id ?? null;

  const { data: delivery, isLoading } = useQuery<Delivery>({
    queryKey: ['return-in-progress', deliveryId, driverId],
    queryFn: async () => {
      const { data, error } = await supabase.from('deliveries').select('*').eq('id', deliveryId!).single();
      if (error || !data) throw new Error('Entrega não encontrada');
      if (!data.driver_id || data.driver_id !== driverId) throw new Error('Acesso negado');

      // Status já correto
      if (data.status === 'returning') return data as Delivery;

      // Corrige status se necessário
      if (data.status === 'picked_up' && data.requires_return) {
        await supabase.from('deliveries').update({ status: 'returning' }).eq('id', deliveryId!);
        return { ...data, status: 'returning' } as Delivery;
      }

      // Status incompatível — lança para o effect redirecionar
      throw new Error(`wrong-status:${data.status}`);
    },
    enabled: !!deliveryId && !!driverId,
    staleTime: 15 * 1000,
    retry: false,
  });

  // ── Redireciona quando status incompatível ────────────────────────────────
  useEffect(() => {
    // handled via react-query error
  }, []);

  // ── Hooks de entrega ──────────────────────────────────────────────────────
  const destination: [number, number] | null = delivery
    ? [Number(delivery.pickup_latitude), Number(delivery.pickup_longitude)]
    : null;

  const { route } = useMapNavigation(currentPosition, destination);

  useDriverLocationTracking({
    driverId: driverId || '',
    deliveryId: deliveryId || '',
    isActive: !!driverId && !!deliveryId,
  });

  // ── Complete delivery ─────────────────────────────────────────────────────
  const { completeDelivery, loading: completing } = useCompleteDelivery({
    onSuccess: async (_, __, transaction) => {
      setEarnings(transaction?.driver_earnings ?? Number(delivery?.price_adjusted || delivery?.price || 0) * 0.8);
      setShowSuccess(true);

      // Busca dados do restaurante para avaliação
      if (delivery?.restaurant_id) {
        try {
          const { data: rest } = await supabase
            .from('restaurants')
            .select('user_id, profiles!restaurants_user_id_fkey(full_name)')
            .eq('id', delivery.restaurant_id)
            .maybeSingle();
          if (rest?.user_id) {
            setRestaurantForRating({
              userId: rest.user_id,
              name: (rest.profiles as any)?.full_name || 'Estabelecimento',
            });
          }
        } catch { /* silently ignore */ }
      }
    },
  });

  // ── Geolocation ───────────────────────────────────────────────────────────
  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => { setCurrentPosition([pos.coords.latitude, pos.coords.longitude]); setGeoError(false); },
      () => setGeoError(true),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // ── Confirm return ────────────────────────────────────────────────────────
  const handleConfirmReturn = async () => {
    if (!deliveryId || !driverId || !delivery) return;

    const { data: fresh } = await supabase
      .from('deliveries').select('status').eq('id', deliveryId).single();

    if (fresh?.status === 'delivered') {
      setEarnings(Number(delivery.price_adjusted || delivery.price) * 0.8);
      setShowSuccess(true);
      return;
    }

    const { error: revertErr } = await supabase
      .from('deliveries')
      .update({ status: 'picked_up', returned_at: new Date().toISOString() })
      .eq('id', deliveryId);

    if (revertErr) {
      toast({ title: 'Erro', description: 'Não foi possível confirmar o retorno.', variant: 'destructive' });
      return;
    }

    await completeDelivery(deliveryId, driverId, Number(delivery.price));
  };

  const openGPS = () => {
    if (!delivery) return;
    window.open(getGoogleMapsLink(
      currentPosition || undefined,
      [delivery.pickup_latitude, delivery.pickup_longitude],
    ), '_blank');
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    if (restaurantForRating) {
      setTimeout(() => setShowRatingModal(true), 200);
    } else {
      navigate('/driver/dashboard', { replace: true });
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading || !driverId) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-900">
        <div className="flex-1 relative"><Skeleton className="absolute inset-0 bg-gray-800" /></div>
        <div className="p-4 space-y-3 bg-white">
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
      <div className="min-h-screen flex flex-col bg-gray-900">

        {/* Header flutuante */}
        <div className="absolute top-0 left-0 right-0 z-20 p-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
          <Card className="shadow-xl" style={{ background: 'rgba(15,20,35,0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost" size="sm"
                  className="h-8 px-2 text-white/60 hover:text-white hover:bg-white/10"
                  onClick={() => navigate('/driver/dashboard')}
                >
                  <LayoutDashboard className="w-4 h-4 mr-1" />
                  Dashboard
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={() => setShowCancelModal(true)}
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancelar
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-base">↩️</span>
                    <p className="text-xs font-bold text-orange-400 uppercase tracking-wide">RETORNANDO</p>
                  </div>
                  <p className="text-sm font-semibold text-white">Voltando ao ponto de coleta</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {routeDistance && (
                    <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs">
                      <Navigation className="w-3 h-3 mr-1" />{routeDistance} km
                    </Badge>
                  )}
                  <Badge variant="secondary" className="bg-white/10 text-white/70 border-0 text-xs">
                    <Clock className="w-3 h-3 mr-1" />~{estimatedTime} min
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mapa fullscreen */}
        <div className="flex-1 relative" style={{ minHeight: '55vh' }}>
          {currentPosition && destination ? (
            <MapContainer
              center={currentPosition} zoom={14}
              style={{ height: '100%', width: '100%', minHeight: '55vh' }}
              zoomControl={false} attributionControl={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapBounds
                bounds={route?.coordinates?.length ? route.coordinates : [currentPosition, destination]}
              />
              <Marker position={currentPosition} icon={driverIcon} />
              {route && route.coordinates.length > 0 && (
                <Polyline positions={route.coordinates} color="#f97316" weight={5} opacity={0.85} />
              )}
              <Marker position={destination} icon={pickupIcon} />
            </MapContainer>
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-800 min-h-[55vh]">
              {geoError ? (
                <div className="text-center">
                  <AlertCircle className="h-10 w-10 text-yellow-400 mx-auto mb-2" />
                  <p className="text-white font-semibold">GPS indisponível</p>
                  <p className="text-white/60 text-sm">Ative a localização</p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-white/60 text-sm">Obtendo localização...</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom sheet */}
        <div className="bg-white rounded-t-3xl shadow-2xl z-10"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-4" />

          <div className="px-4 space-y-3 pb-2">
            {/* Ponto de retorno */}
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-5 w-5 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider mb-0.5">Ponto de Retorno</p>
                  <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                    {formatAddress(delivery.pickup_address)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Confirme ao chegar no local</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-base font-bold text-orange-600">
                    R$ {Number(delivery.price_adjusted || delivery.price).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">ao retornar</p>
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="flex gap-3">
              <button
                onClick={openGPS}
                className="flex-1 h-12 rounded-2xl bg-gray-100 text-gray-700 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Navigation className="h-4 w-4" />
                Abrir GPS
              </button>
              <button
                onClick={handleConfirmReturn}
                disabled={completing}
                className="flex-1 h-12 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-all active:scale-95"
                style={{
                  background: completing ? '#9ca3af' : '#f97316',
                  boxShadow: completing ? 'none' : '0 4px 16px rgba(249,115,22,0.4)',
                }}
              >
                {completing ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Confirmando...</>
                ) : (
                  <><CheckCircle className="h-4 w-4" /> Confirmar Retorno</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de sucesso */}
      <Dialog open={showSuccess} onOpenChange={handleSuccessClose}>
        <DialogContent className="sm:max-w-md text-center rounded-3xl">
          <DialogHeader className="space-y-4">
            <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mx-auto">
              <PartyPopper className="w-10 h-10 text-orange-500" />
            </div>
            <DialogTitle className="text-2xl">Retorno Confirmado! ↩️</DialogTitle>
            <DialogDescription className="text-base">
              Entrega concluída com sucesso.{' '}
              <span className="font-bold text-orange-600">R$ {earnings.toFixed(2)}</span>{' '}
              foi creditado na sua carteira.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4">
            {restaurantForRating && (
              <Button
                onClick={() => { setShowSuccess(false); setTimeout(() => setShowRatingModal(true), 200); }}
                size="lg"
                className="w-full bg-amber-400 hover:bg-amber-500 text-white gap-2"
              >
                <Star className="h-5 w-5 fill-white" />
                Avaliar estabelecimento
              </Button>
            )}
            <Button
              onClick={handleSuccessClose}
              size="lg"
              className={`w-full ${restaurantForRating ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-orange-500 hover:bg-orange-600'}`}
            >
              Voltar ao Início
            </Button>
          </div>
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

      {/* Rating Modal */}
      {showRatingModal && restaurantForRating && deliveryId && (
        <RatingModal
          deliveryId={deliveryId}
          raterRole="driver"
          targetUserId={restaurantForRating.userId}
          targetName={restaurantForRating.name}
          onClose={() => { setShowRatingModal(false); navigate('/driver/dashboard', { replace: true }); }}
          onSubmitted={() => { setShowRatingModal(false); navigate('/driver/dashboard', { replace: true }); }}
        />
      )}
    </>
  );
}
