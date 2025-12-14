import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { MapPin, Package, Clock, Navigation } from 'lucide-react';
import { useNearbyDeliveries } from '@/hooks/useNearbyDeliveries';
import NotificationBell from '@/components/NotificationBell';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { DriverSidebar } from '@/components/DriverSidebar';
import { useRealtimeDeliveries } from '@/hooks/useRealtimeDeliveries';
import { DriverDashboardSkeleton, DeliveryListSkeleton } from '@/components/skeletons';
interface Driver {
  id: string;
  is_available: boolean;
  vehicle_type: string;
  license_plate: string;
  rating: number;
  total_deliveries: number;
}

interface Delivery {
  id: string;
  pickup_address: string;
  delivery_address: string;
  distance_km: number;
  price: number;
  description: string | null;
  created_at: string;
  distanceFromDriver?: number;
}

export default function DriverDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [activeDelivery, setActiveDelivery] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const {
    deliveries: availableDeliveries,
    loading: deliveriesLoading,
  } = useNearbyDeliveries({
    driverId: driver?.id || '',
    isAvailable: driver?.is_available || false,
    maxDistanceKm: 20,
  });

  // Safety check to ensure deliveries is always an array
  const safeDeliveries = Array.isArray(availableDeliveries) ? availableDeliveries : [];

  // Debug log
  useEffect(() => {
    console.log('📊 Dashboard Debug:', {
      driverId: driver?.id,
      isAvailable: driver?.is_available,
      vehicleType: driver?.vehicle_type,
      availableDeliveriesCount: safeDeliveries.length,
      deliveriesIsArray: Array.isArray(safeDeliveries),
      deliveries: safeDeliveries
    });
  }, [driver, safeDeliveries]);

  // Hook de realtime para escutar mudanças nas entregas
  useRealtimeDeliveries({
    driverId: driver?.id,
    showNotifications: true,
    onUpdate: (delivery) => {
      console.log('Delivery updated in realtime:', delivery);
      // Recarregar dados quando houver atualização
      fetchDriver();
      fetchActiveDelivery();
    },
  });

  useEffect(() => {
    if (user) {
      fetchDriver();
      fetchActiveDelivery();
    }
  }, [user]);

  // Redirect to appropriate page if has active delivery
  useEffect(() => {
    if (activeDelivery) {
      if (activeDelivery.status === 'accepted') {
        navigate(`/driver/pickup/${activeDelivery.id}`);
      } else if (activeDelivery.status === 'picked_up') {
        navigate(`/driver/delivery/${activeDelivery.id}`);
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
        title: available ? 'Você está disponível!' : 'Você está indisponível',
        description: available ? 'Agora você pode receber entregas' : 'Você não receberá novas entregas'
      });
    }
  };

  const acceptDelivery = async (deliveryId: string) => {
    if (!driver?.id) {
      console.error('acceptDelivery: driver.id is undefined');
      return;
    }

    console.log('acceptDelivery called:', { deliveryId, driverId: driver.id });

    try {
      const { data, error } = await supabase.functions.invoke('accept-delivery', {
        body: {
          delivery_id: deliveryId,
          driver_id: driver.id
        }
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: '✅ Entrega aceita!',
        description: 'Indo para a tela de coleta',
      });
      
      // Navigate to pickup page
      navigate(`/driver/pickup/${deliveryId}`);
    } catch (error) {
      console.error('Error accepting delivery:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Não foi possível aceitar a entrega',
        variant: 'destructive',
      });
    }
  };

  const completeDelivery = async () => {
    // Not used - delivery completion happens in DeliveryInProgress page
  };

  if (loading) {
    return (
      <SidebarProvider defaultOpen={false}>
        <div className="min-h-screen flex w-full">
          <DriverSidebar />
          <div className="flex-1 flex flex-col">
            <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-primary">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
                <h1 className="text-xl font-bold text-primary-foreground">Levei</h1>
              </div>
              <NotificationBell />
            </header>
            <main className="flex-1 p-6 bg-background overflow-auto">
              <div className="max-w-7xl mx-auto">
                <DriverDashboardSkeleton />
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  // Active delivery redirect is handled in useEffect above

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full">
        <DriverSidebar />
        <div className="flex-1 flex flex-col">
            <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-primary">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
                <h1 className="text-xl font-bold text-primary-foreground">Levei</h1>
              </div>
              <NotificationBell />
            </header>

          <main className="flex-1 p-6 bg-background overflow-auto">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="availability">Disponível</Label>
                      <Switch
                        id="availability"
                        checked={driver?.is_available || false}
                        onCheckedChange={toggleAvailability}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Avaliação</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {driver?.rating ? `⭐ ${Number(driver.rating).toFixed(1)}` : '—'}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Entregas Realizadas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{driver?.total_deliveries || 0}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Available Deliveries */}
              <Card>
                <CardHeader>
                  <CardTitle>Entregas Disponíveis</CardTitle>
                  <CardDescription>
                    {driver?.is_available
                      ? 'Aceite uma entrega para começar'
                      : 'Ative sua disponibilidade para ver entregas'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!driver?.is_available ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Ative sua disponibilidade para ver entregas disponíveis
                    </div>
                   ) : deliveriesLoading ? (
                    <DeliveryListSkeleton count={2} />
                   ) : safeDeliveries.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground font-medium mb-2">Nenhuma entrega disponível no momento</p>
                      <p className="text-xs text-muted-foreground">Novas entregas aparecerão aqui automaticamente</p>
                      <Button 
                        onClick={() => navigate('/driver/map')} 
                        variant="outline" 
                        className="mt-4"
                      >
                        Ver Mapa de Entregas
                      </Button>
                    </div>
                   ) : (
                     <div className="space-y-4">
                       {safeDeliveries.map((delivery, index) => (
                        <Card 
                          key={delivery.id}
                          className="animate-fade-in hover:shadow-lg transition-all duration-300 hover:scale-[1.01]"
                          style={{ animationDelay: `${index * 100}ms` }}
                        >
                          <CardContent className="pt-6">
                            <div className="flex justify-between items-start mb-4">
                              <div className="space-y-3 flex-1">
                                <div className="flex items-start gap-2">
                                  <Package className="h-4 w-4 text-primary mt-1 shrink-0" />
                                  <div>
                                    <p className="font-medium text-sm">Coleta</p>
                                    <p className="text-sm text-muted-foreground">{delivery.pickup_address}</p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-2">
                                  <MapPin className="h-4 w-4 text-primary mt-1 shrink-0" />
                                  <div>
                                    <p className="font-medium text-sm">Entrega</p>
                                    <p className="text-sm text-muted-foreground">{delivery.delivery_address}</p>
                                  </div>
                                </div>
                                {delivery.distanceFromDriver && (
                                  <Badge variant="secondary" className="animate-scale-in">
                                    <Navigation className="h-3 w-3 mr-1" />
                                    {delivery.distanceFromDriver.toFixed(1)} km de você
                                  </Badge>
                                )}
                                {delivery.description && (
                                  <p className="text-sm text-muted-foreground italic">{delivery.description}</p>
                                )}
                              </div>
                              <div className="text-right shrink-0 ml-4">
                                <div className="text-2xl font-bold text-primary animate-pulse">
                                  R$ {Number(delivery.price).toFixed(2)}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {Number(delivery.distance_km).toFixed(1)} km
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-4 border-t">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                {new Date(delivery.created_at).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                              <Button 
                                onClick={() => acceptDelivery(delivery.id)}
                                className="transition-all duration-300 hover:scale-110 active:scale-95"
                              >
                                Aceitar Coleta
                              </Button>
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
    </SidebarProvider>
  );
}
