import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import {
  MapPin, Package, Navigation, Star, TrendingUp,
  ChevronRight, Clock, Wifi, WifiOff,
} from 'lucide-react';
import { DeliveryNotificationCard } from '@/components/DeliveryNotificationCard';
import { DriverDrawer } from '@/components/DriverDrawer';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
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
async function fetchDriverProfile(userId: string) {
  const { data: profileData } = await supabase
    .from('profiles').select('full_name, avatar_url').eq('id', userId).maybeSingle();
  const { data: driverData } = await supabase
    .from('drivers').select('rating, points, referral_code, total_deliveries').eq('user_id', userId).maybeSingle();
  return {
    name: profileData?.full_name ?? '',
    avatarUrl: profileData?.avatar_url ?? null,
    rating: driverData?.rating ?? null,
    points: driverData?.points ?? 0,
    referralCode: driverData?.referral_code ?? null,
    totalDeliveries: driverData?.total_deliveries ?? 0,
  };
}

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
      <div style={{ position: 'relative', width: 56, height: 56 }}>
        {online && (
          <>
            {/* Outer pulse ring — slow */}
            <div style={{
              position: 'absolute', inset: -2, borderRadius: '50%',
              background: `${color}22`,
              animation: 'ping-slow 2.4s cubic-bezier(0,0,0.2,1) infinite',
            }} />
            {/* Inner pulse ring — faster, offset */}
            <div style={{
              position: 'absolute', inset: 4, borderRadius: '50%',
              background: `${color}30`,
              animation: 'ping-slow 2.4s cubic-bezier(0,0,0.2,1) infinite 0.8s',
            }} />
          </>
        )}
        {/* Core dot */}
        <div style={{
          position: 'absolute', inset: 10, borderRadius: '50%',
          background: color, border: '3px solid white',
          boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      </div>
    ),
    className: '',
    iconSize: [56, 56],
    iconAnchor: [28, 28],
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

  // ── Drawer state ──────────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);

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
  const { data: driverProfile } = useQuery({
    queryKey: ['driver-profile', user?.id],
    queryFn: () => fetchDriverProfile(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

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
            {isOnline && (
              <Circle
                center={position}
                radius={radiusKm * 1000}
                pathOptions={{
                  color: '#3b82f6',
                  fillColor: '#3b82f6',
                  fillOpacity: 0.06,
                  weight: 1.5,
                  dashArray: '6 5',
                }}
              />
            )}
          </>
        )}
      </MapContainer>

      {/* ── OVERLAY escuro leve (melhora contraste da UI) ── */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.15)' }}
      />

      {/* ── GRADIENTE topo ── */}
      <div
        className="absolute top-0 left-0 right-0 z-10 pointer-events-none"
        style={{
          height: 160,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.60) 0%, transparent 100%)',
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
        {/* Logo/Avatar */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="active:scale-90 transition-transform"
        >
          {driverProfile?.avatarUrl ? (
            <img
              src={driverProfile.avatarUrl}
              alt={driverProfile.name}
              className="h-9 w-9 rounded-xl object-cover shadow-lg border-2 border-white/40"
            />
          ) : (
            <img src={leveiLogo} alt="Levei" className="h-9 w-9 rounded-xl object-cover shadow-lg" />
          )}
        </button>

        {/* Right: rating + bell + toggle agrupados */}
        <div className="flex items-center gap-2">
          {driver?.rating && (
            <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-full px-2.5 py-1.5 shadow">
              <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
              <span className="text-white text-xs font-semibold">
                {Number(driver.rating).toFixed(1)}
              </span>
            </div>
          )}

          {/* Bell + toggle numa cápsula só */}
          <div className="flex items-center bg-black/40 backdrop-blur-md rounded-2xl shadow overflow-hidden">
            <div className="text-white">
              <NotificationBell />
            </div>
            <div className="w-px self-stretch bg-white/15 mx-0.5" />
            <button
              onClick={() => toggleAvailability(!isOnline)}
              className={`flex items-center gap-1.5 px-3 py-2 transition-all active:scale-95 ${
                isOnline ? 'text-green-400' : 'text-gray-300'
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi className="h-3.5 w-3.5 flex-shrink-0" />
                  <div className="leading-none text-left">
                    <p className="text-[11px] font-bold text-white">Online</p>
                    <p className="text-[9px] text-white/60 mt-0.5">{radiusKm} km</p>
                  </div>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-semibold text-white/70">Offline</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── CARD DE GANHOS (flutuante) ── */}
      <div
        className="absolute left-4 right-4 z-20"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}
      >

        {/* "Buscando entregas..." — visível quando online e sem entregas */}
        {isOnline && safeDeliveries.length === 0 && !notificationDelivery && (
          <div className="mb-3 flex justify-center">
            <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm rounded-full px-4 py-2 shadow">
              <div className="flex gap-0.5 items-end h-3">
                <span className="w-1 bg-green-400 rounded-full" style={{ height: '40%', animation: 'bar-bounce 1.2s ease-in-out infinite 0s' }} />
                <span className="w-1 bg-green-400 rounded-full" style={{ height: '80%', animation: 'bar-bounce 1.2s ease-in-out infinite 0.2s' }} />
                <span className="w-1 bg-green-400 rounded-full" style={{ height: '55%', animation: 'bar-bounce 1.2s ease-in-out infinite 0.4s' }} />
              </div>
              <p className="text-white/80 text-xs font-medium tracking-wide">Buscando entregas...</p>
            </div>
          </div>
        )}

        {/* Entregas disponíveis quando online */}
        {isOnline && safeDeliveries.length > 0 && (
          <div className="mb-3">
            {/* Lista de entregas disponíveis */}
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
          </div>
        )}

        {/* Ganhos card — compacto */}
        <button
          onClick={() => navigate('/driver/wallet')}
          className="w-full bg-white/95 backdrop-blur-md rounded-2xl px-4 py-2.5 flex items-center gap-3 shadow-xl active:scale-[0.98] transition-transform"
        >
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex-1 flex items-baseline gap-1.5 min-w-0">
            <span className="text-gray-400 text-xs whitespace-nowrap">Ganhos hoje</span>
            <span className="text-gray-900 font-bold text-base leading-none">
              R$ {earningsData.earnings.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="bg-gray-100 rounded-full px-2.5 py-1">
              <span className="text-gray-600 text-xs font-semibold">
                {earningsData.count} {earningsData.count === 1 ? 'entrega' : 'entregas'}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300" />
          </div>
        </button>
      </div>

      {/* ── DRAWER ── */}
      <DriverDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        profile={driverProfile ?? {
          name: '',
          avatarUrl: null,
          rating: driver?.rating ?? null,
          points: driver?.points ?? 0,
          referralCode: driver?.referral_code ?? null,
          totalDeliveries: 0,
        }}
      />

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

      <style>{`
        @keyframes ping-slow {
          0%   { transform: scale(1);   opacity: 0.6; }
          75%  { transform: scale(2.2); opacity: 0;   }
          100% { transform: scale(2.2); opacity: 0;   }
        }
        @keyframes bar-bounce {
          0%, 100% { transform: scaleY(1);   }
          50%       { transform: scaleY(2.2); }
        }
      `}</style>
    </div>
  );
}
