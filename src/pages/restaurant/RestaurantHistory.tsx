import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Package, DollarSign, Clock, Calendar, Eye, Search, Star, Loader2 } from 'lucide-react';
import { getStatusConfig } from '@/lib/deliveryStatus';
import { toast } from '@/hooks/use-toast';
import NotificationBell from '@/components/NotificationBell';
import { RatingModal } from '@/components/RatingModal';
import { BottomNav } from '@/components/BottomNav';

const PAGE_SIZE = 20;

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

  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // KPI stats fetched separately (all-time)
  const [stats, setStats] = useState({ total: 0, delivered: 0, totalSpent: 0 });

  const [ratingModalData, setRatingModalData] = useState<{
    deliveryId: string;
    driverUserId: string;
    driverName: string;
  } | null>(null);
  const [ratedDeliveryIds, setRatedDeliveryIds] = useState<Set<string>>(new Set());

  // ── bootstrap: resolve restaurantId ─────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase
      .from('restaurants')
      .select('id')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (!data) { navigate('/restaurant/setup'); return; }
        setRestaurantId(data.id);
      });
  }, [user]);

  // ── fetch KPIs (all-time, not paginated) ────────────────────────
  useEffect(() => {
    if (!restaurantId) return;
    supabase
      .from('deliveries')
      .select('status, price')
      .eq('restaurant_id', restaurantId)
      .then(({ data }) => {
        if (!data) return;
        const delivered = data.filter((d) => d.status === 'delivered');
        setStats({
          total: data.length,
          delivered: delivered.length,
          totalSpent: delivered.reduce((s, d) => s + Number(d.price), 0),
        });
      });
  }, [restaurantId]);

  // ── fetch page ───────────────────────────────────────────────────
  const fetchPage = useCallback(async (pageIndex: number, reset = false) => {
    if (!restaurantId) return;
    pageIndex === 0 ? setLoading(true) : setLoadingMore(true);

    const from = pageIndex * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    let query = supabase
      .from('deliveries')
      .select('id, pickup_address, delivery_address, status, price, distance_km, created_at, delivered_at, description, driver_id')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .range(from, to);

    // Apply server-side status filter when not text-searching
    if (statusFilter !== 'all' && !searchTerm) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar o histórico' });
    } else {
      const rows = (data ?? []) as Delivery[];
      setDeliveries((prev) => (reset ? rows : [...prev, ...rows]));
      setHasMore(rows.length === PAGE_SIZE);
      setPage(pageIndex);
    }

    pageIndex === 0 ? setLoading(false) : setLoadingMore(false);
  }, [restaurantId, statusFilter, searchTerm]);

  // Reset on filter/search change
  useEffect(() => {
    if (!restaurantId) return;
    fetchPage(0, true);
  }, [restaurantId, statusFilter, searchTerm]);

  // ── load rated delivery ids ──────────────────────────────────────
  useEffect(() => {
    const ids = deliveries
      .filter((d) => d.status === 'delivered' && d.driver_id)
      .map((d) => d.id);
    if (!user || ids.length === 0) return;
    supabase
      .from('ratings')
      .select('delivery_id')
      .eq('rated_by', user.id)
      .in('delivery_id', ids)
      .then(({ data }) => {
        if (data) setRatedDeliveryIds(new Set(data.map((r) => r.delivery_id)));
      });
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

  // ── client-side filter (search term only; status is server-side) ─
  const filteredDeliveries = deliveries.filter((d) => {
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    const matchSearch = !searchTerm ||
      d.delivery_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.pickup_address.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  const getStatusBadge = (status: string) => {
    const cfg = getStatusConfig(status);
    return <Badge variant={cfg.variant} className={cfg.badge}>{cfg.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
          <header className="border-b flex items-center justify-between px-4 bg-background"
            style={{ minHeight: 56, paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="flex items-center gap-2">
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
                      <SelectItem value="pending">Aguardando entregador</SelectItem>
                      <SelectItem value="accepted">Coleta em Andamento</SelectItem>
                      <SelectItem value="picked_up">Em Rota de Entrega</SelectItem>
                      <SelectItem value="delivered">Entregue</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              {/* Deliveries List */}
              <Card>
                <CardHeader>
                  <CardTitle>Entregas ({filteredDeliveries.length}{hasMore ? '+' : ''})</CardTitle>
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

                      {/* Load more */}
                      {hasMore && (
                        <div className="flex justify-center pt-2">
                          <Button
                            variant="outline"
                            onClick={() => fetchPage(page + 1)}
                            disabled={loadingMore}
                          >
                            {loadingMore ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Carregando...
                              </>
                            ) : (
                              'Carregar mais entregas'
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
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
    </div>
  );
}
