import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Package, Clock, DollarSign, Star, MapPin } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import NotificationBell from '@/components/NotificationBell';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { RestaurantSidebar } from '@/components/RestaurantSidebar';

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
};

export default function RestaurantDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [stats, setStats] = useState({
    active: 0,
    today: 0,
    todaySpent: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRestaurantData();
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
          filter: `restaurant_id=eq.${restaurant?.id}`
        },
        () => {
          fetchDeliveries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, restaurant?.id]);

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
    if (!user || !restaurant) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('deliveries')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar as entregas'
      });
      return;
    }

    setDeliveries(data || []);

    // Calculate stats
    const active = data?.filter(d => ['pending', 'accepted', 'picked_up'].includes(d.status)).length || 0;
    const todayDeliveries = data?.filter(d => new Date(d.created_at) >= today) || [];
    const todayCount = todayDeliveries.length;
    const todaySpent = todayDeliveries.reduce((sum, d) => sum + Number(d.price), 0);

    setStats({ active, today: todayCount, todaySpent });
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { label: 'Pendente', variant: 'secondary' as const },
      accepted: { label: 'Aceita', variant: 'default' as const },
      picked_up: { label: 'Coletada', variant: 'default' as const },
      delivered: { label: 'Entregue', variant: 'default' as const },
      cancelled: { label: 'Cancelada', variant: 'destructive' as const },
    };
    const config = variants[status as keyof typeof variants] || { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
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
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full">
        <RestaurantSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-primary">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
              <div>
                <h1 className="text-xl font-bold text-primary-foreground">Movvi</h1>
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
              <Button 
                onClick={() => navigate('/restaurant/new-delivery')}
                variant="secondary"
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Entrega
              </Button>
              <NotificationBell />
            </div>
          </header>

          <main className="flex-1 p-6 bg-background overflow-auto">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Entregas Ativas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Package className="h-8 w-8 text-primary" />
                      <span className="text-3xl font-bold">{stats.active}</span>
                    </div>
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
                  </CardContent>
                </Card>
              </div>

              {/* Recent Deliveries */}
              <Card>
                <CardHeader>
                  <CardTitle>Entregas Recentes</CardTitle>
                  <CardDescription>
                    Suas últimas solicitações de entrega
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {deliveries.length === 0 ? (
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
                    <div className="space-y-4">
                      {deliveries.map((delivery) => (
                        <div
                          key={delivery.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                          onClick={() => navigate(`/restaurant/delivery/${delivery.id}`)}
                        >
                          <div className="flex items-start gap-4 flex-1">
                            <MapPin className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{delivery.delivery_address}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(delivery.created_at).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 shrink-0">
                            <div className="text-right">
                              <p className="font-bold">R$ {Number(delivery.price).toFixed(2)}</p>
                              {getStatusBadge(delivery.status)}
                            </div>
                          </div>
                        </div>
                      ))}
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
