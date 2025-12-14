import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Package, Wallet, MapPin, Eye, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import NotificationBell from '@/components/NotificationBell';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { RestaurantSidebar } from '@/components/RestaurantSidebar';
import { useRealtimeDeliveries } from '@/hooks/useRealtimeDeliveries';
import { Skeleton } from '@/components/ui/skeleton';

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
            <header className="sticky top-0 z-10 h-16 border-b bg-primary">
              <div className="flex h-full items-center justify-between px-4 md:px-6">
                <div className="flex items-center gap-3">
                  <SidebarTrigger className="text-primary-foreground" />
                  <Skeleton className="h-6 w-32 bg-primary-foreground/20" />
                </div>
                <NotificationBell />
              </div>
            </header>
            <main className="flex-1 p-4 md:p-6 space-y-6">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  if (!restaurant) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <RestaurantSidebar />
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="sticky top-0 z-10 h-16 border-b bg-primary">
            <div className="flex h-full items-center justify-between px-4 md:px-6">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
                <h1 className="text-lg font-bold text-primary-foreground truncate">
                  {restaurant.business_name}
                </h1>
              </div>
              <NotificationBell />
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6 space-y-6 overflow-auto pb-24">
            {/* CTA Principal */}
            <Button
              onClick={() => navigate('/restaurant/new-delivery')}
              size="xl"
              className="w-full gap-3 text-lg shadow-lg"
            >
              <Plus className="h-6 w-6" />
              Nova Entrega
            </Button>

            {/* Saldo */}
            <Card 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/restaurant/wallet')}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Wallet className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Saldo disponível</p>
                    <p className="text-2xl font-bold">R$ {restaurant.wallet_balance.toFixed(2)}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">
                  Adicionar
                </Button>
              </CardContent>
            </Card>

            {/* Entregas Ativas */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Em andamento
                  {activeDeliveries.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {activeDeliveries.length}
                    </Badge>
                  )}
                </h2>
              </div>

              {activeDeliveries.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold mb-2">Nenhuma entrega ativa</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Clique em "Nova Entrega" para solicitar sua primeira entrega
                    </p>
                    <Button onClick={() => navigate('/restaurant/new-delivery')} variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Criar entrega
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {activeDeliveries.map((delivery) => {
                    const status = statusConfig[delivery.status] || statusConfig.pending;
                    return (
                      <Card
                        key={delivery.id}
                        className="cursor-pointer hover:shadow-md transition-all active:scale-[0.99]"
                        onClick={() => navigate(`/restaurant/delivery/${delivery.id}`)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xl">{status.icon}</span>
                                <Badge className={`${status.color} border font-medium`}>
                                  {status.label}
                                </Badge>
                              </div>
                              <p className="font-medium truncate flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                {delivery.delivery_address}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
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
                              <p className="text-xl font-bold text-primary">
                                R$ {(delivery.price_adjusted || delivery.price).toFixed(2)}
                              </p>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="mt-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/restaurant/delivery/${delivery.id}`);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Rastrear
                              </Button>
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
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
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
                        <p className="font-semibold text-green-600">
                          R$ {(delivery.price_adjusted || delivery.price).toFixed(2)}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
