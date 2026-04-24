import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { RestaurantSidebar } from '@/components/RestaurantSidebar';
import { useRealtimeDeliveries } from '@/hooks/useRealtimeDeliveries';
import { Skeleton } from '@/components/ui/skeleton';
import { CancelDeliveryModal } from '@/components/CancelDeliveryModal';
import { useActiveDriver } from '@/hooks/useActiveDriver';
import { ActiveDriverBanner } from '@/components/ActiveDriverBanner';
import NotificationBell from '@/components/NotificationBell';
import { BottomNav } from '@/components/BottomNav';
import { shortAddress } from '@/lib/utils';
import leveiLogo from '@/assets/levei-logo.png';
import {
  Search,
  ArrowRight,
  Crosshair,
  Map,
  MapPin,
  ChevronRight,
  Clock,
  Eye,
  X,
  Package,
  CheckCircle2,
  AlertCircle,
  Layers,
} from 'lucide-react';

type Restaurant = {
  id: string;
  business_name: string;
  wallet_balance: number;
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

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  pending:   { label: 'Aguardando entregador', color: 'bg-amber-100 text-amber-800 border-amber-200',   dot: 'bg-amber-400' },
  accepted:  { label: 'Coleta em andamento',   color: 'bg-blue-100 text-blue-800 border-blue-200',      dot: 'bg-blue-400' },
  picked_up: { label: 'Em rota de entrega',    color: 'bg-purple-100 text-purple-800 border-purple-200', dot: 'bg-purple-400' },
  delivered: { label: 'Entregue',              color: 'bg-green-100 text-green-800 border-green-200',   dot: 'bg-green-400' },
  cancelled: { label: 'Cancelada',             color: 'bg-red-100 text-red-800 border-red-200',         dot: 'bg-red-400' },
};

export default function RestaurantDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);

  const { activeDriver, noEligibleDriver, noEligibleReason } = useActiveDriver(restaurant?.id);

  useRealtimeDeliveries({
    restaurantId: restaurant?.id,
    showNotifications: true,
    onUpdate: () => fetchDeliveries(),
    onInsert: () => fetchDeliveries(),
  });

  useEffect(() => { fetchRestaurant(); }, [user]);
  useEffect(() => { if (restaurant) fetchDeliveries(); }, [restaurant]);

  const fetchRestaurant = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, business_name, wallet_balance')
      .eq('user_id', user.id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') navigate('/restaurant/setup');
      setLoading(false);
      return;
    }
    setRestaurant(data);
    setLoading(false);
  };

  const fetchDeliveries = async () => {
    if (!restaurant) return;
    const { data } = await supabase
      .from('deliveries')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setDeliveries(data || []);
  };

  const activeDeliveries = deliveries.filter(d => ['pending', 'accepted', 'picked_up'].includes(d.status));
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

  const handleOpenCancelModal = (e: React.MouseEvent, deliveryId: string) => {
    e.stopPropagation();
    setSelectedDeliveryId(deliveryId);
    setCancelModalOpen(true);
  };

  const handleCancelSuccess = () => {
    setCancelModalOpen(false);
    setSelectedDeliveryId(null);
    fetchDeliveries();
  };

  if (loading) {
    return (
      <SidebarProvider defaultOpen={false}>
        <div className="min-h-screen flex w-full bg-background">
          <RestaurantSidebar />
          <div className="flex-1 flex flex-col">
            <div className="bg-primary h-48" />
            <main className="p-4 space-y-4">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  if (!restaurant) return null;

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full bg-gray-50">
        <RestaurantSidebar />
        <div className="flex-1 flex flex-col min-w-0">

          {/* ── HERO HEADER (dark) ── */}
          <div className="bg-primary">
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <img src={leveiLogo} alt="Levei.ai" className="h-8 w-auto" />
                <span className="text-primary-foreground font-bold text-lg leading-none">
                  levei<span className="text-sky-400">.ai</span>
                </span>
              </div>
              <div className="flex items-center gap-1">
                <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10 h-9 w-9" />
                <NotificationBell />
              </div>
            </div>

            {/* Headline + search */}
            <div className="px-4 pt-2 pb-6 space-y-4">
              <h1 className="text-2xl font-bold text-primary-foreground leading-snug">
                Para onde vai<br />a entrega?
              </h1>

              {/* Search bar */}
              <div
                className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 cursor-pointer shadow-sm"
                onClick={() => navigate('/restaurant/new-delivery')}
              >
                <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-400 text-sm flex-1">Digite o endereço de destino</span>
                <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ArrowRight className="h-3.5 w-3.5 text-white" />
                </div>
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => navigate('/restaurant/new-delivery')}
                  className="flex items-center justify-center gap-2 bg-white/10 border border-white/20 rounded-xl py-2.5 text-primary-foreground text-sm hover:bg-white/20 transition-colors"
                >
                  <Crosshair className="h-4 w-4" />
                  Usar minha localização
                </button>
                <button
                  onClick={() => navigate('/restaurant/new-delivery')}
                  className="flex items-center justify-center gap-2 bg-white/10 border border-white/20 rounded-xl py-2.5 text-primary-foreground text-sm hover:bg-white/20 transition-colors"
                >
                  <Map className="h-4 w-4" />
                  Selecionar do mapa
                </button>
              </div>
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
                      onClick={() => navigate('/restaurant/new-delivery')}
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
                  <p className="font-semibold text-gray-700 text-sm mb-1">Nenhuma entrega ativa</p>
                  <p className="text-xs text-gray-400 mb-4">
                    Use a busca acima para solicitar sua primeira entrega
                  </p>
                  <button
                    onClick={() => navigate('/restaurant/new-delivery')}
                    className="inline-flex items-center gap-2 text-blue-600 text-sm font-medium"
                  >
                    <Layers className="h-4 w-4" />
                    Criar entrega
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeDeliveries.map((delivery) => {
                    const status = statusConfig[delivery.status] || statusConfig.pending;
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
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${status.color}`}>
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
        </div>
      </div>

      {selectedDeliveryId && (
        <CancelDeliveryModal
          deliveryId={selectedDeliveryId}
          open={cancelModalOpen}
          onOpenChange={setCancelModalOpen}
          onCancelled={handleCancelSuccess}
        />
      )}
    </SidebarProvider>
  );
}
