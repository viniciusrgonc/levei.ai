import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import {
  MapPin, Package, Navigation, Star, TrendingUp,
  ChevronRight, Clock, Wifi, WifiOff, Search,
} from 'lucide-react';
import { DeliveryNotificationCard } from '@/components/DeliveryNotificationCard';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import 'leaflet/dist/leaflet.css';
import { useNearbyDeliveries } from '@/hooks/useNearbyDeliveries';
import NotificationBell from '@/components/NotificationBell';
import { useRealtimeDeliveries } from '@/hooks/useRealtimeDeliveries';
import { useAcceptDelivery } from '@/hooks/useAcceptDelivery';
import { DriverBottomNav } from '@/components/DriverBottomNav';
import leveiLogo from '@/assets/levei-logo.png';

// ── Query functions ────────────────────────────────────────────────────────
async function fetchDriver(userId: string) {
  const { data, error } = await supabase
    .from('drivers').select('*').eq('user_id', userId).single();
  if (error?.code === 'PGRST116') throw new Error('SETUP_REQUIRED');
  if (error) throw error;
  return data;
}

async function fetchActiveDelivery(userId: string) {
  const { data: driverData } = await supabase
    .from('drivers').select('id').eq('user_id', userId).maybeSingle();
  if (!driverData) return null;
  const { data } = await supabase
    .from('deliveries').select('*')
    .eq('driver_id', driverData.id)
    .in('status', ['accepted', 'picking_up', 'picked_up', 'delivering', 'returning'])
    .order('delivery_sequence', { ascending: true, nullsFirst: true })
    .limit(1).maybeSingle();
  return data ?? null;
}

async function fetchTodayEarnings(userId: string) {
  const { data: driverData } = await supabase
    .from('drivers').select('id').eq('user_id', userId).maybeSingle();
  if (!driverData) return { earnings: 0, count: 0 };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('transactions').select('driver_earnings')
    .eq('driver_id', driverData.id)
    .gte('created_at', today.toISOString());
  const earnings = (data ?? []).reduce((s, t) => s + (Number(t.driver_earnings) || 0), 0);
  return { earnings, count: data?.length ?? 0 };
}

// ── Recenter map on position change ────────────────────────────────────────
function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => { map.setView([lat, lng], map.getZoom()); }, [lat, lng]);
  return null;
}

