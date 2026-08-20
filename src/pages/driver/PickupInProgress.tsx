import { useEffect, useRef, useState } from 'react';
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
import { loadGoogleMapsScript } from '@/lib/googleMaps';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getGoogleMapsLink } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useDriverCommission, calcDriverAmount } from '@/lib/driverEarnings';


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
  const driverPct = useDriverCommission();

  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [showCancelModal, setShowCancelModal]   = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [autoCenter, setAutoCenter] = useState(true);
  const [userInteracted, setUserInteracted] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const isGoogleRef = useRef(false);

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

  const { data: delivery, isLoading: loading, error: deliveryError } = useQuery<Delivery>({
    queryKey: ['pickup-delivery', deliveryId],
    queryFn: async () => {
      const { data, error } = await supabase.from('deliveries').select('*').eq('id', deliveryId!).single();
      if (error || !data) throw new Error('Entrega não encontrada');
      if (!data.driver_id || data.driver_id !== driverId) throw new Error('Acesso negado');
      if (data.status !== 'accepted' && data.status !== 'picking_up') throw new Error(`wrong-status:${data.status}`);
      return data as Delivery;
    },
    enabled: !!deliveryId && !!driverId,
    staleTime: 15 * 1000,
    retry: false,
  });

  // Redireciona se status mudou (ex: entrega já foi para delivery)
  useEffect(() => {
    if (!deliveryError) return;
    const msg = (deliveryError as Error).message ?? '';
    if (msg.startsWith('wrong-status:')) {
      const status = msg.replace('wrong-status:', '');
      if (status === 'picked_up' || status === 'delivering') {
        navigate(`/driver/delivery/${deliveryId}`, { replace: true });
      } else {
        navigate('/driver/dashboard', { replace: true });
      }
    }
  }, [deliveryError, deliveryId, navigate]);

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

  // ── Map: init ────────────────────────────────────────────────────────────
  const hasMapData = !!currentPosition && !!destination;
  useEffect(() => {
    if (!hasMapData || !mapContainerRef.current || mapInstanceRef.current) return;
    if (!currentPosition || !destination) return;
    loadGoogleMapsScript().then((ok) => {
      if (!mapContainerRef.current || mapInstanceRef.current) return;
      if (ok) {
        isGoogleRef.current = true;
        const gm = (window as any).google.maps;
        const map = new gm.Map(mapContainerRef.current, {
          center: { lat: currentPosition[0], lng: currentPosition[1] },
          zoom: 15, disableDefaultUI: true, gestureHandling: 'greedy',
        });
        driverMarkerRef.current = new gm.Marker({
          position: { lat: currentPosition[0], lng: currentPosition[1] },
          map,
          icon: { path: gm.SymbolPath.CIRCLE, scale: 8, fillColor: '#3b82f6', fillOpacity: 1, strokeWeight: 2.5, strokeColor: 'white' },
          zIndex: 10,
        });
        destMarkerRef.current = new gm.Marker({
          position: { lat: destination[0], lng: destination[1] },
          map,
          icon: { path: gm.SymbolPath.CIRCLE, scale: 10, fillColor: '#f97316', fillOpacity: 1, strokeWeight: 3, strokeColor: 'white' },
          zIndex: 9,
        });
        map.addListener('dragstart', () => { setUserInteracted(true); setAutoCenter(false); });
        map.addListener('zoom_changed', () => { setUserInteracted(true); setAutoCenter(false); });
        mapInstanceRef.current = map;
      } else {
        isGoogleRef.current = false;
        const map = L.map(mapContainerRef.current, {
          center: currentPosition, zoom: 15, zoomControl: false, attributionControl: false,
        });
        L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
          subdomains: ['0', '1', '2', '3'], maxZoom: 20,
        }).addTo(map);
        driverMarkerRef.current = L.circleMarker(currentPosition, {
          radius: 8, fillColor: '#3b82f6', color: 'white', weight: 2.5, fillOpacity: 1,
        }).addTo(map);
        destMarkerRef.current = L.circleMarker(destination, {
          radius: 10, fillColor: '#f97316', color: 'white', weight: 3, fillOpacity: 1,
        }).addTo(map);
        map.on('dragstart', () => { setUserInteracted(true); setAutoCenter(false); });
        map.on('zoomstart', () => { setUserInteracted(true); setAutoCenter(false); });
        mapInstanceRef.current = map;
      }
    });
    return () => {
      if (mapInstanceRef.current && !isGoogleRef.current) mapInstanceRef.current.remove?.();
      mapInstanceRef.current = null;
      driverMarkerRef.current = null;
      destMarkerRef.current = null;
      routePolylineRef.current = null;
    };
  }, [hasMapData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Map: atualiza posição do entregador ───────────────────────────────────
  useEffect(() => {
    if (!currentPosition || !mapInstanceRef.current || !driverMarkerRef.current) return;
    if (isGoogleRef.current) {
      const pos = { lat: currentPosition[0], lng: currentPosition[1] };
      driverMarkerRef.current.setPosition(pos);
      if (autoCenter) mapInstanceRef.current.panTo(pos);
    } else {
      driverMarkerRef.current.setLatLng(currentPosition);
      if (autoCenter) mapInstanceRef.current.setView(currentPosition, mapInstanceRef.current.getZoom(), { animate: true });
    }
  }, [currentPosition, autoCenter]);

  // ── Map: atualiza polyline da rota ────────────────────────────────────────
  useEffect(() => {
    if (!mapInstanceRef.current || !route?.coordinates?.length) return;
    if (isGoogleRef.current) {
      const gm = (window as any).google?.maps;
      if (!gm) return;
      if (routePolylineRef.current) routePolylineRef.current.setMap(null);
      routePolylineRef.current = new gm.Polyline({
        path: route.coordinates.map((c: [number, number]) => ({ lat: c[0], lng: c[1] })),
        geodesic: true,
        strokeColor: '#f97316',
        strokeOpacity: 0.85,
        strokeWeight: 6,
        map: mapInstanceRef.current,
      });
    } else {
      if (routePolylineRef.current) routePolylineRef.current.remove();
      routePolylineRef.current = L.polyline(route.coordinates, {
        color: '#f97316', weight: 6, opacity: 0.85,
      }).addTo(mapInstanceRef.current);
    }
  }, [route]);

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

  const earnings = delivery ? calcDriverAmount(Number(delivery.price_adjusted || delivery.price), driverPct) : 0;

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

  // Erro não-status (acesso negado, não encontrada) — mostra tela limpa
  if (deliveryError && !(deliveryError as Error).message?.startsWith('wrong-status:')) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <p className="text-base font-bold text-gray-900">Entrega indisponível</p>
        <p className="text-sm text-gray-500">Esta entrega não está mais disponível para você.</p>
        <button
          onClick={() => navigate('/driver/dashboard', { replace: true })}
          className="h-11 px-8 rounded-2xl bg-primary text-white font-bold text-sm"
        >
          Voltar ao início
        </button>
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
          <div
            ref={mapContainerRef}
            className="absolute inset-0"
            style={{ height: '100%', width: '100%', minHeight: '55vh' }}
          />
          {(!currentPosition || !destination) && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
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
                    <span className="text-xs text-gray-500">Seu ganho</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-700">
                    R$ {calcDriverAmount(Number(delivery.price_adjusted || delivery.price), driverPct).toFixed(2)}
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
