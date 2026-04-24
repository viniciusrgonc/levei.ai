import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Package, DollarSign, Clock, Calendar, Eye, Search, Star } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { RestaurantSidebar } from '@/components/RestaurantSidebar';
import NotificationBell from '@/components/NotificationBell';
import { RatingModal } from '@/components/RatingModal';
import { BottomNav } from '@/components/BottomNav';

type Delivery = {
  id: string;
  pickup_address: string;
  delivery_address: string;
  status: string;
  price: number;
  distance_km: number;
  created_at: string;
  delivered_at: string | null;
  description: string | null;
  driver_id: string | null;
};

export default function RestaurantHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [filteredDeliveries, setFilteredDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [ratingModalData, setRatingModalData] = useState<{
    deliveryId: string;
    driverUserId: string;
    driverName: string;
  } | null>(null);
  const [ratedDeliveryIds, setRatedDeliveryIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchDeliveries();
  }, [user]);

  useEffect(() => {
    filterDeliveries();
  }, [searchTerm, statusFilter, deliveries]);

  // Load already-rated delivery ids
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
  }, [user?.id, deliveries]);

  const openRatingForDelivery = async (deliveryId: string, driverId: string) => {
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

  const fetchDeliveries = async () => {
    if (!user) return;

    const { data: restaurantData } = await supabase
      .from('restaurants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!restaurantData) {
      navigate('/restaurant/setup');
      return;
    }

    const { data, error } = await supabase
      .from('deliveries')
      .select('*')
      .eq('restaurant_id', restaurantData.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar o histórico'
      });
    } else {
      setDeliveries(data || []);
      setFilteredDeliveries(data || []);
    }

    setLoading(false);
  };

  const filterDeliveries = () => {
    let filtered = deliveries;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(d => d.status === statusFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(d => 
        d.delivery_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.pickup_address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredDeliveries(filtered);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { label: 'Disponível', variant: 'secondary' as const, color: 'bg-muted text-muted-foreground' },
      accepted: { label: 'Coleta em Andamento', variant: 'default' as const, color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
      picked_up: { label: 'Entrega em Andamento', variant: 'default' as const, color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
      delivered: { label: 'Entregue', variant: 'default' as const, color: 'bg-green-500/10 text-green-600 border-green-500/20' },
      cancelled: { label: 'Cancelada', variant: 'destructive' as const, color: '' },
    };
    const config = variants[status as keyof typeof variants] || { label: status, variant: 'secondary' as const, color: '' };
    return <Badge variant={config.variant} className={config.color}>{config.label}</Badge>;
  };

  const getStats = () => {
    const total = deliveries.length;
    const delivered = deliveries.filter(d => d.status === 'delivered').length;
    const totalSpent = deliveries
      .filter(d => d.status === 'delivered')
      .reduce((sum, d) => sum + Number(d.price), 0);

    return { total, delivered, totalSpent };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <RestaurantSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b flex items-center justify-between px-4 bg-background">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <h1 className="font-semibold">Histórico de Entregas</h1>
            </div>
            <NotificationBell />
          </header>

          <main className="flex-1 p-6 bg-gradient-to-br from-background via-background to-primary/5">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total de Entregas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.total}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Entregues</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.delivered}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">R$ {stats.totalSpent.toFixed(2)}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Filters */}
              <Card>
                <CardHeader>
                  <CardTitle>Filtros</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por endereço..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-[200px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Status</SelectItem>
                      <SelectItem value="pending">Disponível</SelectItem>
                      <SelectItem value="accepted">Coleta em Andamento</SelectItem>
                      <SelectItem value="picked_up">Entrega em Andamento</SelectItem>
                      <SelectItem value="delivered">Entregue</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Deliveries List */}
              <Card>
                <CardHeader>
                  <CardTitle>Entregas ({filteredDeliveries.length})</CardTitle>
                  <CardDescription>Histórico completo de todas as suas entregas</CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredDeliveries.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhuma entrega encontrada
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredDeliveries.map((delivery, index) => (
                        <Card 
                          key={delivery.id}
                          className="animate-fade-in hover:shadow-lg transition-all duration-300 hover:scale-[1.01]"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <CardContent className="pt-6">
                            <div className="flex flex-col md:flex-row justify-between gap-4">
                              <div className="space-y-3 flex-1">
                                <div className="flex items-start gap-2">
                                  <Package className="h-4 w-4 text-primary mt-1 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm">Coleta</p>
                                    <p className="text-sm text-muted-foreground break-words">
                                      {delivery.pickup_address}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-2">
                                  <MapPin className="h-4 w-4 text-primary mt-1 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm">Entrega</p>
                                    <p className="text-sm text-muted-foreground break-words">
                                      {delivery.delivery_address}
                                    </p>
                                  </div>
                                </div>
                                {delivery.description && (
                                  <p className="text-sm text-muted-foreground">{delivery.description}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(delivery.created_at).toLocaleDateString('pt-BR')}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(delivery.created_at).toLocaleTimeString('pt-BR', { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                {getStatusBadge(delivery.status)}
                                <div className="text-right">
                                  <div className="text-lg font-bold text-primary">
                                    R$ {Number(delivery.price).toFixed(2)}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {Number(delivery.distance_km).toFixed(1)} km
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/restaurant/delivery/${delivery.id}`)}
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  Ver Detalhes
                                </Button>
                                {delivery.status === 'delivered' && delivery.driver_id && !ratedDeliveryIds.has(delivery.id) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openRatingForDelivery(delivery.id, delivery.driver_id!)}
                                  >
                                    <Star className="mr-2 h-4 w-4" />
                                    Avaliar
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>

      <BottomNav />

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
