import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import {
  MapPin, Package, Navigation, Clock,
  ChevronRight, Wifi, WifiOff,
} from 'lucide-react';
import { DeliveryNotificationCard } from '@/components/DeliveryNotificationCard';
import { DriverDrawer } from '@/components/DriverDrawer';
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
  const color = online ? '#22c55e' : '#6b7280';
  return new DivIcon({
    html: renderToStaticMarkup(
      <div style={{ position: 'relative', width: 56, height: 56 }}>
        {online && (
          <>
            <div style={{
              position: 'absolute', inset: -2, borderRadius: '50%',
              background: `${color}22`,
              animation: 'ping-slow 2.4s cubic-bezier(0,0,0.2,1) infinite',
            }} />
            <div style={{
              position: 'absolute', inset: 4, borderRadius: '50%',
              background: `${color}30`,
              animation: 'ping-slow 2.4s cubic-bezier(0,0,0.2,1) infinite 0.8s',
            }} />
          </>
        )}
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

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notificationDelivery, setNotificationDelivery] = useState<any | null>(null);
  const seenDeliveryIds = useRef<Set<string>>(new Set());

  // ── Geolocation ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    watchRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => setPosition([coords.latitude, coords.longitude]),
      () => setPosition([-19.9167, -43.9345]),
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

  // ── New delivery notification ─────────────────────────────────────────────
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
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="" />
        {position && (
          <>
            <Marker position={position} icon={driverIcon(isOnline)} />
            <RecenterMap lat={position[0]} lng={position[1]} />
          </>
        )}
      </MapContainer>

      {/* ── OVERLAY ── */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.12)' }}
      />

      {/* ── GRADIENTE topo ── */}
      <div
        className="absolute top-0 left-0 right-0 z-10 pointer-events-none"
        style={{ height: 180, background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%)' }}
      />

      {/* ── GRADIENTE rodapé ── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none"
        style={{ height: 380, background: 'linear-gradient(to top, rgba(0,0,0,0.60) 0%, transparent 100%)' }}
      />

      {/* ════════════════════════════════════════════════════════════════════
          HEADER — logo | ganhos discretos | sino | toggle
      ════════════════════════════════════════════════════════════════════ */}
      <div
        className="absolute left-0 right-0 z-20 flex items-center justify-between px-4"
        style={{ top: 0, paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        {/* Esquerda: logo / avatar → abre drawer */}
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

        {/* Centro: ganhos do dia — pequenos e discretos */}
        <button
          onClick={() => navigate('/driver/wallet')}
          className="flex items-center gap-1.5 bg-black/35 backdrop-blur-md rounded-full px-3 py-1.5 active:scale-95 transition-transform"
        >
          <span className="text-white/60 text-[11px]">Hoje</span>
          <span className="text-white font-bold text-[13px]">
            R$ {earningsData.earnings.toFixed(2)}
          </span>
          {earningsData.count > 0 && (
            <span className="text-white/40 text-[10px]">
              · {earningsData.count}x
            </span>
          )}
        </button>

        {/* Direita: sino + toggle */}
        <div
          className="flex items-center bg-black/40 backdrop-blur-md rounded-2xl shadow"
          style={{ overflow: 'visible' }}
        >
          <div className="text-white">
            <NotificationBell />
          </div>
          <div className="w-px self-stretch bg-white/15 mx-0.5" />
          <button
            onClick={() => toggleAvailability(!isOnline)}
            className="flex items-center gap-1.5 px-3 py-2 active:scale-95 transition-transform"
          >
            {isOnline ? (
              <>
                {/* Pulsing green dot */}
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
                </span>
                <span className="text-[12px] font-bold text-white">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-[12px] font-semibold text-white/60">Offline</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          ÁREA INFERIOR — card operacional + entregas
      ════════════════════════════════════════════════════════════════════ */}
      <div
        className="absolute left-4 right-4 z-20"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}
      >

        {/* ── ONLINE + entregas disponíveis ── */}
        {isOnline && safeDeliveries.length > 0 && (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto mb-3">
            <p className="text-white font-semibold text-sm drop-shadow px-1 mb-1">
              {safeDeliveries.length} entrega{safeDeliveries.length > 1 ? 's' : ''} disponível{safeDeliveries.length > 1 ? 'is' : ''}
            </p>
            {safeDeliveries.map((delivery) => (
              <div
                key={delivery.id}
                className="bg-white/95 backdrop-blur-md rounded-2xl overflow-hidden shadow-xl"
              >
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
                  <span className="text-lg font-bold text-primary">
                    R$ {Number(delivery.price_adjusted || delivery.price).toFixed(2)}
                  </span>
                </div>
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

        {/* ── CARD OPERACIONAL PRINCIPAL ── */}
        {/* Online, buscando — card grande e vivo */}
        {isOnline && safeDeliveries.length === 0 && !notificationDelivery && (
          <div
            className="w-full rounded-3xl overflow-hidden shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(22,163,74,0.95) 0%, rgba(16,185,129,0.90) 100%)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <div className="px-5 py-5 flex items-center gap-4">
              {/* Animated status icon */}
              <div className="relative flex-shrink-0">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                >
                  {/* Outer pulse */}
                  <span
                    className="absolute w-14 h-14 rounded-2xl"
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      animation: 'op-pulse 2s ease-in-out infinite',
                    }}
                  />
                  <Wifi className="h-7 w-7 text-white relative z-10" />
                </div>
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                  </span>
                  <p className="text-white font-black text-base tracking-wide uppercase">Online</p>
                </div>
                <p className="text-white/80 text-sm font-medium">Buscando entregas...</p>
                <div className="mt-2 flex gap-0.5 items-end h-4">
                  {[0, 0.15, 0.3, 0.45, 0.6].map((delay, i) => (
                    <span
                      key={i}
                      className="w-1.5 rounded-full bg-white/60"
                      style={{
                        height: '60%',
                        animation: `bar-bounce 1.4s ease-in-out infinite ${delay}s`,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Go offline button */}
              <button
                onClick={() => toggleAvailability(false)}
                className="flex-shrink-0 bg-white/20 hover:bg-white/30 active:scale-90 transition-all rounded-xl px-3 py-2 text-white text-xs font-bold"
              >
                Pausar
              </button>
            </div>
          </div>
        )}

        {/* ── OFFLINE — card para ir online ── */}
        {!isOnline && (
          <div
            className="w-full rounded-3xl overflow-hidden shadow-2xl"
            style={{
              background: 'rgba(17,24,39,0.88)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="px-5 py-5 flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <WifiOff className="h-7 w-7 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-base">Offline</p>
                <p className="text-white/50 text-sm">Fique online para receber entregas</p>
              </div>
              <button
                onClick={() => toggleAvailability(true)}
                className="flex-shrink-0 bg-green-500 hover:bg-green-400 active:scale-90 transition-all rounded-xl px-4 py-2.5 text-white text-sm font-black shadow-lg shadow-green-500/30"
              >
                Ir online
              </button>
            </div>
          </div>
        )}
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
          0%, 100% { transform: scaleY(0.4); }
          50%       { transform: scaleY(1);   }
        }
        @keyframes op-pulse {
          0%, 100% { transform: scale(1);   opacity: 1; }
          50%       { transform: scale(1.08); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
