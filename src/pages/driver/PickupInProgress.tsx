import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  Navigation, Clock, CheckCircle2, AlertCircle,
  Package, ArrowLeft, RotateCcw, ChevronDown, ChevronUp,
  MapPin, Wallet,
} from 'lucide-react';
import { usePickupDelivery } from '@/hooks/usePickupDelivery';
import { useDriverLocationTracking } from '@/hooks/useDriverLocationTracking';
import { useMapNavigation } from '@/hooks/useMapNavigation';
import { useRouteDeliveries } from '@/hooks/useRouteDeliveries';
import { CancelDeliveryModal } from '@/components/CancelDeliveryModal';
import { OpenDisputeModal } from '@/components/OpenDisputeModal';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getGoogleMapsLink } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

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

const pickupIcon = new L.DivIcon({
  html: `<div style="
    width:48px;height:48px;border-radius:50%;
    background:#f97316;border:3px solid white;
    box-shadow:0 2px 12px rgba(249,115,22,0.5);
    display:flex;align-items:center;justify-content:center;
    animation: pulse-orange 1.5s infinite;
  ">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
      <path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.51 16.49 1 14.64 1 13.27 1 12.38 1.74 11.6 2.72L10 4.66 8.4 2.72C7.62 1.74 6.73 1 5.36 1 3.51 1 2 2.51 2 4.64c0 .48.11.92.18 1.36H0v14h20V6zM14.64 3c.94 0 1.36.64 1.36 1.64 0 1-.72 1.87-1.84 3.04L10 11.71 9.84 7.68C11.6 5.59 12.33 3 14.64 3zM5.36 3c2.31 0 3.04 2.59 4.8 4.68L10 11.71 6.84 7.68C5.72 6.51 5 5.64 5 4.64 5 3.64 5.42 3 5.36 3z"/>
    </svg>
  </div>
  <style>
    @keyframes pulse-orange {
      0%,100%{box-shadow:0 2px 12px rgba(249,115,22,0.5)}
      50%{box-shadow:0 2px 24px rgba(249,115,22,0.9)}
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

// ── Component ──────────────────────────────────────────────────────────────
export default function PickupInProgress() {
  const { deliveryId } = useParams<{ deliveryId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [showCancelModal, setShowCancelModal]   = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
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
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });
  const driverId = driverData?.id ?? null;

  const { data: delivery, isLoading: loading } = useQuery<Delivery>({
    queryKey: ['pickup-delivery', deliveryId],
    queryFn: async () => {
      const { data, error } = await supabase.from('deliveries').select('*').eq('id', deliveryId!).single();
      if (error || !data) throw new Error('Entrega não encontrada');
      if (!data.driver_id || data.driver_id !== driverId) throw new Error('Acesso negado');
      if (data.status !== 'accepted') throw new Error(`wrong-status:${data.status}`);
      return data as Delivery;
    },
    enabled: !!deliveryId && !!driverId,
    staleTime: 15 * 1000,
    retry: false,
  });

  // ── Hooks ─────────────────────────────────────────────────────────────
  const { pickupDelivery, loading: pickingUp } = usePickupDelivery({
    onSuccess: (id: string) => {
      navigate(`/driver/delivery/${id}`, { replace: true });
    },
  });

  const destination: [number, number] | null = delivery
    ? [Number(delivery.pickup_latitude), Number(delivery.pickup_longitude)]
    : null;

  const { route } = useMapNavigation(currentPosition, destination);
  const routeInfo = useRouteDeliveries(driverId, deliveryId);

  useDriverLocationTracking({
    driverId: driverId || '',
    deliveryId: deliveryId || '',
    isActive: !!driverId && !!deliveryId,
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

  // Proximidade ao ponto de coleta (<100m)
  const distToPickupM = currentPosition && destination
    ? haversine(currentPosition[0], currentPosition[1], destination[0], destination[1]) * 1000
    : null;
  const isNearby = distToPickupM !== null && distToPickupM < 100;

  const earnings = delivery ? Number(delivery.price_adjusted || delivery.price) : 0;

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleConfirmPickup = async () => {
    if (!deliveryId || !driverId) return;
    await pickupDelivery(deliveryId, driverId);
  };

  const openGPS = () => {
    if (!delivery) return;
    window.open(getGoogleMapsLink(
      currentPosition || undefined,
      [delivery.pickup_latitude, delivery.pickup_longitude],
    ), '_blank');
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
          <Skeleton className="h-14 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!delivery) return null;

  return (
    <>
      {/* ──────────────────────────────────────────────────────────────────
          TELA PRINCIPAL
      ────────────────────────────────────────────────────────────────── */}
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
            <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-white text-sm font-semibold">Indo Buscar</span>
            {routeInfo.totalDeliveries > 1 && (
              <span className="text-white/60 text-xs">
                · {delivery.delivery_sequence}/{routeInfo.totalDeliveries}
              </span>
            )}
          </div>

          {/* Cancelar */}
          <button
            onClick={() => setShowCancelModal(true)}
            className="px-3 h-10 rounded-full text-xs font-semibold text-white"
            style={{ background: 'rgba(239,68,68,0.75)', backdropFilter: 'blur(6px)' }}
          >
            Cancelar
          </button>
        </div>

        {/* ── STATS OVERLAY (ganho + distância + tempo) ── */}
        <div
          className="absolute z-20 left-4 right-4 flex gap-2"
          style={{ top: 'calc(env(safe-area-inset-top) + 68px)' }}
        >
          {/* Valor */}
          <div
            className="flex-1 flex flex-col items-center py-2 rounded-2xl"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          >
            <span className="text-[10px] font-bold text-green-400 uppercase tracking-wider">Valor</span>
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

        {/* ── ALERTA CHEGADA (<100m) ── */}
        {isNearby && (
          <div
            className="absolute z-20 left-4 right-4 flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{
              top: 'calc(env(safe-area-inset-top) + 144px)',
              background: 'rgba(249,115,22,0.92)', backdropFilter: 'blur(6px)',
            }}
          >
            <span className="text-2xl">📦</span>
            <div>
              <p className="text-white font-bold text-sm">Você chegou ao ponto de coleta!</p>
              <p className="text-white/80 text-xs">Retire o pedido e confirme a coleta</p>
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

              {/* Rota laranja (coleta) */}
              {route?.coordinates?.length ? (
                <Polyline positions={route.coordinates} color="#f97316" weight={6} opacity={0.85} />
              ) : null}

              <Marker position={currentPosition} icon={driverIcon} />
              <Marker position={destination} icon={pickupIcon} />
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
                  <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-white/60 text-sm">Obtendo localização...</p>
                </div>
              )}
            </div>
          )}

          {/* Botões flutuantes sobre o mapa */}
          <div className="absolute right-4 bottom-4 z-10 flex flex-col gap-2">
            <button
              onClick={openGPS}
              className="w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center"
            >
              <Navigation className="h-5 w-5 text-blue-600" />
            </button>
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
        <div
          className="bg-white rounded-t-3xl shadow-2xl z-10 flex flex-col"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
        >
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

            {/* Card ponto de coleta */}
            <div className="bg-orange-50 rounded-2xl p-3 border border-orange-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Package className="h-5 w-5 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider mb-0.5">Local de Coleta</p>
                  <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                    {delivery.pickup_address}
                  </p>
                  {delivery.product_type && (
                    <span className="inline-block mt-1 text-[11px] font-medium bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                      {delivery.product_type}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Infos extras (expandidas) */}
            {sheetExpanded && (
              <div className="bg-gray-50 rounded-2xl divide-y divide-gray-100 overflow-hidden">
                {/* Destino final (info) */}
                <div className="flex items-start gap-3 px-3 py-2.5">
                  <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Destino final</p>
                    <p className="text-xs font-semibold text-gray-700 line-clamp-2">{delivery.delivery_address}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-gray-400" />
                    <span className="text-xs text-gray-500">Valor</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-700">
                    R$ {Number(delivery.price_adjusted || delivery.price).toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-xs text-gray-500">Distância total</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-700">
                    {Number(delivery.distance_km).toFixed(1)} km
                  </span>
                </div>

                {delivery.product_note && (
                  <div className="px-3 py-2.5">
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">Observação</p>
                    <p className="text-xs text-gray-700">{delivery.product_note}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── BOTÃO PRINCIPAL — Confirmar coleta ── */}
            <button
              onClick={handleConfirmPickup}
              disabled={pickingUp}
              className="w-full h-14 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2.5 transition-all active:scale-95 disabled:opacity-60"
              style={{
                background: pickingUp ? '#9ca3af' : '#f97316',
                boxShadow: isNearby && !pickingUp
                  ? '0 0 0 4px rgba(249,115,22,0.25), 0 4px 20px rgba(249,115,22,0.6)'
                  : '0 4px 16px rgba(249,115,22,0.4)',
              }}
            >
              {pickingUp ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Confirmar Coleta
                </>
              )}
            </button>

            {/* Dispute link */}
            <button
              onClick={() => setShowDisputeModal(true)}
              className="flex items-center justify-center gap-1.5 text-xs text-white/60 mt-2 py-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
              Abrir disputa
            </button>

          </div>
        </div>
      </div>

      {/* ── CANCEL MODAL ── */}
      {deliveryId && (
        <CancelDeliveryModal
          deliveryId={deliveryId}
          cancellerRole="driver"
          open={showCancelModal}
          onOpenChange={setShowCancelModal}
          onCancelled={() => {
            setShowCancelModal(false);
            navigate('/driver/dashboard', { replace: true });
          }}
        />
      )}

      {/* ── DISPUTE MODAL ── */}
      {deliveryId && (
        <OpenDisputeModal
          deliveryId={deliveryId}
          open={showDisputeModal}
          onOpenChange={setShowDisputeModal}
        />
      )}
    </>
  );
}
