import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, Plus, Package, Clock, DollarSign, Star, MapPin } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import NotificationBell from '@/components/NotificationBell';

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
  const { user, signOut } = useAuth();
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
        // No restaurant found, redirect to setup
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
      console.error('Error fetching deliveries:', error);
      return;
    }

    setDeliveries(data || []);

    // Calculate stats
    const active = data?.filter(d => 
      ['pending', 'accepted', 'picking_up', 'picked_up', 'delivering'].includes(d.status)
    ).length || 0;

    const todayDeliveries = data?.filter(d => 
      new Date(d.created_at) >= today
    ) || [];

    const todayCount = todayDeliveries.length;
    const todaySpent = todayDeliveries.reduce((sum, d) => sum + parseFloat(d.price.toString()), 0);

    setStats({ active, today: todayCount, todaySpent });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
      pending: { label: 'Aguardando', variant: 'outline' },
      accepted: { label: 'Aceito', variant: 'secondary' },
      picking_up: { label: 'Indo Buscar', variant: 'secondary' },
      picked_up: { label: 'Coletado', variant: 'default' },
      delivering: { label: 'Em Entrega', variant: 'default' },
      delivered: { label: 'Entregue', variant: 'default' },
      cancelled: { label: 'Cancelado', variant: 'destructive' }
    };

    const statusInfo = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">{restaurant.business_name}</h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                  <span>{restaurant.rating.toFixed(1)}</span>
                </div>
                <span>•</span>
                <span>{restaurant.total_deliveries} entregas</span>
              </div>
            </div>
            <div className="flex gap-2">
              <NotificationBell />
              <Button onClick={() => navigate('/restaurant/new-delivery')}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Entrega
              </Button>
              <Button variant="ghost" onClick={handleSignOut}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Entregas Ativas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Package className="w-8 h-8 text-primary" />
                <span className="text-3xl font-bold">{stats.active}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Entregas Hoje</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="w-8 h-8 text-primary" />
                <span className="text-3xl font-bold">{stats.today}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Gasto Hoje</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="w-8 h-8 text-primary" />
                <span className="text-3xl font-bold">R$ {stats.todaySpent.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Avaliação</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Star className="w-8 h-8 text-yellow-500" />
                <span className="text-3xl font-bold">{restaurant.rating.toFixed(1)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Deliveries */}
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
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  Nenhuma entrega ainda
                </p>
                <Button onClick={() => navigate('/restaurant/new-delivery')}>
                  <Plus className="w-4 h-4 mr-2" />
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
                      <MapPin className="w-5 h-5 text-muted-foreground mt-1" />
                      <div className="flex-1">
                        <p className="font-medium">{delivery.delivery_address}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(delivery.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold">R$ {parseFloat(delivery.price.toString()).toFixed(2)}</p>
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
    </div>
  );
}