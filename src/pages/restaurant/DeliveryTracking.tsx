import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, User, Phone, Star, Package, Navigation, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useRealtimeDriverLocation } from '@/hooks/useRealtimeDriverLocation';
import DeliveryMap from '@/components/DeliveryMap';
import { SidebarProvider } from '@/components/ui/sidebar';
import { RestaurantSidebar } from '@/components/RestaurantSidebar';
import NotificationBell from '@/components/NotificationBell';
import { Separator } from '@/components/ui/separator';

type Delivery = {
  id: string;
  pickup_address: string;
  delivery_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  delivery_latitude: number;
  delivery_longitude: number;
  description: string | null;
  distance_km: number;
  price: number;
  status: string;
  created_at: string;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  driver_id: string | null;
};

type Driver = {
  id: string;
  user_id: string;
  vehicle_type: string;
  license_plate: string;
  rating: number;
  profiles: {
    full_name: string;
    phone: string | null;
  };
};

export default function DeliveryTracking() {
  const { deliveryId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Real-time driver location tracking
  const { currentLocation, locationHistory, isLoading: locationLoading } = 
    useRealtimeDriverLocation(deliveryId || '');

  useEffect(() => {
    if (!deliveryId) return;
    
    fetchDelivery();

    // Subscribe to delivery updates
    const deliveryChannel = supabase
      .channel(`delivery-${deliveryId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries',
          filter: `id=eq.${deliveryId}`
        },
        (payload) => {
          setDelivery(payload.new as Delivery);
          setLastUpdate(new Date());
          if (payload.new.driver_id && !driver) {
            fetchDriver(payload.new.driver_id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(deliveryChannel);
    };
  }, [deliveryId]);

  const fetchDelivery = async () => {
    if (!deliveryId) return;

    const { data, error } = await supabase
      .from('deliveries')
      .select('*')
      .eq('id', deliveryId)
      .single();

    if (error || !data) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Entrega não encontrada'
      });
      navigate('/restaurant/dashboard');
      return;
    }

    setDelivery(data);

    if (data.driver_id) {
      fetchDriver(data.driver_id);
    }

    setLoading(false);
  };

  const fetchDriver = async (driverId: string) => {
    const { data, error } = await supabase
      .from('drivers')
      .select(`
        *,
        profiles:user_id (
          full_name,
          phone
        )
      `)
      .eq('id', driverId)
      .single();

    if (!error && data) {
      setDriver(data as any);
    }
  };

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; icon: string; color: string }> = {
      pending: { label: 'Aguardando Motorista', icon: '🕐', color: 'text-yellow-500' },
      accepted: { label: 'Aceito - Indo Buscar', icon: '✅', color: 'text-blue-500' },
      picked_up: { label: 'Pedido Coletado', icon: '📦', color: 'text-purple-500' },
      delivered: { label: 'Entregue', icon: '✨', color: 'text-green-600' },
      cancelled: { label: 'Cancelado', icon: '❌', color: 'text-red-500' }
    };
    return statusMap[status] || { label: status, icon: '❓', color: 'text-gray-500' };
  };

  const getTimeline = () => {
    if (!delivery) return [];

    const timeline = [
      {
        label: 'Criado',
        time: delivery.created_at,
        completed: true
      },
      {
        label: 'Aceito por Motorista',
        time: delivery.accepted_at,
        completed: !!delivery.accepted_at
      },
      {
        label: 'Pedido Coletado',
        time: delivery.picked_up_at,
        completed: !!delivery.picked_up_at
      },
      {
        label: 'Entregue ao Destinatário',
        time: delivery.delivered_at,
        completed: !!delivery.delivered_at
      }
    ];

    return timeline;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!delivery) {
    return null;
  }

  const statusInfo = getStatusInfo(delivery.status);
  const timeline = getTimeline();
  const isActive = ['accepted', 'picked_up'].includes(delivery.status);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <RestaurantSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/restaurant/dashboard')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <div>
                  <h1 className="text-xl font-semibold">Rastreamento em Tempo Real</h1>
                  <p className="text-xs text-muted-foreground">
                    Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchDelivery}
                >
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Atualizar
                </Button>
                <NotificationBell />
              </div>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-auto bg-gradient-to-br from-background via-background to-primary/5">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Real-time Map */}
              {isActive && currentLocation && (
                <Card className="border-2 border-primary/20 overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Navigation className="w-5 h-5 animate-pulse text-primary" />
                          Localização do Motorista
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Atualização automática a cada 10 segundos
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Última atualização</div>
                        <div className="text-sm font-medium">
                          {new Date(currentLocation.created_at).toLocaleTimeString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <DeliveryMap
                      pickupLat={Number(delivery.pickup_latitude)}
                      pickupLng={Number(delivery.pickup_longitude)}
                      deliveryLat={Number(delivery.delivery_latitude)}
                      deliveryLng={Number(delivery.delivery_longitude)}
                      driverLat={currentLocation ? Number(currentLocation.latitude) : undefined}
                      driverLng={currentLocation ? Number(currentLocation.longitude) : undefined}
                      locationHistory={locationHistory}
                    />
                    <div className="p-4 grid grid-cols-3 gap-4 bg-background">
                      <div className="p-3 bg-green-500/10 rounded-lg text-center border border-green-500/20">
                        <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-2"></div>
                        <p className="text-xs font-medium">Coleta</p>
                      </div>
                      <div className="p-3 bg-blue-500/10 rounded-lg text-center border border-blue-500/20">
                        <div className="w-3 h-3 bg-blue-500 rounded-full mx-auto mb-2 animate-pulse"></div>
                        <p className="text-xs font-medium">Motorista</p>
                      </div>
                      <div className="p-3 bg-red-500/10 rounded-lg text-center border border-red-500/20">
                        <div className="w-3 h-3 bg-red-500 rounded-full mx-auto mb-2"></div>
                        <p className="text-xs font-medium">Entrega</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Status Card */}
              <Card className="border-2">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="text-5xl">{statusInfo.icon}</div>
                      <div>
                        <h2 className={`text-2xl font-bold ${statusInfo.color}`}>
                          {statusInfo.label}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                          Pedido #{delivery.id.slice(0, 8).toUpperCase()}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                          <span>{delivery.distance_km.toFixed(1)} km</span>
                          <span>•</span>
                          <span>{new Date(delivery.created_at).toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-bold text-primary">
                        R$ {parseFloat(delivery.price.toString()).toFixed(2)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Valor da entrega</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Addresses */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Endereços
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Coleta
                      </p>
                      <p className="text-sm text-muted-foreground">{delivery.pickup_address}</p>
                    </div>
                    <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        Entrega
                      </p>
                      <p className="text-sm text-muted-foreground">{delivery.delivery_address}</p>
                    </div>
                    {delivery.description && (
                      <>
                        <Separator />
                        <div>
                          <p className="text-sm font-medium mb-2">Observações</p>
                          <p className="text-sm text-muted-foreground">{delivery.description}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Driver Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Motorista
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {driver ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center border-2 border-primary/20">
                            <User className="w-8 h-8 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-lg">{driver.profiles.full_name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                                <span className="text-sm font-medium">{driver.rating.toFixed(1)}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">•</span>
                              <span className="text-sm text-muted-foreground capitalize">
                                {driver.vehicle_type}
                              </span>
                            </div>
                          </div>
                        </div>

                        <Separator />

                        {driver.profiles.phone && (
                          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                            <Phone className="w-5 h-5 text-primary" />
                            <div>
                              <p className="text-xs text-muted-foreground">Contato</p>
                              <p className="font-medium">{driver.profiles.phone}</p>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                          <Package className="w-5 h-5 text-primary" />
                          <div>
                            <p className="text-xs text-muted-foreground">Veículo</p>
                            <p className="font-medium">{driver.license_plate}</p>
                          </div>
                        </div>

                        {currentLocation && (
                          <div className="text-xs text-center text-muted-foreground pt-3 border-t">
                            <Navigation className="w-3 h-3 inline mr-1 animate-pulse" />
                            Última atualização: {new Date(currentLocation.created_at).toLocaleTimeString('pt-BR')}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Package className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <p className="font-medium mb-1">Aguardando motorista</p>
                        <p className="text-sm text-muted-foreground">
                          Em breve um motorista aceitará sua entrega
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Linha do Tempo</CardTitle>
                  <CardDescription>Acompanhe o progresso da entrega</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {timeline.map((step, index) => (
                      <div key={index} className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                            step.completed 
                              ? 'bg-primary text-primary-foreground shadow-lg' 
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {step.completed ? '✓' : index + 1}
                          </div>
                          {index < timeline.length - 1 && (
                            <div className={`w-1 h-12 transition-all ${
                              step.completed ? 'bg-primary' : 'bg-muted'
                            }`} />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <p className={`font-semibold ${step.completed ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {step.label}
                          </p>
                          {step.time && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {new Date(step.time).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
