import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminSidebar } from '@/components/AdminSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import 'leaflet/dist/leaflet.css';
import { Wifi, WifiOff, Package, Star, RefreshCw, Zap } from 'lucide-react';
import { fetchPricingConfig } from '@/lib/pricing';

// ── Types ────────────────────────────────────────────────────────────────────
interface Hotspot {
  lat: number;
  lng: number;
  count: number;
}

interface DriverOnMap {
  id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  is_available: boolean;
  rating: number | null;
  total_deliveries: number | null;
  vehicle_type: string;
  last_location_update: string | null;
  full_name: string;
  avatar_url: string | null;
  in_delivery: boolean;
}

// ── Map auto-fit ─────────────────────────────────────────────────────────────
function FitBounds({ drivers }: { drivers: DriverOnMap[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || drivers.length === 0) return;
    const lats = drivers.map((d) => d.latitude);
    const lngs = drivers.map((d) => d.longitude);
    map.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [60, 60], maxZoom: 14 }
    );
    fitted.current = true;
  }, [drivers]);
  return null;
}

// ── Marker icons ─────────────────────────────────────────────────────────────
function makeIcon(status: 'online' | 'delivery' | 'offline') {
  const colors = {
    online:   { bg: '#22c55e', ring: '#86efac33' },
    delivery: { bg: '#3b82f6', ring: '#93c5fd33' },
    offline:  { bg: '#9ca3af', ring: 'transparent' },
  };
  const c = colors[status];
  return new DivIcon({
    html: renderToStaticMarkup(
      <div style={{ position: 'relative', width: 36, height: 36 }}>
        {status !== 'offline' && (
          <div style={{
            position: 'absolute', inset: -3, borderRadius: '50%',
            background: c.ring,
            animation: 'pin-pulse 2s ease-in-out infinite',
          }} />
        )}
        <div style={{
          position: 'absolute', inset: 4, borderRadius: '50%',
          background: c.bg, border: '2.5px solid white',
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      </div>
    ),
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

const ICON_ONLINE   = makeIcon('online');
const ICON_DELIVERY = makeIcon('delivery');
const ICON_OFFLINE  = makeIcon('offline');

// ── Hotspot computation ──────────────────────────────────────────────────────
// Agrupa coordenadas em uma grade de ~1km (0.01°) e retorna clusters
function computeHotspots(coords: { lat: number; lng: number }[]): Hotspot[] {
  const grid = new Map<string, Hotspot>();
  for (const c of coords) {
    const key = `${Math.round(c.lat * 100)},${Math.round(c.lng * 100)}`;
    if (grid.has(key)) {
      grid.get(key)!.count++;
    } else {
      grid.set(key, { lat: c.lat, lng: c.lng, count: 1 });
    }
  }
  return Array.from(grid.values());
}

// ── Fetch pending delivery hotspots ──────────────────────────────────────────
async function fetchHotspots(): Promise<Hotspot[]> {
  const { data } = await supabase
    .from('deliveries')
    .select('pickup_lat, pickup_lng')
    .in('status', ['pending', 'scheduled'])
    .not('pickup_lat', 'is', null)
    .not('pickup_lng', 'is', null)
    .limit(200);

  if (!data || data.length === 0) return [];
  const coords = (data as { pickup_lat: number; pickup_lng: number }[]).map((d) => ({
    lat: d.pickup_lat,
    lng: d.pickup_lng,
  }));
  return computeHotspots(coords);
}

// ── Query ────────────────────────────────────────────────────────────────────
async function fetchDriversOnMap(): Promise<DriverOnMap[]> {
  const [{ data: drivers }, { data: activeDeliveries }] = await Promise.all([
    supabase
      .from('drivers')
      .select('id, user_id, latitude, longitude, is_available, rating, total_deliveries, vehicle_type, last_location_update')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null),
    supabase
      .from('deliveries')
      .select('driver_id')
      .in('status', ['accepted', 'picking_up', 'picked_up', 'delivering', 'returning']),
  ]);

  const inDeliveryIds = new Set((activeDeliveries ?? []).map((d) => d.driver_id));

  // Fetch profiles for names
  const userIds = (drivers ?? []).map((d) => d.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', userIds);

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  return (drivers ?? []).map((d) => ({
    ...d,
    latitude: d.latitude!,
    longitude: d.longitude!,
    full_name: profileMap[d.user_id]?.full_name ?? 'Motorista',
    avatar_url: profileMap[d.user_id]?.avatar_url ?? null,
    in_delivery: inDeliveryIds.has(d.id),
  }));
}

// ── Vehicle label ─────────────────────────────────────────────────────────────
const VEHICLE_LABELS: Record<string, string> = {
  motorcycle: '🏍️ Moto', bicycle: '🚲 Bicicleta', car: '🚗 Carro',
  van: '🚐 Van', truck: '🚚 Caminhão', hourly_service: '⏱️ Hora',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminDriverMap() {
  const [drivers, setDrivers] = useState<DriverOnMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [dynamicEnabled, setDynamicEnabled] = useState(false);
  const [dynamicMultiplier, setDynamicMultiplier] = useState(1);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);

  const load = async () => {
    setLoading(true);
    const [data, config, spots] = await Promise.all([
      fetchDriversOnMap(),
      fetchPricingConfig(),
      fetchHotspots(),
    ]);
    setDrivers(data);
    setDynamicEnabled(config?.dynamic_enabled ?? false);
    setDynamicMultiplier(config?.dynamic_multiplier ?? 1);
    setHotspots(spots);
    setLastUpdate(new Date());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Realtime: re-fetch when drivers table changes ──────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('admin-driver-map-rt')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'drivers',
      }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const online   = drivers.filter((d) => d.is_available && !d.in_delivery).length;
  const inDel    = drivers.filter((d) => d.in_delivery).length;
  const offline  = drivers.filter((d) => !d.is_available && !d.in_delivery).length;

  const mapCenter: [number, number] = drivers.length > 0
    ? [
        drivers.reduce((s, d) => s + d.latitude, 0) / drivers.length,
        drivers.reduce((s, d) => s + d.longitude, 0) / drivers.length,
      ]
    : [-19.9167, -43.9345];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">

          <AdminPageHeader title="Mapa ao Vivo" showBack showLogout>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 border border-white/20 text-white/80 hover:bg-white/10 rounded-lg px-3 py-1.5 text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </AdminPageHeader>

          {/* ── Modo dinâmico banner ── */}
          {dynamicEnabled && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-500 z-10">
              <div className="flex items-center gap-2 flex-1">
                <Zap className="h-4 w-4 text-white flex-shrink-0" />
                <span className="text-white font-bold text-sm">
                  Modo Dinâmico Ativo — {dynamicMultiplier}× multiplicador
                </span>
                <span className="text-amber-100 text-xs ml-1">
                  · Círculos vermelhos = alta demanda
                </span>
              </div>
            </div>
          )}

          {/* ── Stats bar ── */}
          <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 z-10">
            <StatChip icon={Wifi} label="Online" value={online} color="text-green-600" bg="bg-green-50" dot="#22c55e" />
            <StatChip icon={Package} label="Em entrega" value={inDel} color="text-blue-600" bg="bg-blue-50" dot="#3b82f6" />
            <StatChip icon={WifiOff} label="Offline" value={offline} color="text-gray-500" bg="bg-gray-100" dot="#9ca3af" />
            <div className="ml-auto text-gray-400 text-xs">
              Atualizado {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>

          {/* ── Legend ── */}
          <div className="flex items-center gap-4 px-4 py-2 bg-white border-b border-gray-50">
            {[
              { color: '#22c55e', label: 'Disponível' },
              { color: '#3b82f6', label: 'Em entrega' },
              { color: '#9ca3af', label: 'Offline' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                <span className="text-gray-500 text-xs">{l.label}</span>
              </div>
            ))}
            {dynamicEnabled && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#ef4444' }} />
                <span className="text-gray-500 text-xs">Alta demanda</span>
              </div>
            )}
          </div>

          {/* ── Map ── */}
          <div className="flex-1 relative" style={{ minHeight: 0 }}>
            {loading && drivers.length === 0 && (
              <div className="absolute inset-0 z-10 bg-gray-100 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-4 border-gray-300 border-t-primary animate-spin" />
                  <p className="text-gray-500 text-sm">Carregando mapa...</p>
                </div>
              </div>
            )}

            {!loading && drivers.length === 0 && (
              <div className="absolute inset-0 z-10 bg-gray-100 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-gray-500 font-medium">Nenhum motorista com localização disponível</p>
                  <p className="text-gray-400 text-sm mt-1">Aguarde os motoristas ficarem online</p>
                </div>
              </div>
            )}

            <MapContainer
              center={mapCenter}
              zoom={13}
              zoomControl={true}
              className="h-full w-full"
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
              />
              <FitBounds drivers={drivers} />

              {/* ── Hotspot circles — visíveis apenas com modo dinâmico ativo ── */}
              {dynamicEnabled && hotspots.map((spot, idx) => {
                // Raio base 400m + 100m por entrega extra no cluster
                const radiusMeters = 400 + (spot.count - 1) * 120;
                return (
                  <Circle
                    key={`hotspot-${idx}`}
                    center={[spot.lat, spot.lng]}
                    radius={radiusMeters}
                    pathOptions={{
                      color: '#ef4444',
                      fillColor: '#ef4444',
                      fillOpacity: 0.15 + Math.min(spot.count * 0.05, 0.25),
                      weight: 1.5,
                      dashArray: '6 4',
                    }}
                  />
                );
              })}

              {drivers.map((driver) => {
                const status = driver.in_delivery ? 'delivery' : driver.is_available ? 'online' : 'offline';
                const icon = status === 'delivery' ? ICON_DELIVERY : status === 'online' ? ICON_ONLINE : ICON_OFFLINE;
                return (
                  <Marker key={driver.id} position={[driver.latitude, driver.longitude]} icon={icon}>
                    <Popup className="driver-popup" minWidth={200}>
                      <div className="p-1">
                        {/* Name + avatar */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-9 h-9 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                            {driver.avatar_url ? (
                              <img src={driver.avatar_url} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <span className="text-gray-500 font-bold text-sm">
                                {driver.full_name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-sm leading-tight">{driver.full_name}</p>
                            <p className="text-gray-400 text-xs">{VEHICLE_LABELS[driver.vehicle_type] ?? driver.vehicle_type}</p>
                          </div>
                        </div>

                        {/* Status badge */}
                        <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 mb-2 ${
                          status === 'delivery' ? 'bg-blue-50' : status === 'online' ? 'bg-green-50' : 'bg-gray-100'
                        }`}>
                          <div className="w-1.5 h-1.5 rounded-full" style={{
                            background: status === 'delivery' ? '#3b82f6' : status === 'online' ? '#22c55e' : '#9ca3af',
                          }} />
                          <span className={`text-xs font-semibold ${
                            status === 'delivery' ? 'text-blue-700' : status === 'online' ? 'text-green-700' : 'text-gray-500'
                          }`}>
                            {status === 'delivery' ? 'Em entrega' : status === 'online' ? 'Disponível' : 'Offline'}
                          </span>
                        </div>

                        {/* Stats */}
                        <div className="flex gap-2">
                          {driver.rating && (
                            <div className="flex items-center gap-1 bg-amber-50 rounded-lg px-2 py-1">
                              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                              <span className="text-amber-700 text-xs font-bold">{Number(driver.rating).toFixed(1)}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1">
                            <Package className="h-3 w-3 text-gray-500" />
                            <span className="text-gray-600 text-xs font-semibold">{driver.total_deliveries ?? 0}</span>
                          </div>
                        </div>

                        {driver.last_location_update && (
                          <p className="text-gray-300 text-[10px] mt-2">
                            Última posição: {new Date(driver.last_location_update).toLocaleTimeString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes pin-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50%       { opacity: 0.2; transform: scale(1.5); }
        }
        .driver-popup .leaflet-popup-content-wrapper {
          border-radius: 16px;
          padding: 0;
          box-shadow: 0 8px 30px rgba(0,0,0,0.12);
        }
        .driver-popup .leaflet-popup-content { margin: 12px; }
        .driver-popup .leaflet-popup-tip-container { display: none; }
      `}</style>
    </SidebarProvider>
  );
}

// ── Stat chip ────────────────────────────────────────────────────────────────
function StatChip({ icon: Icon, label, value, color, bg, dot }: {
  icon: React.ElementType; label: string; value: number; color: string; bg: string; dot: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${bg} rounded-xl px-3 py-2`}>
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dot }} />
      <span className={`font-black text-lg leading-none ${color}`}>{value}</span>
      <span className="text-gray-500 text-xs">{label}</span>
    </div>
  );
}
