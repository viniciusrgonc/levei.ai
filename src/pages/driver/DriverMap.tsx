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
      <div className="flex-mobile-column flex w-full bg-background">
        <DriverSidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="header-mobile sticky top-0 z-10 flex items-center gap-4 border-b bg-background px-3 sm:px-4 safe-top shrink-0">
            <SidebarTrigger />
            <h1 className="text-responsive-lg font-semibold">Mapa de Entregas</h1>
            <div className="ml-auto">
              <NotificationBell />
            </div>
          </header>

          <div className="scroll-container p-responsive safe-bottom">
            <Card>
              <CardHeader className="p-3 sm:p-4">
                <CardTitle className="flex items-center gap-2 text-responsive-base">
                  <MapPin className="icon-responsive-sm" />
                  Entregas Disponíveis
                </CardTitle>
                <CardDescription className="text-responsive-sm">
                  Veja as entregas próximas a você
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-0">
                {loading ? (
                  <p className="text-muted-foreground text-responsive-sm">Carregando...</p>
                ) : nearbyDeliveries.length === 0 ? (
                  <p className="text-muted-foreground text-responsive-sm">Nenhuma entrega disponível no momento</p>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {nearbyDeliveries.map((delivery) => (
                      <Card key={delivery.id} className="card-dynamic">
                        <CardContent className="p-3 sm:pt-4">
                          <div className="flex justify-between items-start mb-3 sm:mb-4">
                            <div className="space-y-1 min-w-0 flex-1">
                              <p className="text-responsive-sm font-semibold truncate">{delivery.restaurants?.business_name}</p>
                              <div className="flex items-center gap-2 text-responsive-xs text-muted-foreground">
                                <Navigation className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                                <span>{delivery.distance_km} km</span>
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-xs shrink-0">
                              R$ {Number(delivery.price).toFixed(2)}
                            </Badge>
                          </div>
                          <div className="space-y-2 mb-3 sm:mb-4">
                            <div className="flex items-start gap-2">
                              <Package className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 text-primary shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-responsive-xs font-medium">Coleta</p>
                                <p className="text-responsive-xs text-muted-foreground truncate">{delivery.pickup_address}</p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mt-0.5 text-destructive shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-responsive-xs font-medium">Entrega</p>
                                <p className="text-responsive-xs text-muted-foreground truncate">{delivery.delivery_address}</p>
                              </div>
                            </div>
                          </div>
                          <Button 
                            className="w-full btn-touch" 
                            onClick={() => navigate(`/driver/delivery/${delivery.id}`)}
                          >
                            <span className="text-responsive-sm">Ver Detalhes</span>
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
