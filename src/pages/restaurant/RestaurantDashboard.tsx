import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Package, Clock, DollarSign, Star, MapPin, TrendingUp, Navigation, RefreshCw, Eye } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import NotificationBell from '@/components/NotificationBell';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { RestaurantSidebar } from '@/components/RestaurantSidebar';
import { Separator } from '@/components/ui/separator';
import { useRealtimeDeliveries } from '@/hooks/useRealtimeDeliveries';

type Restaurant = {
  id: string;
  business_name: string;
  rating: number;
  total_deliveries: number;
};

type Delivery = {
  id: string;
  delivery_address: string;
  status: string;
  price: number;
  created_at: string;
  driver_id: string | null;
  distance_km: number;
  accepted_at: string | null;
  picked_up_at: string | null;
  driver_name?: string;
};

export default function RestaurantDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [activeDeliveries, setActiveDeliveries] = useState<Delivery[]>([]);
  const [recentDeliveries, setRecentDeliveries] = useState<Delivery[]>([]);
  const [stats, setStats] = useState({
    active: 0,
    today: 0,
    todaySpent: 0
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Hook de realtime para escutar mudanças nas entregas
  useRealtimeDeliveries({
    restaurantId: restaurant?.id,
    showNotifications: true,
    onUpdate: (delivery) => {
      console.log('Delivery updated in realtime:', delivery);
      // Recarregar dados quando houver atualização
      fetchRestaurantData();
    },
    onInsert: (delivery) => {
      console.log('New delivery inserted:', delivery);
      fetchRestaurantData();
    },
  });

  useEffect(() => {
    fetchRestaurantData();
  }, [user]);

  useEffect(() => {
    if (!restaurant) return;
    
    fetchDeliveries();

    // Subscribe to realtime delivery updates
    const channel = supabase
      .channel('restaurant-deliveries')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
          filter: `restaurant_id=eq.${restaurant.id}`
        },
        () => {
          setLastUpdate(new Date());
          fetchDeliveries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant?.id]);

  const fetchRestaurantData = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        navigate('/restaurant/setup');
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro',
          description: 'Não foi possível carregar os dados'
        });
      }
      setLoading(false);
      return;
    }

    setRestaurant(data);
    setLoading(false);
  };

  const fetchDeliveries = async () => {
    if (!restaurant) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch all deliveries
    const { data, error } = await supabase
      .from('deliveries')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar as entregas'
      });
      return;
    }

    // Fetch driver names for deliveries with assigned drivers
    const deliveriesWithDriverNames = await Promise.all(
      (data || []).map(async (delivery) => {
        if (delivery.driver_id) {
          const { data: driverData } = await supabase
            .from('drivers')
            .select('user_id')
            .eq('id', delivery.driver_id)
            .single();
          
          if (driverData?.user_id) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', driverData.user_id)
              .single();
            
            return {
              ...delivery,
              driver_name: profileData?.full_name || 'Motorista'
            };
          }
        }
        return delivery;
      })
    );

    // Split active and recent
    const active = deliveriesWithDriverNames?.filter(d => ['pending', 'accepted', 'picked_up'].includes(d.status)) || [];
    const recent = deliveriesWithDriverNames?.slice(0, 5) || [];

    setActiveDeliveries(active);
    setRecentDeliveries(recent);

    // Calculate stats
    const todayDeliveries = deliveriesWithDriverNames?.filter(d => new Date(d.created_at) >= today) || [];
    const todayCount = todayDeliveries.length;
    const todaySpent = todayDeliveries.reduce((sum, d) => sum + Number(d.price), 0);

    setStats({ active: active.length, today: todayCount, todaySpent });
  };

  const markAsPickedUp = async (deliveryId: string) => {
    const { error } = await supabase
      .from('deliveries')
      .update({
        status: 'picked_up',
        picked_up_at: new Date().toISOString()
      })
      .eq('id', deliveryId);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível confirmar a coleta'
      });
    } else {
      toast({
        title: 'Coleta confirmada!',
        description: 'O pedido foi marcado como coletado'
      });
      fetchDeliveries();
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { label: 'Pendente', variant: 'secondary' as const, color: 'text-yellow-600' },
      accepted: { label: 'Aceita', variant: 'default' as const, color: 'text-blue-600' },
      picked_up: { label: 'Coletada', variant: 'default' as const, color: 'text-purple-600' },
      delivered: { label: 'Entregue', variant: 'default' as const, color: 'text-green-600' },
      cancelled: { label: 'Cancelada', variant: 'destructive' as const, color: 'text-red-600' },
    };
    const config = variants[status as keyof typeof variants] || { label: status, variant: 'secondary' as const, color: '' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      pending: '🕐',
      accepted: '✅',
      picked_up: '📦',
      delivered: '✨',
      cancelled: '❌',
    };
    return icons[status as keyof typeof icons] || '❓';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!restaurant) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <RestaurantSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 h-16 border-b bg-primary backdrop-blur supports-[backdrop-filter]:bg-primary/95">
            <div className="flex h-full items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
                <div>
                  <h1 className="text-xl font-bold text-primary-foreground">
                    {restaurant.business_name}
                  </h1>
                  <div className="flex items-center gap-2 text-sm text-primary-foreground/80">
                    <div className="flex items-center">
                      <Star className="h-3 w-3 fill-primary-foreground text-primary-foreground mr-1" />
                      {Number(restaurant.rating || 0).toFixed(1)}
                    </div>
                    <span>•</span>
                    <span>{restaurant.total_deliveries || 0} entregas</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-xs text-primary-foreground/60">
                  Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
                </div>
                <Button 
                  onClick={() => navigate('/restaurant/new-delivery')}
                  variant="secondary"
                  size="sm"
                  className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Entrega
                </Button>
                <NotificationBell />
              </div>
            </div>
          </header>

          <main className="flex-1 p-6 bg-background overflow-auto">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-2 hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center justify-between">
                      <span>Entregas Ativas</span>
                      <Navigation className="h-4 w-4 text-primary animate-pulse" />
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Package className="h-8 w-8 text-primary" />
                      <span className="text-3xl font-bold">{stats.active}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Em andamento
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Entregas Hoje</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Clock className="h-8 w-8 text-primary" />
                      <span className="text-3xl font-bold">{stats.today}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Solicitações
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Gasto Hoje</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-8 w-8 text-primary" />
                      <span className="text-3xl font-bold">R$ {stats.todaySpent.toFixed(2)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Total investido
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Avaliação</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
                      <span className="text-3xl font-bold">{Number(restaurant.rating || 0).toFixed(1)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Média geral
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Active Deliveries */}
              {activeDeliveries.length > 0 && (
                <Card className="border-2 border-primary/20">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Navigation className="h-5 w-5 text-primary animate-pulse" />
                          Entregas Ativas ({activeDeliveries.length})
                        </CardTitle>
                        <CardDescription className="mt-2">
                          Acompanhe em tempo real
                        </CardDescription>
                      </div>
                      <RefreshCw 
                        className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-primary transition-colors" 
                        onClick={fetchDeliveries}
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {activeDeliveries.map((delivery) => (
                        <div
                          key={delivery.id}
                          className="p-4 border-2 rounded-lg hover:border-primary/50 transition-all cursor-pointer bg-gradient-to-r from-background to-primary/5"
                          onClick={() => navigate(`/restaurant/delivery/${delivery.id}`)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="text-2xl flex-shrink-0">
                                {getStatusIcon(delivery.status)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {getStatusBadge(delivery.status)}
                                  <span className="text-xs text-muted-foreground">
                                    #{delivery.id.slice(0, 8)}
                                  </span>
                                </div>
                                <p className="font-medium truncate flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  {delivery.delivery_address}
                                </p>
                                 <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                   <span>{delivery.distance_km.toFixed(1)} km</span>
                                   <span>•</span>
                                   <span>
                                     {new Date(delivery.created_at).toLocaleTimeString('pt-BR', {
                                       hour: '2-digit',
                                       minute: '2-digit'
                                     })}
                                   </span>
                                 </div>
                                 {delivery.driver_name && (
                                   <div className="flex items-center gap-2 mt-2 text-sm font-medium text-primary">
                                     <Navigation className="h-4 w-4" />
                                     Coleta será realizada por: {delivery.driver_name}
                                   </div>
                                 )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xl font-bold text-primary">
                                R$ {Number(delivery.price).toFixed(2)}
                              </p>
                              <div className="flex flex-col gap-2 mt-2">
                                {delivery.status === 'accepted' && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markAsPickedUp(delivery.id);
                                    }}
                                  >
                                    <Package className="h-3 w-3 mr-1" />
                                    Coletado
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/restaurant/delivery/${delivery.id}`);
                                  }}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Rastrear
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Deliveries */}
              <Card>
                <CardHeader>
                  <CardTitle>Entregas Recentes</CardTitle>
                  <CardDescription>
                    Histórico das últimas solicitações
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {recentDeliveries.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">
                        Nenhuma entrega ainda
                      </p>
                      <Button onClick={() => navigate('/restaurant/new-delivery')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Criar Primeira Entrega
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentDeliveries.map((delivery) => (
                        <div
                          key={delivery.id}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                          onClick={() => navigate(`/restaurant/delivery/${delivery.id}`)}
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{delivery.delivery_address}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(delivery.created_at).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-right">
                              <p className="font-bold">R$ {Number(delivery.price).toFixed(2)}</p>
                              {getStatusBadge(delivery.status)}
                            </div>
                          </div>
                        </div>
                      ))}
                      {recentDeliveries.length >= 5 && (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => navigate('/restaurant/history')}
                        >
                          Ver Todas as Entregas
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
