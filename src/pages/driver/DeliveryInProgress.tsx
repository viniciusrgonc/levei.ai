import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin, Navigation, Clock, CheckCircle2, Phone, MessageCircle,
  AlertCircle, PartyPopper, RotateCcw, ChevronDown, ChevronUp,
  Package, Wallet, ArrowLeft, Headphones,
} from 'lucide-react';
import { useCompleteDelivery } from '@/hooks/useCompleteDelivery';
import { useDriverLocationTracking } from '@/hooks/useDriverLocationTracking';
import { useMapNavigation } from '@/hooks/useMapNavigation';
import { useRouteDeliveries } from '@/hooks/useRouteDeliveries';
import { CancelDeliveryModal } from '@/components/CancelDeliveryModal';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from '@/hooks/use-toast';
import { getGoogleMapsLink } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

// ── Leaflet icon setup ─────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const driverIcon = new L.DivIcon({
  html: `<div style="
    width:44px;height:44px;border-radius:50%;
    background:#3b82f6;border:3px solid white;
    box-shadow:0 2px 8px rgba(0,0,0,0.35);
    display:flex;align-items:center;justify-content:center;
  ">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
  </div>`,
  iconSize: [44, 44], iconAnchor: [22, 22], className: '',
});

const destIcon = new L.DivIcon({
  html: `<div style="
    width:48px;height:48px;border-radius:50%;
    background:#22c55e;border:3px solid white;
    box-shadow:0 2px 12px rgba(34,197,94,0.5);
    display:flex;align-items:center;justify-content:center;
    animation: pulse-green 1.5s infinite;
  ">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  </div>
  <style>
    @keyframes pulse-green {
      0%,100%{box-shadow:0 2px 12px rgba(34,197,94,0.5)}
      50%{box-shadow:0 2px 24px rgba(34,197,94,0.9)}
    }
  </style>`,
  iconSize: [48, 48], iconAnchor: [24, 24], className: '',
});

// ── Map utilities ──────────────────────────────────────────────────────────
function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, map.getZoom(), { animate: true }); }, [center, map]);
  return null;
}

function MapClickTracker({ onUserInteract }: { onUserInteract: () => void }) {
  useMapEvents({ drag: onUserInteract, zoom: onUserInteract });
  return null;
}

// ── Haversine distance (km) ────────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Types ──────────────────────────────────────────────────────────────────
interface Delivery {
  id: string; status: string;
  pickup_address: string; delivery_address: string;
  distance_km: number; price: number; price_adjusted: number;
  product_type: string | null; recipient_name: string | null;
  recipient_phone: string | null; created_at: string;
  pickup_latitude: number; pickup_longitude: number;
  delivery_latitude: number; delivery_longitude: number;
  driver_id: string;
  is_additional_delivery: boolean | null;
  delivery_sequence: number | null;
  parent_delivery_id: string | null;
  requires_return: boolean | null;
}

