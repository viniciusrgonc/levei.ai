import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { 
  MapPin, 
  Package, 
  Clock, 
  Navigation, 
  Wallet, 
  Star,
  Bike,
  TrendingUp,
  Map as MapIcon
} from 'lucide-react';
import { useNearbyDeliveries } from '@/hooks/useNearbyDeliveries';
import NotificationBell from '@/components/NotificationBell';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { DriverSidebar } from '@/components/DriverSidebar';
import { useRealtimeDeliveries } from '@/hooks/useRealtimeDeliveries';
import { Skeleton } from '@/components/ui/skeleton';

interface Driver {
  id: string;
  is_available: boolean;
  vehicle_type: string;
  license_plate: string;
  rating: number;
  total_deliveries: number;
  earnings_balance: number;
}

// Skeleton loader para o dashboard
function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

// Empty state amigável
function EmptyDeliveries({ onViewMap }: { onViewMap: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
        <Package className="w-10 h-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Nenhuma entrega disponível
      </h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        Fique disponível e aguarde. Novas entregas aparecerão aqui automaticamente.
      </p>
      <Button variant="outline" onClick={onViewMap}>
        <MapIcon className="w-4 h-4 mr-2" />
        Ver Mapa
      </Button>
    </div>
  );
}

// Card de entrega disponível
function DeliveryCard({ 
  delivery, 
  onAccept, 
  accepting 
}: { 
  delivery: any; 
  onAccept: (id: string) => void;
  accepting: boolean;
}) {
  return (
    <Card className="overflow-hidden animate-fade-in">
      <CardContent className="p-0">
        {/* Header com valor destacado */}
        <div className="bg-primary/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-normal">
              <Navigation className="w-3 h-3 mr-1" />
              {Number(delivery.distance_km).toFixed(1)} km
            </Badge>
            <Badge variant="secondary" className="font-normal">
              <Clock className="w-3 h-3 mr-1" />
              ~{Math.ceil(Number(delivery.distance_km) * 3)} min
            </Badge>
          </div>
          <span className="text-xl font-bold text-primary">
            R$ {Number(delivery.price_adjusted || delivery.price).toFixed(2)}
          </span>
        </div>

        {/* Endereços */}
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground">COLETA</p>
              <p className="text-sm text-foreground truncate">{delivery.pickup_address}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground">ENTREGA</p>
              <p className="text-sm text-foreground truncate">{delivery.delivery_address}</p>
            </div>
          </div>
        </div>

        {/* Botão de ação principal */}
        <div className="px-4 pb-4">
          <Button 
            onClick={() => onAccept(delivery.id)}
            disabled={accepting}
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            {accepting ? 'Aceitando...' : 'Aceitar Entrega'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DriverDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [activeDelivery, setActiveDelivery] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [todayEarnings, setTodayEarnings] = useState(0);
  
  const {
    deliveries: availableDeliveries,
    loading: deliveriesLoading,
  } = useNearbyDeliveries({
    driverId: driver?.id || '',
    isAvailable: driver?.is_available || false,
    maxDistanceKm: 20,
  });

  const safeDeliveries = Array.isArray(availableDeliveries) ? availableDeliveries : [];

  // Realtime updates
  useRealtimeDeliveries({
    driverId: driver?.id,
    showNotifications: true,
    onUpdate: () => {
      fetchDriver();
      fetchActiveDelivery();
    },
  });

  useEffect(() => {
    if (user) {
      fetchDriver();
      fetchActiveDelivery();
      fetchTodayEarnings();
    }
  }, [user]);

  // Redirecionar para entrega ativa
  useEffect(() => {
    if (activeDelivery) {
      if (activeDelivery.status === 'accepted') {
        navigate(`/driver/pickup/${activeDelivery.id}`, { replace: true });
      } else if (activeDelivery.status === 'picked_up') {
        navigate(`/driver/delivery/${activeDelivery.id}`, { replace: true });
      }
    }
  }, [activeDelivery, navigate]);

  const fetchDriver = async () => {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .eq('user_id', user?.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        navigate('/driver/setup');
      }
    } else {
      setDriver(data);
    }
    setLoading(false);
  };

  const fetchActiveDelivery = async () => {
    const { data: driverData } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user?.id)
      .single();

    if (driverData) {
      const { data } = await supabase
        .from('deliveries')
        .select('*')
        .eq('driver_id', driverData.id)
        .in('status', ['accepted', 'picked_up'])
        .single();

      setActiveDelivery(data);
    }
  };

  const fetchTodayEarnings = async () => {
    const { data: driverData } = await supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user?.id)
      .single();

    if (driverData) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data } = await supabase
        .from('transactions')
        .select('driver_earnings')
        .eq('driver_id', driverData.id)
        .gte('created_at', today.toISOString());

      if (data) {
        const total = data.reduce((sum, t) => sum + (Number(t.driver_earnings) || 0), 0);
        setTodayEarnings(total);
      }
    }
  };

  const toggleAvailability = async (available: boolean) => {
    if (!driver) return;

    const { error } = await supabase
      .from('drivers')
      .update({ is_available: available })
      .eq('id', driver.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar disponibilidade'
      });
    } else {
      setDriver({ ...driver, is_available: available });
      toast({
        title: available ? '✅ Você está disponível!' : '⏸️ Você está offline',
        description: available ? 'Entregas aparecerão aqui' : 'Você não receberá novas entregas'
      });
    }
  };

  const acceptDelivery = async (deliveryId: string) => {
    if (!driver?.id || accepting) return;

    setAccepting(true);
    try {
      const { data, error } = await supabase.functions.invoke('accept-delivery', {
        body: { delivery_id: deliveryId, driver_id: driver.id }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: '✅ Entrega aceita!',
        description: 'Vá até o ponto de coleta',
      });
      
      navigate(`/driver/pickup/${deliveryId}`, { replace: true });
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível aceitar a entrega',
        variant: 'destructive',
      });
    } finally {
      setAccepting(false);
    }
  };

  // Status atual do entregador
  const getStatusInfo = () => {
    if (activeDelivery) {
      return { label: 'Em entrega', color: 'bg-warning' };
    }
    if (driver?.is_available) {
      return { label: 'Disponível', color: 'bg-success' };
    }
    return { label: 'Offline', color: 'bg-muted-foreground' };
  };

  const status = getStatusInfo();

  if (loading) {
    return (
      <SidebarProvider defaultOpen={false}>
        <div className="min-h-screen flex w-full">
          <DriverSidebar />
          <div className="flex-1 flex flex-col">
            <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-primary">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="text-primary-foreground" />
                <h1 className="text-lg font-bold text-primary-foreground">Levei</h1>
              </div>
              <NotificationBell />
            </header>
            <main className="flex-1 p-4 bg-background">
              <DashboardSkeleton />
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full">
        <DriverSidebar />
        <div className="flex-1 flex flex-col">
          {/* Header compacto */}
          <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-primary safe-top">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-primary-foreground" />
              <div className="flex items-center gap-2">
                <Bike className="w-5 h-5 text-primary-foreground" />
                <h1 className="text-lg font-bold text-primary-foreground">Levei</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${status.color}`} />
              <span className="text-xs text-primary-foreground/80">{status.label}</span>
              <NotificationBell />
            </div>
          </header>

          <main className="flex-1 p-4 bg-background overflow-auto safe-bottom">
            <div className="max-w-lg mx-auto space-y-4">
              
              {/* KPIs - Ganhos e Entregas */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="kpi-card" onClick={() => navigate('/driver/wallet')}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-success" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      R$ {todayEarnings.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">Ganhos hoje</p>
                  </CardContent>
                </Card>

                <Card className="kpi-card" onClick={() => navigate('/driver/history')}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Package className="w-4 h-4 text-primary" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {driver?.total_deliveries || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Entregas totais</p>
                  </CardContent>
                </Card>
              </div>

              {/* Toggle de disponibilidade - Grande e claro */}
              <Card className={`transition-all ${driver?.is_available ? 'border-success/50 bg-success/5' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${driver?.is_available ? 'bg-success' : 'bg-muted'}`}>
                        <Bike className={`w-5 h-5 ${driver?.is_available ? 'text-white' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">
                          {driver?.is_available ? 'Você está disponível' : 'Você está offline'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {driver?.is_available ? 'Recebendo entregas' : 'Ative para receber entregas'}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={driver?.is_available || false}
                      onCheckedChange={toggleAvailability}
                      className="scale-125"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Avaliação e veículo */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-warning fill-warning" />
                  <span className="text-sm font-medium">{driver?.rating ? Number(driver.rating).toFixed(1) : '—'}</span>
                </div>
                <Badge variant="secondary">
                  {driver?.vehicle_type === 'motorcycle' ? 'Moto' : 
                   driver?.vehicle_type === 'bicycle' ? 'Bicicleta' :
                   driver?.vehicle_type === 'car' ? 'Carro' :
                   driver?.vehicle_type === 'van' ? 'Van' : driver?.vehicle_type}
                </Badge>
              </div>

              {/* Entregas disponíveis ou empty state */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="font-semibold text-foreground">Entregas Disponíveis</h2>
                  {safeDeliveries.length > 0 && (
                    <Badge variant="default">{safeDeliveries.length}</Badge>
                  )}
                </div>

                {!driver?.is_available ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <p className="text-muted-foreground">
                        Ative sua disponibilidade para ver entregas
                      </p>
                    </CardContent>
                  </Card>
                ) : deliveriesLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-40 rounded-xl" />
                    <Skeleton className="h-40 rounded-xl" />
                  </div>
                ) : safeDeliveries.length === 0 ? (
                  <Card>
                    <EmptyDeliveries onViewMap={() => navigate('/driver/map')} />
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {safeDeliveries.map((delivery) => (
                      <DeliveryCard
                        key={delivery.id}
                        delivery={delivery}
                        onAccept={acceptDelivery}
                        accepting={accepting}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Acesso rápido ao mapa */}
              {driver?.is_available && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => navigate('/driver/map')}
                >
                  <MapIcon className="w-4 h-4 mr-2" />
                  Ver entregas no mapa
                </Button>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}