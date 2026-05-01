import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, MapPin, Phone, MessageCircle, Navigation, Clock, CheckCircle2, Package, Star, X, XCircle, ChevronRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useRealtimeDriverLocation } from '@/hooks/useRealtimeDriverLocation';
import DeliveryMap from '@/components/DeliveryMap';
import { getGoogleMapsLink, formatAddress } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { RatingModal } from '@/components/RatingModal';
import { CancelDeliveryModal } from '@/components/CancelDeliveryModal';
import { BottomNav } from '@/components/BottomNav';
import leveiLogo from '@/assets/levei-logo.png';

type Delivery = {
  id: string;
  pickup_address: string;
  delivery_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  delivery_latitude: number;
  delivery_longitude: number;
  recipient_name: string | null;
  recipient_phone: string | null;
  distance_km: number;
  price: number;
  price_adjusted: number;
  status: string;
  created_at: string;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  driver_id: string | null;
};

type Driver = {
  id: string;
  user_id: string;
  vehicle_type: string;
  license_plate: string;
  rating: number;
  profiles: { full_name: string; phone: string | null };
};

const vehicleLabel: Record<string, string> = {
  bike: 'Bicicleta', motorcycle: 'Moto', car: 'Carro', truck: 'Van/Caminhão',
};

// ── Query functions ────────────────────────────────────────────────────────

async function fetchDelivery(deliveryId: string): Promise<Delivery> {
  const { data, error } = await supabase
    .from('deliveries').select('*').eq('id', deliveryId).single();
  if (error || !data) throw new Error('Entrega não encontrada');
  return data as Delivery;
}

async function fetchDriver(driverId: string): Promise<Driver> {
  const { data, error } = await supabase
    .from('drivers')
    .select('*, profiles!drivers_user_id_fkey (full_name, phone)')
    .eq('id', driverId).single();
  if (error || !data) throw new Error('Entregador não encontrado');
  return data as any as Driver;
}

