import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { useRealtimeDeliveries } from '@/hooks/useRealtimeDeliveries';
import { Skeleton } from '@/components/ui/skeleton';
import { CancelDeliveryModal } from '@/components/CancelDeliveryModal';
import { useActiveDriver } from '@/hooks/useActiveDriver';
import { ActiveDriverBanner } from '@/components/ActiveDriverBanner';
import NotificationBell from '@/components/NotificationBell';
import { BottomNav } from '@/components/BottomNav';
import { shortAddress } from '@/lib/utils';
import { getStatusConfig } from '@/lib/deliveryStatus';
import leveiLogo from '@/assets/levei-logo.png';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight, Crosshair, Map, MapPin, ChevronRight,
  Eye, X, Package, CheckCircle2, AlertCircle, Layers, Navigation2,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────
type Restaurant = {
  id: string;
  business_name: string;
  wallet_balance: number;
  address: string;
};

type Delivery = {
  id: string;
  delivery_address: string;
  pickup_address: string;
  status: string;
  price: number;
  price_adjusted: number;
  created_at: string;
  driver_id: string | null;
  distance_km: number;
  recipient_name: string | null;
};

// ── Query functions ────────────────────────────────────────────────────────
async function fetchRestaurant(userId: string): Promise<Restaurant> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, business_name, wallet_balance, address')
    .eq('user_id', userId)
    .single();
  if (error?.code === 'PGRST116') throw new Error('SETUP_REQUIRED');
  if (error) throw error;
  return data;
}

async function fetchDeliveries(restaurantId: string): Promise<Delivery[]> {
  const { data } = await supabase
    .from('deliveries')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(20);
  return data || [];
}

