import { useState, useEffect } from 'react';
import { DriverSidebar } from '@/components/DriverSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import NotificationBell from '@/components/NotificationBell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export default function DriverMap() {
  const [nearbyDeliveries, setNearbyDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchNearbyDeliveries();
  }, []);

  const fetchNearbyDeliveries = async () => {
    try {
      const { data: deliveries, error } = await supabase
        .from('deliveries')
        .select('*, restaurants(business_name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNearbyDeliveries(deliveries || []);
    } catch (error) {
      console.error('Erro ao buscar entregas:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DriverSidebar />
        <main className="flex-1 overflow-y-auto">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold">Mapa de Entregas</h1>
            <div className="ml-auto">
              <NotificationBell />
            </div>
          </header>

          <div className="p-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Entregas Disponíveis
                </CardTitle>
                <CardDescription>
                  Veja as entregas próximas a você
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted-foreground">Carregando...</p>
                ) : nearbyDeliveries.length === 0 ? (
                  <p className="text-muted-foreground">Nenhuma entrega disponível no momento</p>
                ) : (
                  <div className="space-y-4">
                    {nearbyDeliveries.map((delivery) => (
                      <Card key={delivery.id}>
                        <CardContent className="pt-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="space-y-1">
                              <p className="font-semibold">{delivery.restaurants?.business_name}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Navigation className="h-4 w-4" />
                                <span>{delivery.distance_km} km</span>
                              </div>
                            </div>
                            <Badge variant="secondary">
                              R$ {Number(delivery.price).toFixed(2)}
                            </Badge>
                          </div>
                          <div className="space-y-2 mb-4">
                            <div className="flex items-start gap-2">
                              <Package className="h-4 w-4 mt-1 text-primary" />
                              <div>
                                <p className="text-sm font-medium">Coleta</p>
                                <p className="text-sm text-muted-foreground">{delivery.pickup_address}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 mt-1 text-destructive" />
                              <div>
                                <p className="text-sm font-medium">Entrega</p>
                                <p className="text-sm text-muted-foreground">{delivery.delivery_address}</p>
                              </div>
                            </div>
                          </div>
                          <Button 
                            className="w-full" 
                            onClick={() => navigate(`/driver/delivery/${delivery.id}`)}
                          >
                            Ver Detalhes
                          </Button>
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
    </SidebarProvider>
  );
}