interface CompletionResult {
  earnings: number; isLastDelivery: boolean; totalRouteEarnings: number;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function DeliveryInProgress() {
  const { deliveryId } = useParams<{ deliveryId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [completionResult, setCompletionResult] = useState<CompletionResult | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [autoCenter, setAutoCenter] = useState(true);
  const [userInteracted, setUserInteracted] = useState(false);

  // ── Queries ───────────────────────────────────────────────────────────
  const { data: driverData } = useQuery({
    queryKey: ['driver-id', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('drivers').select('id').eq('user_id', user!.id).single();
      return data;
    },
    enabled: !!user?.id, staleTime: 5 * 60 * 1000,
  });
  const driverId = driverData?.id ?? null;

  const { data: delivery, isLoading: loading } = useQuery<Delivery>({
    queryKey: ['delivery-in-progress', deliveryId],
    queryFn: async () => {
      const { data, error } = await supabase.from('deliveries').select('*').eq('id', deliveryId!).single();
      if (error || !data) throw new Error('Entrega não encontrada');
      if (!data.driver_id || data.driver_id !== driverId) throw new Error('Acesso negado');
      if (data.status !== 'picked_up') throw new Error(`wrong-status:${data.status}`);
      return data as Delivery;
    },
    enabled: !!deliveryId && !!driverId,
    staleTime: 15 * 1000, retry: false,
  });

  // ── Hooks ─────────────────────────────────────────────────────────────
  const destination: [number, number] | null = delivery
    ? [Number(delivery.delivery_latitude), Number(delivery.delivery_longitude)]
    : null;

  const { route } = useMapNavigation(currentPosition, destination);
  const routeInfo = useRouteDeliveries(driverId, deliveryId);

  useDriverLocationTracking({
    driverId: driverId || '', deliveryId: deliveryId || '',
    isActive: !!driverId && !!deliveryId,
  });

  const { completeDelivery, loading: completing } = useCompleteDelivery({
    onSuccess: (_, __, transaction) => {
      setCompletionResult(transaction ? {
        earnings: transaction.driver_earnings,
        isLastDelivery: transaction.is_last_delivery,
        totalRouteEarnings: transaction.total_route_earnings,
      } : {
        earnings: delivery ? Number(delivery.price_adjusted || delivery.price) * 0.80 : 0,
        isLastDelivery: true, totalRouteEarnings: 0,
      });
      setShowSuccess(true);
    },
  });

  // ── Geolocation ───────────────────────────────────────────────────────
  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentPosition([pos.coords.latitude, pos.coords.longitude]);
        setGeoError(false);
      },
      () => setGeoError(true),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // ── Derived values ────────────────────────────────────────────────────
  const estimatedMin = route
    ? Math.ceil(route.duration / 60)
    : Math.ceil(Number(delivery?.distance_km ?? 0) * 3);

  const remainingKm = route
    ? (route.distance / 1000)
    : Number(delivery?.distance_km ?? 0);

  const totalKm = Number(delivery?.distance_km ?? 0);
  const progressPct = totalKm > 0
    ? Math.min(100, Math.max(0, ((totalKm - remainingKm) / totalKm) * 100))
    : 0;

  // Proximidade ao destino (<150m)
  const distToDestM = currentPosition && destination
    ? haversine(currentPosition[0], currentPosition[1], destination[0], destination[1]) * 1000
    : null;
  const isNearby = distToDestM !== null && distToDestM < 150;

  const earnings = delivery ? Number(delivery.price_adjusted || delivery.price) * 0.80 : 0;

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleCompleteDelivery = async () => {
    if (!deliveryId || !driverId || !delivery) return;
    if (delivery.requires_return) {
      const { error } = await supabase
        .from('deliveries').update({ status: 'returning' }).eq('id', deliveryId);
      if (error) {
        toast({ title: 'Erro', description: 'Não foi possível confirmar', variant: 'destructive' });
        return;
      }
      navigate(`/driver/return/${deliveryId}`, { replace: true });
    } else {
      await completeDelivery(deliveryId, driverId, Number(delivery.price));
    }
  };

  const openGPS = () => {
    if (!delivery) return;
    window.open(getGoogleMapsLink(currentPosition || undefined,
      [delivery.delivery_latitude, delivery.delivery_longitude]), '_blank');
  };

  const callRecipient = () => {
    const phone = delivery?.recipient_phone;
    if (phone?.trim()) {
      window.location.href = `tel:${phone.replace(/[^\d+]/g, '')}`;
    } else {
      toast({ title: 'Telefone não cadastrado', variant: 'destructive' });
    }
  };

  const openWhatsApp = () => {
    const phone = delivery?.recipient_phone;
    if (phone?.trim()) {
      window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
    } else {
      toast({ title: 'WhatsApp indisponível', variant: 'destructive' });
    }
  };

  const handleRecenter = () => {
    setAutoCenter(true);
    setUserInteracted(false);
  };

  const handleUserInteract = useCallback(() => {
    setUserInteracted(true);
    setAutoCenter(false);
  }, []);

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <Skeleton className="flex-1 bg-gray-800" />
        <div className="p-4 space-y-3 bg-white">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-14 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!delivery) return null;