// ── Component ──────────────────────────────────────────────────────────────
export default function RestaurantDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [pickupInput, setPickupInput] = useState('');
  const [deliveryInput, setDeliveryInput] = useState('');

  // ── Queries ──────────────────────────────────────────────────────────────
  const {
    data: restaurant,
    isLoading: restaurantLoading,
    error: restaurantError,
  } = useQuery({
    queryKey: ['restaurant', user?.id],
    queryFn: () => fetchRestaurant(user!.id),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    retry: (count, err: any) => err?.message !== 'SETUP_REQUIRED' && count < 2,
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ['restaurant-deliveries', restaurant?.id],
    queryFn: () => fetchDeliveries(restaurant!.id),
    enabled: !!restaurant?.id,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });

  // ── Realtime → invalidate cache ───────────────────────────────────────────
  useRealtimeDeliveries({
    restaurantId: restaurant?.id,
    showNotifications: true,
    onUpdate: () => queryClient.invalidateQueries({ queryKey: ['restaurant-deliveries', restaurant?.id] }),
    onInsert: () => queryClient.invalidateQueries({ queryKey: ['restaurant-deliveries', restaurant?.id] }),
  });

  const { activeDriver, noEligibleDriver, noEligibleReason } = useActiveDriver(restaurant?.id);

  // ── Pre-fill pickup from restaurant address ────────────────────────────────
  useEffect(() => {
    if (restaurant?.address && !pickupInput) setPickupInput(restaurant.address);
  }, [restaurant?.address]);

  // ── Redirects ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (restaurantError?.message === 'SETUP_REQUIRED') {
      navigate('/restaurant/setup');
    }
  }, [restaurantError, navigate]);

  // ── Usar minha localização ─────────────────────────────────────────────────
  const handleUseLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`
          );
          const data = await res.json();
          setPickupInput(data.display_name || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
        } catch {
          setPickupInput(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
        }
      },
      () => {} // silently fail — user can type instead
    );
  };

  const handleContinuar = () => {
    if (!pickupInput.trim() || !deliveryInput.trim()) return;
    navigate(
      `/restaurant/confirm-delivery?from=${encodeURIComponent(pickupInput)}&to=${encodeURIComponent(deliveryInput)}`
    );
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const activeDeliveries = deliveries.filter(d =>
    ['pending', 'accepted', 'picking_up', 'picked_up', 'delivering', 'returning'].includes(d.status)
  );
  const completedDeliveries = deliveries.filter(d => d.status === 'delivered');

  const recentDestinations = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const d of deliveries) {
      if (d.delivery_address && !seen.has(d.delivery_address)) {
        seen.add(d.delivery_address);
        result.push(d.delivery_address);
        if (result.length === 3) break;
      }
    }
    return result;
  }, [deliveries]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleOpenCancelModal = (e: React.MouseEvent, deliveryId: string) => {
    e.stopPropagation();
    setSelectedDeliveryId(deliveryId);
    setCancelModalOpen(true);
  };

  const handleCancelSuccess = () => {
    setCancelModalOpen(false);
    setSelectedDeliveryId(null);
    queryClient.invalidateQueries({ queryKey: ['restaurant-deliveries', restaurant?.id] });
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (restaurantLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="bg-primary h-48" />
        <main className="p-4 space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  if (!restaurant) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

          {/* ── HERO HEADER (dark) ── */}
          <div className="bg-primary">
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 pb-2"
              style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
              <img src={leveiLogo} alt="Levei.ai" className="h-10 w-10 rounded-xl object-cover" />
              <div className="flex items-center gap-1">
                <NotificationBell />
              </div>
            </div>

            {/* Headline + De/Para */}
            <div className="px-4 pt-2 pb-5 space-y-3">
              <h1 className="text-2xl font-bold text-primary-foreground leading-snug">
                Criar nova<br />entrega
              </h1>

              {/* De/Para card */}
              <div className="bg-white rounded-2xl shadow-md overflow-hidden">
                {/* De */}
                <div className="px-4 pt-3 pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">De (coleta)</p>
                  </div>
                  <input
                    className="w-full text-sm text-gray-900 placeholder-gray-400 bg-transparent outline-none py-0.5"
                    placeholder="Digite o endereço de coleta"
                    value={pickupInput}
                    onChange={(e) => setPickupInput(e.target.value)}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleUseLocation}
                      className="flex items-center gap-1.5 text-[11px] text-blue-600 font-semibold bg-blue-50 px-2.5 py-1.5 rounded-lg"
                    >
                      <Crosshair className="h-3 w-3" />
                      Minha localização
                    </button>
                    <button
                      onClick={() => navigate('/restaurant/new-delivery')}
                      className="flex items-center gap-1.5 text-[11px] text-gray-600 font-semibold bg-gray-100 px-2.5 py-1.5 rounded-lg"
                    >
                      <Map className="h-3 w-3" />
                      No mapa
                    </button>
                  </div>
                </div>

                {/* Divider with swap icon */}
                <div className="flex items-center gap-2 px-4 py-1.5 border-t border-b border-gray-100">
                  <div className="flex-1 border-t border-dashed border-gray-200" />
                  <Navigation2 className="h-3.5 w-3.5 text-gray-300" />
                  <div className="flex-1 border-t border-dashed border-gray-200" />
                </div>

                {/* Para */}
                <div className="px-4 pt-2 pb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Para (entrega)</p>
                  </div>
                  <input
                    className="w-full text-sm text-gray-900 placeholder-gray-400 bg-transparent outline-none py-0.5"
                    placeholder="Digite o endereço de destino"
                    value={deliveryInput}
                    onChange={(e) => setDeliveryInput(e.target.value)}
                  />
                </div>
              </div>

              {/* CTA: Continuar (enabled when both filled) or quick hint */}
              {pickupInput.trim() && deliveryInput.trim() ? (
                <button
                  onClick={handleContinuar}
                  className="w-full flex items-center justify-center gap-2 bg-white text-primary font-bold text-sm py-3 rounded-2xl shadow-sm"
                >
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <p className="text-center text-white/50 text-xs">
                  Preencha os dois endereços para continuar
                </p>
              )}
            </div>
          </div>

          {/* ── CONTENT ── */}
          <main className="flex-1 overflow-y-auto pb-20">

            {/* Active driver banner */}
            {activeDriver?.available && (
              <div className="px-4 pt-4">
                <ActiveDriverBanner
                  driverId={activeDriver.driver_id!}
                  parentDeliveryId={activeDriver.parent_delivery_id!}
                  currentCount={activeDriver.current_count!}
                  maxCount={activeDriver.max_count!}
                  timeRemainingMinutes={activeDriver.time_remaining_minutes!}
                  basePrice={activeDriver.base_price!}
                  pricePerKm={activeDriver.price_per_km!}
                  regularBasePrice={activeDriver.regular_base_price}
                  regularPricePerKm={activeDriver.regular_price_per_km}
                />
              </div>
            )}

            {noEligibleDriver && !activeDriver?.available && (
              <div className="px-4 pt-4">
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">{noEligibleReason || 'Janela de tempo para adicionar entregas expirou.'}</p>
                </div>
              </div>
            )}

            {/* Últimos destinos */}
            {recentDestinations.length > 0 && (
              <section className="px-4 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-gray-900">Últimos destinos</h2>
                  <button
                    onClick={() => navigate('/restaurant/history')}
                    className="text-blue-600 text-sm font-medium"
                  >
                    Ver todos
                  </button>
                </div>
                <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
                  {recentDestinations.map((address, i) => (
                    <button
                      key={i}
                      onClick={() => setDeliveryInput(address)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-4 w-4 text-gray-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{shortAddress(address)}</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{address}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Em andamento */}
            <section className="px-4 pt-5">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="font-semibold text-gray-900">Em andamento</h2>
                {activeDeliveries.length > 0 && (
                  <Badge className="bg-blue-100 text-blue-700 border-none text-xs h-5 px-2">
                    {activeDeliveries.length}
                  </Badge>
                )}
              </div>

              {activeDeliveries.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-dashed border-gray-200 p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 mx-auto mb-3 flex items-center justify-center">
                    <Package className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="font-semibold text-gray-700 text-sm mb-1">Você ainda não fez nenhuma entrega</p>
                  <p className="text-xs text-gray-400 mb-4">
                    Preencha os endereços acima para começar
                  </p>
                  <button
                    onClick={() => navigate('/restaurant/new-delivery')}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl"
                  >
                    <Layers className="h-4 w-4" />
                    Criar entrega agora
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeDeliveries.map((delivery) => {
                    const status = getStatusConfig(delivery.status);
                    return (
                      <div
                        key={delivery.id}
                        className="bg-white rounded-2xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
                        onClick={() => navigate(`/restaurant/delivery/${delivery.id}`)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`w-2 h-2 rounded-full ${status.dot}`} />
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${status.badge}`}>
                                {status.label}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                              {shortAddress(delivery.delivery_address)}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {delivery.distance_km?.toFixed(1)} km · {new Date(delivery.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-base font-bold text-blue-600">
                              R$ {(delivery.price_adjusted || delivery.price).toFixed(2)}
                            </p>
                            <div className="flex flex-col gap-1 mt-1">
                              <button
                                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                                onClick={(e) => { e.stopPropagation(); navigate(`/restaurant/delivery/${delivery.id}`); }}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Rastrear
                              </button>
                              {delivery.status === 'pending' && (
                                <button
                                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                                  onClick={(e) => handleOpenCancelModal(e, delivery.id)}
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Cancelar
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Concluídas recentemente */}
            {completedDeliveries.length > 0 && (
              <section className="px-4 pt-5 pb-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    Concluídas
                  </h2>
                  <button
                    onClick={() => navigate('/restaurant/history')}
                    className="text-blue-600 text-sm font-medium"
                  >
                    Ver todas
                  </button>
                </div>
                <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
                  {completedDeliveries.slice(0, 3).map((delivery) => (
                    <button
                      key={delivery.id}
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
                      onClick={() => navigate(`/restaurant/delivery/${delivery.id}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {delivery.recipient_name || shortAddress(delivery.delivery_address)}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(delivery.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-green-600 flex-shrink-0 ml-2">
                        R$ {(delivery.price_adjusted || delivery.price).toFixed(2)}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </main>

          <BottomNav />

      {selectedDeliveryId && (
        <CancelDeliveryModal
          deliveryId={selectedDeliveryId}
          open={cancelModalOpen}
          onOpenChange={setCancelModalOpen}
          onCancelled={handleCancelSuccess}
        />
      )}
    </div>
  );
}
