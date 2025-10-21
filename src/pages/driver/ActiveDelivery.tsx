import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { MapPin, Package, CheckCircle, Camera, ArrowLeft, Navigation } from 'lucide-react';
import { useDriverLocationTracking } from '@/hooks/useDriverLocationTracking';

interface Delivery {
  id: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  distance_km: number;
  price: number;
  description: string | null;
  pickup_latitude: number;
  pickup_longitude: number;
  delivery_latitude: number;
  delivery_longitude: number;
  created_at: string;
  accepted_at: string | null;
  picked_up_at: string | null;
  driver_id: string;
}

export default function ActiveDelivery() {
  const { deliveryId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [driverId, setDriverId] = useState<string | null>(null);

  // Enable location tracking when delivery is active
  useDriverLocationTracking({
    driverId: driverId || '',
    deliveryId: deliveryId || '',
    isActive: !!driverId && !!deliveryId && delivery?.status !== 'delivered',
  });

  useEffect(() => {
    if (deliveryId) {
      fetchDelivery();
      
      const channel = supabase
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
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [deliveryId]);

  const fetchDelivery = async () => {
    const { data, error } = await supabase
      .from('deliveries')
      .select('*')
      .eq('id', deliveryId)
      .single();

    if (error || !data) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar os dados da entrega'
      });
      navigate('/driver/dashboard');
    } else {
      setDelivery(data);
      if (data.driver_id) {
        setDriverId(data.driver_id);
      }
    }
    setLoading(false);
  };

  const markAsPickedUp = async () => {
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
        description: 'Não foi possível atualizar o status'
      });
    } else {
      toast({
        title: 'Pedido coletado!',
        description: 'Agora siga para o endereço de entrega'
      });
    }
  };

  const markAsDelivered = async () => {
    const { error } = await supabase
      .from('deliveries')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString()
      })
      .eq('id', deliveryId);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar o status'
      });
    } else {
      toast({
        title: 'Entrega concluída!',
        description: `Você ganhou R$ ${Number(delivery?.price).toFixed(2)}`
      });
      navigate('/driver/dashboard');
    }
  };

  const openInMaps = (lat: number, lng: number, address: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!delivery) return null;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      accepted: { variant: 'default', label: 'Aceito' },
      picked_up: { variant: 'default', label: 'Coletado' },
      delivered: { variant: 'default', label: 'Entregue' },
    };
    const config = variants[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        <Button variant="outline" onClick={() => navigate('/driver/dashboard')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <div className="grid gap-6">
          {/* Location Tracking Alert */}
          {delivery.status !== 'delivered' && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Navigation className="h-5 w-5 text-primary mt-0.5 animate-pulse" />
                  <div>
                    <p className="font-medium text-sm">Rastreamento Ativo</p>
                    <p className="text-xs text-muted-foreground">
                      Sua localização está sendo compartilhada automaticamente a cada 10 segundos
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status Card */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Entrega #{delivery.id.slice(0, 8)}</CardTitle>
                  <CardDescription>
                    {Number(delivery.distance_km).toFixed(1)} km • R$ {Number(delivery.price).toFixed(2)}
                  </CardDescription>
                </div>
                {getStatusBadge(delivery.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Pickup */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <Package className="h-5 w-5 text-primary" />
                    Coleta
                  </div>
                  <p className="text-sm text-muted-foreground ml-7">{delivery.pickup_address}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-7"
                    onClick={() => openInMaps(Number(delivery.pickup_latitude), Number(delivery.pickup_longitude), delivery.pickup_address)}
                  >
                    <MapPin className="mr-2 h-4 w-4" />
                    Abrir no Maps
                  </Button>
                  {delivery.status === 'accepted' && (
                    <Button onClick={markAsPickedUp} className="ml-7 mt-2">
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Marcar como Coletado
                    </Button>
                  )}
                </div>

                {/* Delivery */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <MapPin className="h-5 w-5 text-primary" />
                    Entrega
                  </div>
                  <p className="text-sm text-muted-foreground ml-7">{delivery.delivery_address}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-7"
                    onClick={() => openInMaps(Number(delivery.delivery_latitude), Number(delivery.delivery_longitude), delivery.delivery_address)}
                  >
                    <MapPin className="mr-2 h-4 w-4" />
                    Abrir no Maps
                  </Button>
                  {delivery.status === 'picked_up' && (
                    <Button onClick={markAsDelivered} className="ml-7 mt-2">
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Marcar como Entregue
                    </Button>
                  )}
                </div>

                {delivery.description && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-1">Observações</p>
                    <p className="text-sm text-muted-foreground">{delivery.description}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Linha do Tempo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-2 bg-primary rounded-full"></div>
                  <div className="flex-1 pb-4">
                    <p className="font-medium">Entrega Aceita</p>
                    <p className="text-sm text-muted-foreground">
                      {delivery.accepted_at ? new Date(delivery.accepted_at).toLocaleString('pt-BR') : '—'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className={`w-2 rounded-full ${delivery.picked_up_at ? 'bg-primary' : 'bg-muted'}`}></div>
                  <div className="flex-1 pb-4">
                    <p className="font-medium">Pedido Coletado</p>
                    <p className="text-sm text-muted-foreground">
                      {delivery.picked_up_at ? new Date(delivery.picked_up_at).toLocaleString('pt-BR') : 'Aguardando...'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className={`w-2 rounded-full ${delivery.status === 'delivered' ? 'bg-primary' : 'bg-muted'}`}></div>
                  <div className="flex-1">
                    <p className="font-medium">Entrega Concluída</p>
                    <p className="text-sm text-muted-foreground">
                      {delivery.status === 'delivered' ? 'Concluído' : 'Aguardando...'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