  const isReturn = !!delivery.requires_return;
  const confirmColor = isReturn ? '#f97316' : '#22c55e'; // orange vs green
  const confirmLabel = completing
    ? 'Confirmando...'
    : isReturn ? '↩️ Confirmar Entrega' : '✅ Confirmar Entrega';

  return (
    <>
      {/* ────────────────────────────────────────────────────────────────
          TELA PRINCIPAL
      ──────────────────────────────────────────────────────────────── */}
      <div className="min-h-screen flex flex-col bg-gray-900 relative overflow-hidden">

        {/* ── HEADER OVERLAY sobre o mapa ── */}
        <div
          className="absolute top-0 left-0 right-0 z-20 px-4 flex items-center justify-between"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)', paddingBottom: 10 }}
        >
          {/* Voltar */}
          <button
            onClick={() => navigate('/driver/dashboard')}
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>

          {/* Status pill */}
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          >
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-white text-sm font-semibold">Entregando</span>
            {routeInfo.totalDeliveries > 1 && (
              <span className="text-white/60 text-xs">
                · {delivery.delivery_sequence}/{routeInfo.totalDeliveries}
              </span>
            )}
          </div>

          {/* Problema */}
          <button
            onClick={() => setShowCancelModal(true)}
            className="px-3 h-10 rounded-full text-xs font-semibold text-white"
            style={{ background: 'rgba(239,68,68,0.75)', backdropFilter: 'blur(6px)' }}
          >
            Problema?
          </button>
        </div>

        {/* ── STATS OVERLAY (ganho + distância + tempo) ── */}
        <div
          className="absolute z-20 left-4 right-4 flex gap-2"
          style={{ top: 'calc(env(safe-area-inset-top) + 68px)' }}
        >
          {/* Ganho */}
          <div
            className="flex-1 flex flex-col items-center py-2 rounded-2xl"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          >
            <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Ganho</span>
            <span className="text-lg font-extrabold text-white leading-tight">
              R$ {earnings.toFixed(2)}
            </span>
          </div>

          {/* Distância */}
          <div
            className="flex-1 flex flex-col items-center py-2 rounded-2xl"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          >
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Falta</span>
            <span className="text-lg font-extrabold text-white leading-tight">
              {remainingKm < 1
                ? `${Math.round(remainingKm * 1000)} m`
                : `${remainingKm.toFixed(1)} km`}
            </span>
          </div>

          {/* Tempo */}
          <div
            className="flex-1 flex flex-col items-center py-2 rounded-2xl"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          >
            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">Tempo</span>
            <span className="text-lg font-extrabold text-white leading-tight">
              ~{estimatedMin} min
            </span>
          </div>
        </div>

