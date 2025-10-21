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
import { MapPin, Package, Clock, LogOut, Navigation } from 'lucide-react';

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
}

export default function DriverDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [availableDeliveries, setAvailableDeliveries] = useState<Delivery[]>([]);
  const [activeDelivery, setActiveDelivery] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDriver();
      fetchActiveDelivery();
    }
  }, [user]);

  useEffect(() => {
    if (driver?.is_available) {
      fetchAvailableDeliveries();
      
      const channel = supabase
        .channel('pending-deliveries')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'deliveries',
            filter: 'status=eq.pending'
          },
          () => {
            fetchAvailableDeliveries();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [driver?.is_available]);

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

  const fetchAvailableDeliveries = async () => {
    const { data } = await supabase
      .from('deliveries')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    setAvailableDeliveries(data || []);
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
    if (!driver) return;

    const { error } = await supabase
      .from('deliveries')
      .update({
        driver_id: driver.id,
        status: 'accepted',
        accepted_at: new Date().toISOString()
      })
      .eq('id', deliveryId);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível aceitar a entrega'
      });
    } else {
      toast({
        title: 'Entrega aceita!',
        description: 'Vá até o local de coleta'
      });
      navigate(`/driver/delivery/${deliveryId}`);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast({ title: 'Logout realizado com sucesso' });
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (activeDelivery) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="max-w-4xl mx-auto pt-8">
          <Card>
            <CardHeader>
              <CardTitle>Você tem uma entrega ativa</CardTitle>
              <CardDescription>Continue sua entrega em andamento</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate(`/driver/delivery/${activeDelivery.id}`)} className="w-full">
                <Navigation className="mr-2 h-4 w-4" />
                Continuar Entrega
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard do Motorista</h1>
            <p className="text-muted-foreground">Entregas disponíveis na sua área</p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
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
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avaliação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {driver?.rating ? `⭐ ${Number(driver.rating).toFixed(1)}` : '—'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
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
            ) : availableDeliveries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma entrega disponível no momento
              </div>
            ) : (
              <div className="space-y-4">
                {availableDeliveries.map((delivery) => (
                  <Card key={delivery.id}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-start gap-2">
                            <Package className="h-4 w-4 text-primary mt-1" />
                            <div>
                              <p className="font-medium">Coleta</p>
                              <p className="text-sm text-muted-foreground">{delivery.pickup_address}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-primary mt-1" />
                            <div>
                              <p className="font-medium">Entrega</p>
                              <p className="text-sm text-muted-foreground">{delivery.delivery_address}</p>
                            </div>
                          </div>
                          {delivery.description && (
                            <p className="text-sm text-muted-foreground">{delivery.description}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
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
                          {new Date(delivery.created_at).toLocaleString('pt-BR')}
                        </div>
                        <Button onClick={() => acceptDelivery(delivery.id)}>
                          Aceitar Entrega
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
    </div>
  );
}
