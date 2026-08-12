import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  MapPin, Navigation, Clock, CheckCircle, AlertTriangle,
  RotateCcw, MessageSquare,
} from 'lucide-react';
import { useDriverLocationTracking } from '@/hooks/useDriverLocationTracking';
import { useMapNavigation } from '@/hooks/useMapNavigation';
import { loadGoogleMapsScript } from '@/lib/googleMaps';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from '@/hooks/use-toast';
import { getGoogleMapsLink } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface Delivery {
  id: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  delivery_latitude: number;
  delivery_longitude: number;
  driver_id: string;
  restaurant_id: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  picked_up_at: string | null;
  cancelled_by_role: string | null;
  return_started_at: string | null;
}

export default function CancelledReturnInProgress() {
  const { deliveryId } = useParams<{ deliveryId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showFailedModal, setShowFailedModal] = useState(false);
  const [failedReason, setFailedReason] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const isGoogleRef = useRef(false);

  // ── Driver ID ─────────────────────────────────────────────────────────────
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

  // ── Delivery query ────────────────────────────────────────────────────────
  const { data: delivery, isLoading, error: deliveryError } = useQuery<Delivery>({
    queryKey: ['cancelled-return', deliveryId, driverId],
    queryFn: async () => {
      const { data, error } = await supabase.from('deliveries').select('*').eq('id', deliveryId!).single();
      if (error || !data) throw new Error('Entrega não encontrada');
      if (!data.driver_id || data.driver_id !== driverId) throw new Error('Acesso negado');
      const validStatuses = ['cancelled_return_pending', 'returning_package'];
      if (!validStatuses.includes(data.status)) throw new Error(`wrong-status:${data.status}`);
      return data as Delivery;
    },
    enabled: !!deliveryId && !!driverId,
    refetchInterval: 10_000,
    staleTime: 5_000,
    retry: false,
  });

  // Redireciona se status mudou para fora do fluxo de devolução
  useEffect(() => {
    if (!deliveryError) return;
    const msg = (deliveryError as Error).message ?? '';
    if (msg.startsWith('wrong-status:')) {
      const status = msg.replace('wrong-status:', '');
      if (status === 'cancellation_completed' || status === 'package_returned') {
        setShowSuccess(true);
      } else {
        navigate('/driver/dashboard', { replace: true });
      }
    }
  }, [deliveryError, navigate]);

  // ── Geolocation ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      ({ coords }) => setCurrentPosition([coords.latitude, coords.longitude]),
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Destination: pickup address (driver must return the package here)
  const destination: [number, number] | null = delivery
    ? [Number(delivery.pickup_latitude), Number(delivery.pickup_longitude)]
    : null;

  const { route } = useMapNavigation(currentPosition, destination);

  useDriverLocationTracking({
    driverId: driverId || '',
    deliveryId: deliveryId || '',
    isActive: !!driverId && !!deliveryId && delivery?.status === 'returning_package',
  });

  // ── Map ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current || !destination) return;
    const center = destination;

    loadGoogleMapsScript().then((ok) => {
      if (!mapContainerRef.current) return;
      if (ok) {
        isGoogleRef.current = true;
        const gm = (window as any).google.maps;
        const map = new gm.Map(mapContainerRef.current, {
          center: { lat: center[0], lng: center[1] },
          zoom: 15, disableDefaultUI: true, gestureHandling: 'greedy',
        });
        destMarkerRef.current = new gm.Marker({
          map, position: { lat: center[0], lng: center[1] },
          title: 'Local de coleta',
          icon: { path: gm.SymbolPath.CIRCLE, scale: 12, fillColor: '#f97316', fillOpacity: 1, strokeWeight: 3, strokeColor: 'white' },
        });
        driverMarkerRef.current = new gm.Marker({
          map,
          icon: { path: gm.SymbolPath.CIRCLE, scale: 10, fillColor: '#6b7280', fillOpacity: 1, strokeWeight: 3, strokeColor: 'white' },
        });
        mapInstanceRef.current = map;
      } else {
        isGoogleRef.current = false;
        const map = L.map(mapContainerRef.current, { center, zoom: 15, zoomControl: false, attributionControl: false });
        L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
          subdomains: ['0', '1', '2', '3'], maxZoom: 20,
        }).addTo(map);
        destMarkerRef.current = L.circleMarker(center, {
          radius: 10, fillColor: '#f97316', color: 'white', weight: 3, fillOpacity: 1,
        }).addTo(map);
        driverMarkerRef.current = L.circleMarker(center, {
          radius: 8, fillColor: '#6b7280', color: 'white', weight: 2, fillOpacity: 1,
        }).addTo(map);
        mapInstanceRef.current = map;
      }
    });
  }, [destination]);

  // Update driver marker on position change
  useEffect(() => {
    if (!currentPosition || !mapInstanceRef.current || !driverMarkerRef.current) return;
    if (isGoogleRef.current) {
      driverMarkerRef.current.setPosition({ lat: currentPosition[0], lng: currentPosition[1] });
      mapInstanceRef.current.panTo({ lat: currentPosition[0], lng: currentPosition[1] });
    } else {
      driverMarkerRef.current.setLatLng(currentPosition);
      mapInstanceRef.current.panTo(currentPosition);
    }
  }, [currentPosition]);

  // Draw route polyline
  useEffect(() => {
    if (!route || !mapInstanceRef.current) return;
    if (isGoogleRef.current) {
      const gm = (window as any).google?.maps;
      if (!gm) return;
      if (routePolylineRef.current) routePolylineRef.current.setMap(null);
      routePolylineRef.current = new gm.Polyline({
        path: route.coordinates.map((c: [number, number]) => ({ lat: c[0], lng: c[1] })),
        geodesic: true, strokeColor: '#f97316', strokeOpacity: 0.85, strokeWeight: 6,
        map: mapInstanceRef.current,
      });
    } else {
      if (routePolylineRef.current) routePolylineRef.current.remove();
      routePolylineRef.current = L.polyline(route.coordinates, {
        color: '#f97316', weight: 6, opacity: 0.85,
      }).addTo(mapInstanceRef.current);
    }
  }, [route]);

  // ── Derived values ────────────────────────────────────────────────────────
  const estimatedMin = route
    ? Math.ceil(route.duration / 60)
    : delivery ? Math.ceil(Number(delivery.distance_km ?? 2) * 3) : 5;

  const remainingKm = route ? route.distance / 1000 : null;

  const distToPickupM = currentPosition && destination
    ? haversine(currentPosition[0], currentPosition[1], destination[0], destination[1]) * 1000
    : null;

  const isNearPickup = distToPickupM !== null && distToPickupM < 100;

  // ── Log status to history helper ──────────────────────────────────────────
  const logHistory = (fromStatus: string, toStatus: string, reason?: string) => {
    supabase
      .from('delivery_status_history' as any)
      .insert({
        delivery_id: deliveryId!,
        from_status: fromStatus,
        to_status: toStatus,
        changed_by: user?.id ?? null,
        changed_by_role: 'driver',
        reason: reason ?? null,
      })
      .catch(() => {});
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleStartReturn = async () => {
    if (!deliveryId || submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('deliveries')
        .update({ status: 'returning_package', return_started_at: new Date().toISOString() } as any)
        .eq('id', deliveryId);
      if (error) throw error;
      logHistory('cancelled_return_pending', 'returning_package');
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível iniciar o retorno. Tente novamente.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmReturn = async () => {
    if (!deliveryId || submitting) return;
    setSubmitting(true);
    try {
      // Notifica restaurante que o pacote foi devolvido
      if (delivery?.restaurant_id) {
        const { data: rest } = await supabase
          .from('restaurants').select('user_id').eq('id', delivery.restaurant_id).single();
        if (rest?.user_id) {
          supabase.rpc('create_notification', {
            p_user_id: rest.user_id,
            p_title: 'Pacote devolvido ✅',
            p_message: `O entregador devolveu o pacote ao local de coleta em ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`,
            p_type: 'delivery_cancelled',
            p_delivery_id: deliveryId,
          }).catch(() => {});
          supabase.functions.invoke('send-push', {
            body: {
              user_id: rest.user_id,
              title: 'Pacote devolvido ✅',
              message: 'O entregador devolveu o pacote ao local de coleta.',
              url: '/restaurant/dashboard',
            },
          }).catch(() => {});
        }
      }

      const { error } = await supabase
        .from('deliveries')
        .update({ status: 'cancellation_completed', package_returned_at: new Date().toISOString() } as any)
        .eq('id', deliveryId);
      if (error) throw error;

      logHistory('returning_package', 'cancellation_completed');
      setShowSuccess(true);
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível confirmar a devolução. Tente novamente.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnFailed = async () => {
    if (!deliveryId || !failedReason.trim() || submitting) return;
    setSubmitting(true);
    try {
      // Atualiza motivo sem mudar o status — pacote continua com o driver
      await supabase
        .from('deliveries')
        .update({ return_failed_reason: failedReason.trim() } as any)
        .eq('id', deliveryId);

      logHistory('returning_package', 'returning_package', `Falha na devolução: ${failedReason}`);

      // Cria ocorrência para o admin
      supabase.rpc('create_notification', {
        p_user_id: null,
        p_title: '⚠️ Falha na devolução de pacote',
        p_message: `Entrega ${deliveryId}: entregador não conseguiu devolver o pacote. Motivo: ${failedReason}`,
        p_type: 'delivery_cancelled',
        p_delivery_id: deliveryId,
      } as any).catch(() => {});

      toast({
        title: 'Ocorrência registrada',
        description: 'O time de suporte foi notificado. Aguarde orientações.',
      });
      setShowFailedModal(false);
      setFailedReason('');
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível registrar. Tente novamente.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-orange-600 px-4 pb-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
          <Skeleton className="h-6 w-48 bg-white/20" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-14 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pacote devolvido!</h1>
        <p className="text-gray-500 mb-8">O pacote foi devolvido ao local de coleta com sucesso. O solicitante foi notificado.</p>
        <Button
          className="w-full max-w-xs"
          onClick={() => navigate('/driver/dashboard', { replace: true })}
        >
          Voltar ao início
        </Button>
      </div>
    );
  }

  if (!delivery) return null;

  const isReturning = delivery.status === 'returning_package';
  const cancelledByLabel = delivery.cancelled_by_role === 'driver' ? 'Você cancelou' : 'Cancelada pelo solicitante';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Header ── */}
      <div className="bg-orange-600 flex-shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="px-4 pb-3 pt-3">
          <div className="flex items-center gap-2 mb-1">
            <RotateCcw className="h-5 w-5 text-white" />
            <span className="text-white font-bold text-base">
              {isReturning ? 'Devolvendo pacote' : 'Devolução necessária'}
            </span>
          </div>
          <p className="text-white/70 text-xs">{cancelledByLabel} • Retornar ao local de coleta</p>
        </div>
      </div>

      {/* ── Alert banner ── */}
      {!isReturning && (
        <div className="bg-orange-50 border-b border-orange-200 px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-orange-800">Você está com o pacote</p>
            <p className="text-xs text-orange-700 mt-0.5">
              É obrigatório retornar o pacote ao local de coleta antes de encerrar a corrida.
            </p>
          </div>
        </div>
      )}

      {/* ── Map ── */}
      <div className="flex-shrink-0 mx-4 mt-4 rounded-2xl overflow-hidden shadow-sm" style={{ height: 200 }}>
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* ── Info cards ── */}
      <div className="flex-1 px-4 pt-4 pb-6 space-y-3 overflow-y-auto">

        {/* Destination address */}
        <div className="bg-white rounded-2xl p-4 shadow-sm flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
            <MapPin className="h-5 w-5 text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 font-medium">Local de coleta (destino do retorno)</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5 leading-snug">{delivery.pickup_address}</p>
          </div>
          <button
            className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0"
            onClick={() => window.open(getGoogleMapsLink(currentPosition || undefined, destination!), '_blank')}
          >
            <Navigation className="h-4 w-4 text-orange-600" />
          </button>
        </div>

        {/* Distance & time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <Navigation className="h-5 w-5 text-orange-500 mx-auto mb-1" />
            <p className="text-xs text-gray-500">Distância</p>
            <p className="text-lg font-bold text-gray-900">
              {remainingKm !== null ? `${remainingKm.toFixed(1)} km` : '—'}
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <Clock className="h-5 w-5 text-orange-500 mx-auto mb-1" />
            <p className="text-xs text-gray-500">Tempo est.</p>
            <p className="text-lg font-bold text-gray-900">{estimatedMin} min</p>
          </div>
        </div>

        {/* Proximity alert */}
        {isNearPickup && isReturning && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-3 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-800 font-medium">Você está próximo ao local de coleta!</p>
          </div>
        )}

        {/* Primary action button */}
        {!isReturning ? (
          <Button
            className="w-full h-14 text-base font-semibold bg-orange-600 hover:bg-orange-700 rounded-2xl"
            onClick={handleStartReturn}
            disabled={submitting}
          >
            <RotateCcw className="h-5 w-5 mr-2" />
            {submitting ? 'Iniciando...' : 'Iniciar retorno'}
          </Button>
        ) : (
          <>
            <Button
              className="w-full h-14 text-base font-semibold bg-green-600 hover:bg-green-700 rounded-2xl"
              onClick={handleConfirmReturn}
              disabled={submitting}
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              {submitting ? 'Confirmando...' : 'Confirmar devolução'}
            </Button>

            <Button
              variant="outline"
              className="w-full h-12 text-sm text-gray-600 border-gray-300 rounded-2xl"
              onClick={() => setShowFailedModal(true)}
              disabled={submitting}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Não consegui devolver
            </Button>
          </>
        )}
      </div>

      {/* ── "Não consegui devolver" modal ── */}
      <Dialog open={showFailedModal} onOpenChange={setShowFailedModal}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle>Não conseguiu devolver?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                O pacote continuará sob sua responsabilidade até a devolução ser confirmada ou o suporte intervir.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="failed-reason" className="text-sm font-medium">Motivo (obrigatório)</Label>
              <Textarea
                id="failed-reason"
                placeholder="Ex: Local fechado, endereço incorreto, sem acesso..."
                value={failedReason}
                onChange={(e) => setFailedReason(e.target.value)}
                rows={3}
                className="resize-none"
                maxLength={300}
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2">
            <Button
              className="w-full"
              disabled={!failedReason.trim() || submitting}
              onClick={handleReturnFailed}
            >
              {submitting ? 'Registrando...' : 'Registrar ocorrência'}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setShowFailedModal(false)}>
              Voltar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