        {/* ── ALERTA CHEGADA (<150m) ── */}
        {isNearby && (
          <div
            className="absolute z-20 left-4 right-4 flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{
              top: 'calc(env(safe-area-inset-top) + 144px)',
              background: 'rgba(34,197,94,0.92)', backdropFilter: 'blur(6px)',
            }}
          >
            <span className="text-2xl">📍</span>
            <div>
              <p className="text-white font-bold text-sm">Você chegou ao destino!</p>
              <p className="text-white/80 text-xs">Confirme a entrega assim que o pacote for entregue</p>
            </div>
          </div>
        )}

        {/* ── MAPA FULLSCREEN ── */}
        <div className="flex-1 relative" style={{ minHeight: '55vh' }}>
          {currentPosition && destination ? (
            <MapContainer
              center={currentPosition}
              zoom={15}
              style={{ height: '100%', width: '100%', minHeight: '55vh' }}
              zoomControl={false}
              attributionControl={false}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="OSM"
              />
              <MapClickTracker onUserInteract={handleUserInteract} />
              {autoCenter && <RecenterMap center={currentPosition} />}

              {/* Rota azul (padrão navegação) */}
              {route?.coordinates?.length ? (
                <Polyline positions={route.coordinates} color="#3b82f6" weight={6} opacity={0.85} />
              ) : null}

              {/* Marcadores */}
              <Marker position={currentPosition} icon={driverIcon} />
              <Marker position={destination} icon={destIcon} />
            </MapContainer>
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-800 min-h-[55vh]">
              {geoError ? (
                <div className="text-center">
                  <AlertCircle className="h-10 w-10 text-yellow-400 mx-auto mb-2" />
                  <p className="text-white font-semibold">GPS indisponível</p>
                  <p className="text-white/60 text-sm">Ative a localização do dispositivo</p>
                </div>
              ) : (
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-white/60 text-sm">Obtendo localização...</p>
                </div>
              )}
            </div>
          )}

          {/* Botões flutuantes sobre o mapa */}
          <div className="absolute right-4 bottom-4 z-10 flex flex-col gap-2">
            {/* GPS externo */}
            <button
              onClick={openGPS}
              className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center"
            >
              <Navigation className="h-5 w-5 text-blue-600" />
            </button>
            {/* Re-centralizar */}
            {userInteracted && (
              <button
                onClick={handleRecenter}
                className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center"
              >
                <RotateCcw className="h-5 w-5 text-gray-600" />
              </button>
            )}
          </div>
        </div>

        {/* ── BOTTOM SHEET ── */}
        <div className="bg-white rounded-t-3xl shadow-2xl z-10 flex flex-col"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>

          {/* Handle + toggle */}
          <button
            onClick={() => setSheetExpanded(v => !v)}
            className="flex flex-col items-center pt-3 pb-2"
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mb-1" />
            {sheetExpanded
              ? <ChevronDown className="h-4 w-4 text-gray-300" />
              : <ChevronUp className="h-4 w-4 text-gray-300" />}
          </button>

          <div className="px-4 space-y-3">

            {/* Barra de progresso */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400 font-medium">Progresso da rota</span>
                <span className="text-xs font-bold text-blue-600">{Math.round(progressPct)}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #3b82f6, #22c55e)' }}
                />
              </div>
            </div>

            {/* Card destino */}
            <div className="bg-gray-50 rounded-2xl p-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MapPin className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Destino</p>
                  <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                    {delivery.delivery_address}
                  </p>
                  {delivery.recipient_name && (
                    <p className="text-xs text-gray-500 mt-1">Para: <span className="font-medium">{delivery.recipient_name}</span></p>
                  )}
                </div>
              </div>

              {/* Ações de contato */}
              {delivery.recipient_phone && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={callRecipient}
                    className="flex-1 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                  >
                    <Phone className="h-4 w-4 text-green-500" />
                    Ligar
                  </button>
                  <button
                    onClick={openWhatsApp}
                    className="flex-1 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                  >
                    <MessageCircle className="h-4 w-4 text-green-600" />
                    WhatsApp
                  </button>
                  <button
                    onClick={() => toast({ title: 'Chat em breve', description: 'Disponível em breve.' })}
                    className="flex-1 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center gap-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                  >
                    <Headphones className="h-4 w-4 text-blue-500" />
                    Chat
                  </button>
                </div>
              )}
            </div>

            {/* Aviso de retorno */}
            {isReturn && (
              <div className="flex items-center gap-2.5 bg-orange-50 border border-orange-200 rounded-2xl px-3 py-2.5">
                <span className="text-xl">↩️</span>
                <div>
                  <p className="text-xs font-bold text-orange-700">Entrega com retorno</p>
                  <p className="text-xs text-orange-600">Após entregar, volte ao ponto de coleta. Pagamento liberado no retorno.</p>
                </div>
              </div>
            )}

            {/* Infos extras (expandidas) */}
            {sheetExpanded && (
              <div className="bg-gray-50 rounded-2xl divide-y divide-gray-100 overflow-hidden">
                {delivery.product_type && (
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-gray-400" />
                      <span className="text-xs text-gray-500">Tipo</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-700">{delivery.product_type}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-gray-400" />
                    <span className="text-xs text-gray-500">Valor total</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-700">
                    R$ {Number(delivery.price_adjusted || delivery.price).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm">#</span>
                    <span className="text-xs text-gray-500">Código</span>
                  </div>
                  <span className="text-xs font-mono font-semibold text-gray-700">{delivery.id.slice(0, 8).toUpperCase()}</span>
                </div>
                {delivery.created_at && (
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-xs text-gray-500">Solicitado</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-700">
                      {new Date(delivery.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── BOTÃO PRINCIPAL — Confirmar entrega ── */}
            <button
              onClick={handleCompleteDelivery}
              disabled={completing}
              className="w-full h-14 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2.5 transition-all active:scale-95 disabled:opacity-60"
              style={{
                background: completing ? '#9ca3af' : confirmColor,
                boxShadow: isNearby && !completing
                  ? `0 0 0 4px ${confirmColor}40, 0 4px 20px ${confirmColor}60`
                  : `0 4px 16px ${confirmColor}40`,
              }}
            >
              {completing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  {confirmLabel}
                </>
              )}
            </button>

            {/* ── Ações secundárias ── */}
            <div className="flex gap-2 pb-1">
              <button
                onClick={() => toast({
                  title: 'Problema reportado',
                  description: 'Nossa equipe entrará em contato em breve.',
                })}
                className="flex-1 h-11 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-sm font-semibold flex items-center justify-center gap-1.5 active:bg-red-100"
              >
                Não consegui entregar
              </button>
              <button
                onClick={() => toast({ title: 'Suporte', description: 'Ligue para (37) 9xxxx-xxxx' })}
                className="h-11 px-4 rounded-2xl bg-gray-100 text-gray-600 text-sm font-semibold flex items-center justify-center active:bg-gray-200"
              >
                <Headphones className="h-4 w-4" />
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* ── MODAL SUCESSO ── */}
      <Dialog open={showSuccess} onOpenChange={() => {
        setShowSuccess(false);
        navigate('/driver/dashboard', { replace: true });
      }}>
        <DialogContent className="sm:max-w-sm text-center rounded-3xl">
          <DialogHeader className="space-y-4">
            <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <PartyPopper className="w-12 h-12 text-green-500" />
            </div>
            <DialogTitle className="text-2xl font-extrabold">
              {completionResult?.isLastDelivery ? '🎉 Rota Concluída!' : '✅ Entrega Concluída!'}
            </DialogTitle>
            <DialogDescription className="text-base text-gray-600">
              {completionResult?.isLastDelivery ? (
                <>
                  Parabéns! <span className="font-bold text-green-600">
                    R$ {(completionResult?.totalRouteEarnings || completionResult?.earnings || 0).toFixed(2)}
                  </span> creditado na sua carteira.
                </>
              ) : (
                'Continue para a próxima entrega da rota. Pagamento creditado ao final.'
              )}
            </DialogDescription>
          </DialogHeader>
          <button
            onClick={() => { setShowSuccess(false); navigate('/driver/dashboard', { replace: true }); }}
            className="w-full h-13 mt-4 rounded-2xl bg-green-500 text-white font-bold text-base py-3.5"
          >
            {completionResult?.isLastDelivery ? 'Voltar ao Início' : 'Próxima Entrega →'}
          </button>
        </DialogContent>
      </Dialog>

      {/* ── CANCEL MODAL ── */}
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
