import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MapPin, User, Phone, Star, Package, Clock, Navigation } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useRealtimeDriverLocation } from '@/hooks/useRealtimeDriverLocation';
import DeliveryMap from '@/components/DeliveryMap';

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
      pending: { label: 'Aguardando Motoboy', icon: '🕐', color: 'text-yellow-500' },
      accepted: { label: 'Aceito - Indo Buscar', icon: '✅', color: 'text-blue-500' },
      picking_up: { label: 'A Caminho da Coleta', icon: '🏍️', color: 'text-blue-500' },
      picked_up: { label: 'Pedido Coletado', icon: '📦', color: 'text-green-500' },
      delivering: { label: 'Em Rota de Entrega', icon: '🚀', color: 'text-green-500' },
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
        label: 'Aceito',
        time: delivery.accepted_at,
        completed: !!delivery.accepted_at
      },
      {
        label: 'Coletado',
        time: delivery.picked_up_at,
        completed: !!delivery.picked_up_at
      },
      {
        label: 'Entregue',
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/restaurant/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Real-time Map */}
        {delivery.driver_id && currentLocation && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Rastreamento em Tempo Real</CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Navigation className="w-4 h-4 animate-pulse text-primary" />
                  Atualização automática
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DeliveryMap
                pickupLat={Number(delivery.pickup_latitude)}
                pickupLng={Number(delivery.pickup_longitude)}
                deliveryLat={Number(delivery.delivery_latitude)}
                deliveryLng={Number(delivery.delivery_longitude)}
                driverLat={currentLocation ? Number(currentLocation.latitude) : undefined}
                driverLng={currentLocation ? Number(currentLocation.longitude) : undefined}
                locationHistory={locationHistory}
              />
              <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <div className="w-4 h-4 bg-green-500 rounded-full mx-auto mb-1"></div>
                  <p className="text-xs text-muted-foreground">Coleta</p>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-lg">
                  <div className="w-4 h-4 bg-blue-500 rounded-full mx-auto mb-1"></div>
                  <p className="text-xs text-muted-foreground">Motoboy</p>
                </div>
                <div className="p-3 bg-red-500/10 rounded-lg">
                  <div className="w-4 h-4 bg-red-500 rounded-full mx-auto mb-1"></div>
                  <p className="text-xs text-muted-foreground">Entrega</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Card */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-4xl">{statusInfo.icon}</div>
                <div>
                  <h2 className={`text-2xl font-bold ${statusInfo.color}`}>
                    {statusInfo.label}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Pedido #{delivery.id.slice(0, 8)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">R$ {parseFloat(delivery.price.toString()).toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">{delivery.distance_km.toFixed(1)} km</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Addresses */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Endereços</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Coleta</p>
                <div className="flex gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>{delivery.pickup_address}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Entrega</p>
                <div className="flex gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>{delivery.delivery_address}</p>
                </div>
              </div>
              {delivery.description && (
                <div>
                  <p className="text-sm font-medium mb-1">Descrição</p>
                  <p className="text-sm text-muted-foreground">{delivery.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Driver Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Motoboy</CardTitle>
            </CardHeader>
            <CardContent>
              {driver ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{driver.profiles.full_name}</p>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                        <span>{driver.rating.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                  {driver.profiles.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{driver.profiles.phone}</span>
                    </div>
                  )}
                  <div className="text-sm">
                    <p className="text-muted-foreground">Veículo</p>
                    <p className="font-medium capitalize">{driver.vehicle_type} - {driver.license_plate}</p>
                  </div>
                  {currentLocation && (
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      Última localização: {new Date(currentLocation.created_at).toLocaleTimeString('pt-BR')}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Aguardando motoboy aceitar
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Timeline */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Linha do Tempo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {timeline.map((step, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      step.completed ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {step.completed ? '✓' : index + 1}
                    </div>
                    {index < timeline.length - 1 && (
                      <div className={`w-0.5 h-8 ${step.completed ? 'bg-primary' : 'bg-muted'}`} />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="font-medium">{step.label}</p>
                    {step.time && (
                      <p className="text-sm text-muted-foreground">
                        {new Date(step.time).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}