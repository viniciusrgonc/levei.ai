import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Package, Wallet, MapPin, Eye, Clock, CheckCircle2, X, AlertCircle } from 'lucide-react';
import NotificationBell from '@/components/NotificationBell';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { RestaurantSidebar } from '@/components/RestaurantSidebar';
import { useRealtimeDeliveries } from '@/hooks/useRealtimeDeliveries';
import { Skeleton } from '@/components/ui/skeleton';
import { CancelDeliveryModal } from '@/components/CancelDeliveryModal';
import { useActiveDriver } from '@/hooks/useActiveDriver';
import { ActiveDriverBanner } from '@/components/ActiveDriverBanner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RatingModal } from '@/components/RatingModal';
import { Star } from 'lucide-react';

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

const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Aguardando entregador', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: '🕐' },
  accepted: { label: 'Coleta em andamento', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: '🚗' },
  picked_up: { label: 'Em rota de entrega', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: '📦' },
  delivered: { label: 'Entregue', color: 'bg-green-100 text-green-800 border-green-200', icon: '✅' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-800 border-red-200', icon: '❌' },
};

export default function RestaurantDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [ratingModalData, setRatingModalData] = useState<{
    deliveryId: string;
    driverUserId: string;
    driverName: string;
  } | null>(null);
  const [ratedDeliveryIds, setRatedDeliveryIds] = useState<Set<string>>(new Set());

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

  const openRatingForDelivery = async (e: React.MouseEvent, deliveryId: string, driverId: string) => {
    e.stopPropagation();
    // Fetch driver info
    const { data: driverData } = await supabase
      .from('drivers')
      .select('user_id, profiles!drivers_user_id_fkey(full_name)')
      .eq('id', driverId)
      .maybeSingle();

    if (!driverData) return;
    setRatingModalData({
      deliveryId,
      driverUserId: driverData.user_id,
      driverName: (driverData as any).profiles?.full_name || 'Entregador',
    });
  };

  // Load already-rated delivery ids so we can hide the button
  useEffect(() => {
    const loadRated = async () => {
      const ids = deliveries
        .filter((d) => d.status === 'delivered' && d.driver_id)
        .map((d) => d.id);
      if (!user || ids.length === 0) return;
      const { data } = await supabase
        .from('ratings')
        .select('delivery_id')
        .eq('rated_by', user.id)
        .in('delivery_id', ids);
      if (data) setRatedDeliveryIds(new Set(data.map((r) => r.delivery_id)));
    };
    loadRated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, deliveries]);

  const { activeDriver, noEligibleDriver, noEligibleReason } = useActiveDriver(restaurant?.id);

  useRealtimeDeliveries({
    restaurantId: restaurant?.id,
    showNotifications: true,
    onUpdate: () => fetchDeliveries(),
    onInsert: () => fetchDeliveries(),
  });

  useEffect(() => {
    fetchRestaurant();
  }, [user]);

  useEffect(() => {
    if (restaurant) {
      fetchDeliveries();
    }
  }, [restaurant]);

  const fetchRestaurant = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('restaurants')
      .select('id, business_name, wallet_balance')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        navigate('/restaurant/setup');
      }
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

  if (loading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <RestaurantSidebar />
          <div className="flex-1 flex flex-col">
            <header className="sticky top-0 z-10 h-12 sm:h-14 border-b bg-primary safe-top">
              <div className="flex h-full items-center justify-between px-3 sm:px-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <SidebarTrigger className="text-primary-foreground" />
                  <Skeleton className="h-5 w-24 sm:h-6 sm:w-32 bg-primary-foreground/20" />
                </div>
                <NotificationBell />
              </div>
            </header>
            <main className="flex-1 p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
              <Skeleton className="h-12 sm:h-14 w-full rounded-lg sm:rounded-xl" />
              <Skeleton className="h-20 sm:h-24 w-full rounded-lg sm:rounded-xl" />
              <Skeleton className="h-40 sm:h-48 w-full rounded-lg sm:rounded-xl" />
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  if (!restaurant) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background overflow-x-hidden">
        <RestaurantSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header - Compacto em mobile */}
          <header className="sticky top-0 z-10 h-12 sm:h-14 border-b bg-primary safe-top">
            <div className="flex h-full items-center justify-between px-3 sm:px-4">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10 flex-shrink-0" />
                <h1 className="text-sm sm:text-base md:text-lg font-bold text-primary-foreground truncate">
                  {restaurant.business_name}
                </h1>
              </div>
              <NotificationBell />
            </div>
          </header>

          <main className="flex-1 p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 overflow-x-hidden overflow-y-auto pb-20 sm:pb-24 safe-bottom min-w-0">
            {/* Banner de Entregador Ativo */}
            {activeDriver && activeDriver.available && (
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
            )}

            {/* Aviso quando há entregador mas não está elegível */}
            {noEligibleDriver && !activeDriver?.available && (
              <Alert variant="default" className="border-muted-foreground/20">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {noEligibleReason || 'Entregador em rota, mas a janela de tempo para adicionar entregas expirou.'}
                </AlertDescription>
              </Alert>
            )}

            {/* CTA Principal */}
            <Button
              onClick={() => navigate('/restaurant/new-delivery')}
              size="lg"
              className="w-full gap-2 sm:gap-3 text-base sm:text-lg shadow-lg h-12 sm:h-14"
            >
              <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
              Nova Entrega
            </Button>

            {/* Saldo */}
            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/restaurant/wallet')}
            >
              <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Wallet className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">Saldo disponível</p>
                    <p className="text-xl sm:text-2xl font-bold truncate">R$ {restaurant.wallet_balance.toFixed(2)}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="flex-shrink-0 text-xs sm:text-sm">
                  Adicionar
                </Button>
              </CardContent>
            </Card>

            {/* Entregas Ativas */}
            <section>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  Em andamento
                  {activeDeliveries.length > 0 && (
                    <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
                      {activeDeliveries.length}
                    </Badge>
                  )}
                </h2>
              </div>

              {activeDeliveries.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-6 sm:p-8 text-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-muted mx-auto mb-3 sm:mb-4 flex items-center justify-center">
                      <Package className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold mb-2 text-sm sm:text-base">Nenhuma entrega ativa</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4">
                      Clique em "Nova Entrega" para solicitar sua primeira entrega
                    </p>
                    <Button onClick={() => navigate('/restaurant/new-delivery')} variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Criar entrega
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {activeDeliveries.map((delivery) => {
                    const status = statusConfig[delivery.status] || statusConfig.pending;
                    return (
                      <Card
                        key={delivery.id}
                        className="cursor-pointer hover:shadow-md transition-all active:scale-[0.99]"
                        onClick={() => navigate(`/restaurant/delivery/${delivery.id}`)}
                      >
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex items-start justify-between gap-2 sm:gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 flex-wrap">
                                <span className="text-lg sm:text-xl">{status.icon}</span>
                                <Badge className={`${status.color} border font-medium text-xs`}>
                                  {status.label}
                                </Badge>
                              </div>
                              <p className="text-sm font-medium truncate flex items-center gap-1.5 sm:gap-2">
                                <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
                                <span className="truncate">{delivery.delivery_address}</span>
                              </p>
                              <div className="flex items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground">
                                <span>{delivery.distance_km?.toFixed(1)} km</span>
                                <span>•</span>
                                <span>
                                  {new Date(delivery.created_at).toLocaleTimeString('pt-BR', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-lg sm:text-xl font-bold text-primary">
                                R$ {(delivery.price_adjusted || delivery.price).toFixed(2)}
                              </p>
                              <div className="flex flex-col gap-0.5 sm:gap-1 mt-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 text-xs sm:text-sm px-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/restaurant/delivery/${delivery.id}`);
                                  }}
                                >
                                  <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                                  Rastrear
                                </Button>
                                {delivery.status === 'pending' && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 text-xs sm:text-sm px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={(e) => handleOpenCancelModal(e, delivery.id)}
                                  >
                                    <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                                    Cancelar
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Entregas Concluídas */}
            {completedDeliveries.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    Concluídas recentemente
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/restaurant/history')}
                  >
                    Ver todas
                  </Button>
                </div>

                <div className="space-y-2">
                  {completedDeliveries.slice(0, 3).map((delivery) => (
                    <Card
                      key={delivery.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/restaurant/delivery/${delivery.id}`)}
                    >
                      <CardContent className="p-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-lg">✅</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {delivery.recipient_name || delivery.delivery_address}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(delivery.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <p className="font-semibold text-green-600 text-sm">
                            R$ {(delivery.price_adjusted || delivery.price).toFixed(2)}
                          </p>
                          {delivery.driver_id && !ratedDeliveryIds.has(delivery.id) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs gap-1"
                              onClick={(e) => openRatingForDelivery(e, delivery.id, delivery.driver_id!)}
                            >
                              <Star className="h-3 w-3" />
                              Avaliar
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </main>
        </div>
      </div>

      {/* Cancel Modal */}
      {selectedDeliveryId && (
        <CancelDeliveryModal
          deliveryId={selectedDeliveryId}
          open={cancelModalOpen}
          onOpenChange={setCancelModalOpen}
          onCancelled={handleCancelSuccess}
        />
      )}

      {/* Rating Modal - opens from completed deliveries list */}
      {ratingModalData && (
        <RatingModal
          deliveryId={ratingModalData.deliveryId}
          driverUserId={ratingModalData.driverUserId}
          driverName={ratingModalData.driverName}
          onClose={() => setRatingModalData(null)}
          onSubmitted={() => {
            setRatedDeliveryIds((prev) => new Set(prev).add(ratingModalData.deliveryId));
            setRatingModalData(null);
          }}
        />
      )}
    </SidebarProvider>
  );
}
