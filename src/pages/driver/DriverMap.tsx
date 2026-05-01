import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Navigation, Package, Clock } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNearbyDeliveries } from '@/hooks/useNearbyDeliveries';
import { DriverBottomNav } from '@/components/DriverBottomNav';
import leveiLogo from '@/assets/levei-logo.png';
import NotificationBell from '@/components/NotificationBell';

// Fix Leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const pickupIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const driverIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const DEFAULT_CENTER: [number, number] = [-19.874976, -44.99354];

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, 13); }, [map, center]);
  return null;
}

function shortAddress(addr: string) {
  return addr.split(',').slice(0, 2).join(',').trim();
}

export default function DriverMap() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [driverId, setDriverId] = useState('');
  const [isAvailable, setIsAvailable] = useState(false);
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);

  const { deliveries, loading: deliveriesLoading, radiusKm } = useNearbyDeliveries({
    driverId,
    isAvailable,
  });

  const safeDeliveries = Array.isArray(deliveries) ? deliveries : [];
  const mapCenter: [number, number] = position || DEFAULT_CENTER;

  useEffect(() => {
    if (!user) return;
    supabase.from('drivers').select('id, is_available').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data) { setDriverId(data.id); setIsAvailable(data.is_available); }
        setLoading(false);
      });
  }, [user]);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setPosition([pos.coords.latitude, pos.coords.longitude]),
      () => {},
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-primary" style={{ height: '45vh' }} />
        <div className="px-4 space-y-3 mt-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── HEADER ── */}
      <div
        className="fixed top-0 left-0 right-0 z-[1000] bg-primary flex items-center justify-between px-4"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
          paddingBottom: 12,
        }}
      >
        <img src={leveiLogo} alt="Levei" className="h-10 w-10 rounded-xl object-cover" />
        <div className="flex items-center gap-2">
          {position && (
            <div className="flex items-center gap-1 bg-white/10 rounded-full px-2.5 py-1">
              <Navigation className="h-3.5 w-3.5 text-white" />
              <span className="text-white text-xs font-medium">Ao vivo</span>
            </div>
          )}
          <NotificationBell />
        </div>
      </div>

      {/* ── MAP ── */}
      <div
        className="fixed left-0 right-0 z-10"
        style={{
          top: 'calc(env(safe-area-inset-top) + 62px)',
          height: '42vh',
        }}
      >
        <MapContainer
          center={mapCenter}
          zoom={13}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
          />
          {position && <RecenterMap center={position} />}
          {position && (
            <Marker position={position} icon={driverIcon}>
              <Popup>Você está aqui</Popup>
            </Marker>
          )}
          {safeDeliveries
            .filter((d) => d.pickup_latitude && d.pickup_longitude)
            .map((d) => (
              <Marker
                key={d.id}
                position={[d.pickup_latitude, d.pickup_longitude]}
                icon={pickupIcon}
              >
                <Popup>
                  <div className="text-xs">
                    <p className="font-semibold">{shortAddress(d.pickup_address)}</p>
                    <p className="text-gray-500">{Number(d.distance_km).toFixed(1)} km · R$ {Number(d.price_adjusted || d.price).toFixed(2)}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>

      {/* ── DELIVERY LIST (scrollable sheet below map) ── */}
      <div
        className="flex-1 overflow-y-auto pb-24 px-4 space-y-3"
        style={{
          marginTop: 'calc(env(safe-area-inset-top) + 62px + 42vh)',
          paddingTop: 16,
        }}
      >
        <div className="flex items-center justify-between px-1">
          <h2 className="font-semibold text-gray-900">Entregas disponíveis</h2>
          {safeDeliveries.length > 0 && (
            <span className="text-xs text-gray-400">Raio {radiusKm} km</span>
          )}
        </div>

        {!isAvailable ? (
          <div className="bg-white rounded-2xl shadow-sm border border-dashed border-gray-200 p-8 text-center">
            <p className="text-sm font-medium text-gray-700 mb-1">Você está offline</p>
            <p className="text-xs text-gray-400">Ative sua disponibilidade no início para ver entregas no mapa</p>
          </div>
        ) : deliveriesLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        ) : safeDeliveries.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-dashed border-gray-200 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 mx-auto mb-3 flex items-center justify-center">
              <MapPin className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-700 mb-1">Nenhuma entrega no raio</p>
            <p className="text-xs text-gray-400">Aguarde, novas entregas aparecerão automaticamente</p>
          </div>
        ) : (
          safeDeliveries.map((delivery) => (
            <div key={delivery.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
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
                <span className="text-base font-bold text-blue-600">
                  R$ {Number(delivery.price_adjusted || delivery.price).toFixed(2)}
                </span>
              </div>
              <div className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-2.5">
                  <Package className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <p className="text-xs text-gray-500 truncate">{shortAddress(delivery.pickup_address)}</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <MapPin className="h-4 w-4 text-red-400 flex-shrink-0" />
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {shortAddress(delivery.delivery_address)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <DriverBottomNav />
    </div>
  );
}