// ── Driver marker ──────────────────────────────────────────────────────────
function driverIcon(online: boolean) {
  const color = online ? '#3b82f6' : '#6b7280';
  return new DivIcon({
    html: renderToStaticMarkup(
      <div style={{ position: 'relative', width: 48, height: 48 }}>
        {online && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: `${color}33`,
            animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite',
          }} />
        )}
        <div style={{
          position: 'absolute', inset: 8, borderRadius: '50%',
          background: color, border: '3px solid white',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      </div>
    ),
    className: '',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

// ── Component ──────────────────────────────────────────────────────────────
export default function DriverDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [position, setPosition] = useState<[number, number] | null>(null);
  const watchRef = useRef<number | null>(null);

  const { acceptDelivery, loading: accepting, acceptingId } = useAcceptDelivery({
    onSuccess: (id) => navigate(`/driver/pickup/${id}`, { replace: true }),
  });

  // ── Notification card state ───────────────────────────────────────────────
  const [notificationDelivery, setNotificationDelivery] = useState<any | null>(null);
  const seenDeliveryIds = useRef<Set<string>>(new Set());

  // ── Geolocation ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    watchRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => setPosition([coords.latitude, coords.longitude]),
      () => setPosition([-19.9167, -43.9345]), // Belo Horizonte fallback
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    return () => { if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current); };
  }, []);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: driver, isLoading: driverLoading, error: driverError } = useQuery({
    queryKey: ['driver', user?.id],
    queryFn: () => fetchDriver(user!.id),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
    retry: (count, err: any) => err?.message !== 'SETUP_REQUIRED' && count < 2,
  });

  const { data: activeDelivery } = useQuery({
    queryKey: ['active-delivery', user?.id],
    queryFn: () => fetchActiveDelivery(user!.id),
    enabled: !!user?.id,
    staleTime: 10 * 1000,
    refetchInterval: 15 * 1000,
  });

  const { data: earningsData = { earnings: 0, count: 0 } } = useQuery({
    queryKey: ['today-earnings', user?.id],
    queryFn: () => fetchTodayEarnings(user!.id),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  const { deliveries: availableDeliveries, loading: deliveriesLoading, radiusKm } =
    useNearbyDeliveries({ driverId: driver?.id || '', isAvailable: driver?.is_available || false });

  useRealtimeDeliveries({
    driverId: driver?.id,
    showNotifications: true,
    onUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ['active-delivery', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['today-earnings', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['driver', user?.id] });
    },
  });

  // ── Redirects ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (driverError?.message === 'SETUP_REQUIRED') navigate('/driver/setup');
  }, [driverError]);

  useEffect(() => {
    if (!activeDelivery) return;
    if (['accepted', 'picking_up'].includes(activeDelivery.status))
      navigate(`/driver/pickup/${activeDelivery.id}`, { replace: true });
    else if (['picked_up', 'delivering'].includes(activeDelivery.status))
      navigate(`/driver/delivery/${activeDelivery.id}`, { replace: true });
    else if (activeDelivery.status === 'returning')
      navigate(`/driver/return/${activeDelivery.id}`, { replace: true });
  }, [activeDelivery]);

  // ── Detect new deliveries → show notification card ───────────────────────
  useEffect(() => {
    const online = driver?.is_available ?? false;
    const deliveries = Array.isArray(availableDeliveries) ? availableDeliveries : [];
    if (!online || deliveries.length === 0) return;

    const newDelivery = deliveries.find((d: any) => !seenDeliveryIds.current.has(d.id));
    if (newDelivery && !notificationDelivery) {
      seenDeliveryIds.current.add(newDelivery.id);
      setNotificationDelivery(newDelivery);
    }
  }, [availableDeliveries, driver?.is_available, notificationDelivery]);

  // ── Toggle availability ───────────────────────────────────────────────────
  const toggleAvailability = async (available: boolean) => {
    if (!driver) return;
    const { error } = await supabase.from('drivers')
      .update({ is_available: available }).eq('id', driver.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao atualizar disponibilidade' });
    } else {
      queryClient.setQueryData(['driver', user?.id], { ...driver, is_available: available });
      toast({ title: available ? 'Você está online!' : 'Você está offline' });
    }
  };

  const handleAccept = async (deliveryId: string) => {
    if (!driver?.id) return;
    await acceptDelivery(deliveryId, driver.id);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (driverLoading) {
    return (
      <div className="h-screen bg-gray-900 flex flex-col items-center justify-center gap-4">
        <Skeleton className="h-full w-full absolute inset-0 bg-gray-800" />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white animate-spin" />
          <p className="text-white/60 text-sm">Carregando mapa...</p>
        </div>
      </div>
    );
  }

  const isOnline = driver?.is_available ?? false;
  const safeDeliveries = Array.isArray(availableDeliveries) ? availableDeliveries : [];
  const mapCenter: [number, number] = position ?? [-19.9167, -43.9345];

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-900">

      {/* ── MAPA (fundo) ── */}
      <MapContainer
        center={mapCenter}
        zoom={15}
        zoomControl={false}
        scrollWheelZoom={false}
        className="absolute inset-0 h-full w-full z-0"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution=""
        />
        {position && (
          <>
            <Marker position={position} icon={driverIcon(isOnline)} />
            <RecenterMap lat={position[0]} lng={position[1]} />
          </>
        )}
      </MapContainer>

      {/* ── GRADIENTE topo ── */}
      <div
        className="absolute top-0 left-0 right-0 z-10 pointer-events-none"
        style={{
          height: 160,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%)',
        }}
      />

      {/* ── GRADIENTE rodapé ── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none"
        style={{
          height: 340,
          background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)',
        }}
      />

      {/* ── HEADER overlay ── */}
      <div
        className="absolute left-0 right-0 z-20 flex items-center justify-between px-4"
        style={{ top: 0, paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        {/* Logo + status */}
        <div className="flex items-center gap-2.5">
          <img src={leveiLogo} alt="Levei" className="h-9 w-9 rounded-xl object-cover shadow-lg" />
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-lg backdrop-blur-md ${
              isOnline
                ? 'bg-green-500/90 text-white'
                : 'bg-gray-700/90 text-gray-200'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-white animate-pulse' : 'bg-gray-400'}`} />
            {isOnline ? `Online · ${radiusKm} km` : 'Offline'}
          </div>
        </div>

        {/* Rating + bell */}
        <div className="flex items-center gap-2">
          {driver?.rating && (
            <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-full px-2.5 py-1.5 shadow">
              <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
              <span className="text-white text-xs font-semibold">
                {Number(driver.rating).toFixed(1)}
              </span>
            </div>
          )}
          <div className="bg-black/40 backdrop-blur-md rounded-full p-1.5 shadow">
            <NotificationBell />
          </div>
        </div>
      </div>

      {/* ── TOGGLE Online/Offline ── */}
      <div className="absolute z-20" style={{ top: 'calc(env(safe-area-inset-top) + 80px)', right: 16 }}>
        <button
          onClick={() => toggleAvailability(!isOnline)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-xl backdrop-blur-md font-semibold text-sm transition-all active:scale-95 ${
            isOnline
              ? 'bg-green-500/95 text-white'
              : 'bg-gray-800/95 text-gray-200'
          }`}
        >
          {isOnline
            ? <><Wifi className="h-4 w-4" />Online</>
            : <><WifiOff className="h-4 w-4" />Offline</>
          }
        </button>
      </div>

      {/* ── CARD DE GANHOS (flutuante) ── */}
      <div
        className="absolute left-4 right-4 z-20"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}
      >

        {/* Entregas disponíveis quando online */}
        {isOnline && (
          <div className="mb-3">
            {deliveriesLoading ? (
              <div className="bg-white/15 backdrop-blur-md rounded-2xl p-4 flex items-center gap-3 shadow-lg">
                <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <p className="text-white text-sm font-medium">Buscando entregas...</p>
              </div>
            ) : safeDeliveries.length === 0 ? (
              <div className="bg-white/15 backdrop-blur-md rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-lg">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Search className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Você está online</p>
                  <p className="text-white/70 text-xs">Buscando entregas em {radiusKm} km...</p>
                </div>
              </div>
            ) : (
              /* Lista de entregas disponíveis */
              <div className="space-y-2 max-h-[45vh] overflow-y-auto">
                <div className="flex items-center justify-between px-1 mb-1">
                  <p className="text-white font-semibold text-sm drop-shadow">
                    {safeDeliveries.length} entrega{safeDeliveries.length > 1 ? 's' : ''} disponível{safeDeliveries.length > 1 ? 'is' : ''}
                  </p>
                </div>
                {safeDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className="bg-white/95 backdrop-blur-md rounded-2xl overflow-hidden shadow-xl"
                  >
                    {/* Topo: distância + tempo + valor */}
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-gray-100 rounded-full px-2.5 py-1">
                          <Navigation className="h-3 w-3 text-gray-500" />
                          <span className="text-xs text-gray-600 font-medium">
                            {Number(delivery.distance_km).toFixed(1)} km
                          </span>
                        </div>
                        <div className="flex items-center gap-1 bg-gray-100 rounded-full px-2.5 py-1">
                          <Clock className="h-3 w-3 text-gray-500" />
                          <span className="text-xs text-gray-600 font-medium">
                            ~{Math.ceil(Number(delivery.distance_km) * 3)} min
                          </span>
                        </div>
                      </div>
                      <span className="text-lg font-bold text-blue-600">
                        R$ {Number(delivery.price_adjusted || delivery.price).toFixed(2)}
                      </span>
                    </div>

                    {/* Endereços */}
                    <div className="px-4 py-3 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <Package className="h-3.5 w-3.5 text-green-600" />
                        </div>
                        <p className="text-sm text-gray-700 truncate flex-1">{delivery.pickup_address}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                          <MapPin className="h-3.5 w-3.5 text-red-500" />
                        </div>
                        <p className="text-sm text-gray-700 truncate flex-1">{delivery.delivery_address}</p>
                      </div>
                    </div>

                    {/* Aceitar */}
                    <div className="px-4 pb-3">
                      <button
                        onClick={() => handleAccept(delivery.id)}
                        disabled={accepting}
                        className="w-full h-10 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-60 active:scale-95 transition-transform"
                      >
                        {acceptingId === delivery.id ? 'Aceitando...' : 'Aceitar entrega'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Offline CTA */}
        {!isOnline && (
          <div className="mb-3">
            <div className="bg-white/15 backdrop-blur-md rounded-2xl px-4 py-3.5 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <WifiOff className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Você está offline</p>
                  <p className="text-white/70 text-xs">Toque para ficar disponível</p>
                </div>
              </div>
              <button
                onClick={() => toggleAvailability(true)}
                className="bg-green-500 text-white text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-transform"
              >
                Ligar
              </button>
            </div>
          </div>
        )}

        {/* Ganhos card */}
        <button
          onClick={() => navigate('/driver/wallet')}
          className="w-full bg-white/95 backdrop-blur-md rounded-2xl px-4 py-3 flex items-center justify-between shadow-xl active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-gray-500 text-xs">Ganhos hoje</p>
              <p className="text-gray-900 font-bold text-lg leading-none">
                R$ {earningsData.earnings.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-gray-500 text-xs">Entregas</p>
              <p className="text-gray-900 font-bold text-lg leading-none">{earningsData.count}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </div>
        </button>
      </div>

      {/* ── NOTIFICATION CARD ── */}
      {notificationDelivery && (
        <DeliveryNotificationCard
          delivery={notificationDelivery}
          accepting={accepting}
          onAccept={() => {
            handleAccept(notificationDelivery.id);
            setNotificationDelivery(null);
          }}
          onDecline={() => setNotificationDelivery(null)}
        />
      )}

      {/* ── BOTTOM NAV ── */}
      <DriverBottomNav />

      {/* Keyframe ping para o marker */}
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