async function fetchHasRated(deliveryId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('ratings').select('id')
    .eq('delivery_id', deliveryId).eq('rated_by', userId).maybeSingle();
  return !!data;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function DeliveryTracking() {
  const { deliveryId } = useParams<{ deliveryId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [autoRatingShown, setAutoRatingShown] = useState(false);

  const { currentLocation, locationHistory } = useRealtimeDriverLocation(deliveryId || '');

  // ── Delivery query ─────────────────────────────────────────────────────
  const {
    data: delivery,
    isLoading,
    error: deliveryError,
  } = useQuery<Delivery>({
    queryKey: ['delivery-tracking', deliveryId],
    queryFn: () => fetchDelivery(deliveryId!),
    enabled: !!deliveryId,
    staleTime: 10 * 1000,          // 10s — realtime vai invalidar
    refetchInterval: 20 * 1000,    // fallback polling 20s
  });

  // ── Driver query — dependente de delivery.driver_id ────────────────────
  const { data: driver } = useQuery<Driver>({
    queryKey: ['delivery-driver', delivery?.driver_id],
    queryFn: () => fetchDriver(delivery!.driver_id!),
    enabled: !!delivery?.driver_id,
    staleTime: 5 * 60 * 1000,
  });

  // ── Rating check ────────────────────────────────────────────────────────
  const { data: hasRated = false, refetch: refetchRating } = useQuery<boolean>({
    queryKey: ['delivery-rated', deliveryId, user?.id],
    queryFn: () => fetchHasRated(deliveryId!, user!.id),
    enabled: !!deliveryId && !!user?.id && delivery?.status === 'delivered',
    staleTime: 60 * 1000,
  });

  // ── Realtime: invalida o cache quando a entrega muda ───────────────────
  useEffect(() => {
    if (!deliveryId) return;
    const channel = supabase
      .channel(`delivery-tracking-rq-${deliveryId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'deliveries',
        filter: `id=eq.${deliveryId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['delivery-tracking', deliveryId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [deliveryId, queryClient]);

  // ── Auto-show rating modal when delivered ─────────────────────────────
  useEffect(() => {
    if (
      delivery?.status === 'delivered' &&
      driver && !hasRated && !autoRatingShown
    ) {
      setAutoRatingShown(true);
      setTimeout(() => setShowRatingModal(true), 1500);
    }
  }, [delivery?.status, driver, hasRated, autoRatingShown]);

  // ── Error / not found ─────────────────────────────────────────────────
  useEffect(() => {
    if (deliveryError) {
      toast({ variant: 'destructive', title: 'Entrega não encontrada' });
      navigate('/restaurant/dashboard');
    }
  }, [deliveryError, navigate]);

  const handleCall = () => {
    if (driver?.profiles.phone) window.open(`tel:${driver.profiles.phone}`, '_self');
  };

  const openInMaps = (lat: number, lng: number) => {
    window.open(getGoogleMapsLink(undefined, [lat, lng]), '_blank');
  };

  // ── Loading ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-primary flex flex-col p-6 gap-4">
        <Skeleton className="h-12 w-full bg-white/10" />
        <Skeleton className="h-64 w-full bg-white/10" />
        <Skeleton className="h-32 w-full bg-white/10" />
      </div>
    );
  }

  if (!delivery) return null;

  /* ─── PENDING: radar search screen ──────────────────────────────────── */
  if (delivery.status === 'pending') {
    return (
      <div className="min-h-screen flex flex-col bg-primary text-white">
        <div className="flex items-center px-4 pb-4 gap-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
          <button
            onClick={() => navigate('/restaurant/dashboard')}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <img src={leveiLogo} alt="Levei.ai" className="h-8 w-8 rounded-xl object-cover" />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
          <div className="relative flex items-center justify-center">
            {[0, 1, 2].map((i) => (
              <span key={i} className="absolute rounded-full border-2 border-white/30 animate-ping"
                style={{ width: `${(i + 1) * 80}px`, height: `${(i + 1) * 80}px`,
                  animationDelay: `${i * 0.6}s`, animationDuration: '2s' }} />
            ))}
            {[1, 2, 3].map((i) => (
              <span key={`static-${i}`} className="absolute rounded-full border border-white/10"
                style={{ width: `${i * 80}px`, height: `${i * 80}px` }} />
            ))}
            <div className="relative z-10 w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-2xl">
              <Package className="h-7 w-7 text-primary" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">Procurando entregador...</h2>
            <p className="text-white/70 text-sm">Estamos encontrando o melhor entregador disponível perto de você</p>
          </div>

          <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
            <Clock className="h-4 w-4 text-white/80" />
            <span className="text-sm font-medium">Tempo médio: 1–2 min</span>
          </div>

          <div className="w-full bg-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-400/20 flex items-center justify-center flex-shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/60">Coleta</p>
                <p className="text-sm font-medium truncate">{formatAddress(delivery.pickup_address)}</p>
              </div>
            </div>
            <div className="border-l-2 border-dashed border-white/20 ml-4 h-3" />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-400/20 flex items-center justify-center flex-shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/60">Destino</p>
                <p className="text-sm font-medium truncate">{formatAddress(delivery.delivery_address)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 pb-28">
          <button onClick={() => setShowCancelModal(true)}
            className="w-full py-4 rounded-2xl border-2 border-white/30 text-white font-semibold text-base">
            Cancelar busca
          </button>
        </div>

        <BottomNav />
        <CancelDeliveryModal
          deliveryId={delivery.id} open={showCancelModal}
          onOpenChange={setShowCancelModal}
          onCancelled={() => {
            setShowCancelModal(false);
            queryClient.invalidateQueries({ queryKey: ['delivery-tracking', deliveryId] });
          }}
        />
      </div>
    );
  }

  /* ─── CANCELLED ──────────────────────────────────────────────────────── */
  if (delivery.status === 'cancelled') {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <div className="flex items-center px-4 pt-10 pb-4 gap-3 bg-white border-b">
          <button onClick={() => navigate('/restaurant/dashboard')}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <span className="font-semibold text-gray-900">Entrega cancelada</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
            <XCircle className="h-10 w-10 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Entrega Cancelada</h2>
          <p className="text-gray-500 text-sm">Esta entrega foi cancelada e não está mais disponível.</p>
          <button onClick={() => navigate('/restaurant/dashboard')}
            className="mt-4 px-8 py-3 rounded-2xl bg-primary text-white font-semibold">
            Voltar ao início
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  /* ─── DELIVERED ──────────────────────────────────────────────────────── */
  if (delivery.status === 'delivered') {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <div className="flex items-center px-4 pt-10 pb-4 gap-3 bg-white border-b">
          <button onClick={() => navigate('/restaurant/dashboard')}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <span className="font-semibold text-gray-900">Entrega concluída</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Entrega Concluída!</h2>
          {delivery.delivered_at && (
            <p className="text-gray-500 text-sm">
              Entregue em {new Date(delivery.delivered_at).toLocaleString('pt-BR')}
            </p>
          )}
          {driver && !hasRated && (
            <button onClick={() => setShowRatingModal(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-white font-semibold">
              <Star className="h-5 w-5" />Avaliar Entregador
            </button>
          )}
          {hasRated && (
            <p className="text-sm text-green-600 flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-current" />Você já avaliou esta entrega
            </p>
          )}
          <button onClick={() => navigate('/restaurant/dashboard')}
            className="px-8 py-3 rounded-2xl border-2 border-gray-200 text-gray-700 font-semibold">
            Voltar ao início
          </button>
        </div>
        <BottomNav />
        {showRatingModal && driver && (
          <RatingModal
            deliveryId={delivery.id} driverUserId={driver.user_id}
            driverName={driver.profiles.full_name}
            onClose={() => setShowRatingModal(false)}
            onSubmitted={() => {
              setShowRatingModal(false);
              refetchRating();
            }}
          />
        )}
      </div>
    );
  }

  /* ─── ACTIVE (accepted / picking_up / picked_up / delivering) ─────────── */
  const statusLabel: Record<string, { title: string; subtitle: string; color: string }> = {
    accepted:   { title: 'Entregador confirmado',  subtitle: 'A caminho da coleta',           color: 'text-blue-600'   },
    picking_up: { title: 'Coletando pedido',        subtitle: 'Entregador no local de coleta', color: 'text-orange-500' },
    picked_up:  { title: 'Pedido coletado',         subtitle: 'A caminho do destino',          color: 'text-purple-600' },
    delivering: { title: 'Em rota de entrega',      subtitle: 'Seu pedido está chegando',      color: 'text-purple-600' },
  };
  const currentStatus = statusLabel[delivery.status] ?? statusLabel.accepted;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* Map — full bleed */}
      <div className="relative bg-gray-200">
        <DeliveryMap
          pickupLat={delivery.pickup_latitude} pickupLng={delivery.pickup_longitude}
          deliveryLat={delivery.delivery_latitude} deliveryLng={delivery.delivery_longitude}
          driverLat={currentLocation?.latitude} driverLng={currentLocation?.longitude}
          locationHistory={locationHistory} heightPx={256}
        />
        <button
          onClick={() => navigate('/restaurant/dashboard')}
          className="absolute left-4 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center z-10"
          style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
        >
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>
        {currentLocation && (
          <div className="absolute top-4 right-4 bg-white rounded-full px-3 py-1.5 shadow-md flex items-center gap-1.5 z-10">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold text-gray-700">Ao vivo</span>
          </div>
        )}
      </div>

      {/* Bottom sheet */}
      <div className="flex-1 -mt-4 rounded-t-3xl bg-white shadow-lg overflow-auto pb-28">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-4" />

        {/* Status pill */}
        <div className="px-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-base font-bold ${currentStatus.color}`}>{currentStatus.title}</p>
              <p className="text-sm text-gray-500">{currentStatus.subtitle}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-primary">
                R$ {(delivery.price_adjusted || delivery.price).toFixed(2)}
              </p>
              <p className="text-xs text-gray-400">{delivery.distance_km.toFixed(1)} km</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 flex items-center gap-1">
            {[
              { label: 'Aceito',   done: true },
              { label: 'Coleta',   done: ['picking_up', 'picked_up', 'delivering'].includes(delivery.status) },
              { label: 'Entregue', done: false },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center flex-1">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  step.done ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {step.done ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                </div>
                {i < arr.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 ${step.done ? 'bg-primary' : 'bg-gray-100'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-gray-400">
            <span>Aceito</span><span>Coleta</span><span>Entregue</span>
          </div>
        </div>

        <div className="h-px bg-gray-100 mx-4" />

        {/* Driver card */}
        {driver && (
          <div className="px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-bold text-primary">
                  {driver.profiles.full_name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">{driver.profiles.full_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="text-xs text-gray-600 font-medium">{driver.rating?.toFixed(1) ?? '5.0'}</span>
                  </div>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs text-gray-500">{vehicleLabel[driver.vehicle_type] ?? driver.vehicle_type}</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs text-gray-500">{driver.license_plate}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {driver.profiles.phone && (
                  <button onClick={handleCall}
                    className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                    <Phone className="h-4 w-4 text-white" />
                  </button>
                )}
                <button
                  onClick={() => toast({ title: 'Chat em breve', description: 'Funcionalidade disponível em breve.' })}
                  className="w-10 h-10 rounded-full bg-primary flex items-center justify-center"
                >
                  <MessageCircle className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="h-px bg-gray-100 mx-4" />

        {/* Route summary */}
        <div className="px-4 py-4 space-y-3">
          <button className="w-full flex items-center gap-3 text-left"
            onClick={() => openInMaps(delivery.pickup_latitude, delivery.pickup_longitude)}>
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400">Coleta</p>
              <p className="text-sm font-medium text-gray-800 truncate">{formatAddress(delivery.pickup_address)}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
          </button>
          <div className="border-l-2 border-dashed border-gray-200 ml-4 h-3" />
          <button className="w-full flex items-center gap-3 text-left"
            onClick={() => openInMaps(delivery.delivery_latitude, delivery.delivery_longitude)}>
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <MapPin className="h-4 w-4 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400">Destino</p>
              <p className="text-sm font-medium text-gray-800 truncate">{formatAddress(delivery.delivery_address)}</p>
              {delivery.recipient_name && (
                <p className="text-xs text-gray-400">Para: {delivery.recipient_name}</p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
          </button>
        </div>

        {/* Cancel — only early statuses */}
        {['accepted', 'picking_up'].includes(delivery.status) && (
          <div className="px-4 pb-4">
            <button onClick={() => setShowCancelModal(true)}
              className="w-full py-3 rounded-2xl border-2 border-red-200 text-red-500 font-semibold text-sm flex items-center justify-center gap-2">
              <X className="h-4 w-4" />Cancelar entrega
            </button>
          </div>
        )}
      </div>

      <BottomNav />

      <CancelDeliveryModal
        deliveryId={delivery.id} open={showCancelModal}
        onOpenChange={setShowCancelModal}
        onCancelled={() => {
          setShowCancelModal(false);
          queryClient.invalidateQueries({ queryKey: ['delivery-tracking', deliveryId] });
        }}
      />
    </div>
  );
}
