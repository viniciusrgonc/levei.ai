import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package } from 'lucide-react';
import { useNearbyDeliveries } from '@/hooks/useNearbyDeliveries';
import { useAcceptDelivery } from '@/hooks/useAcceptDelivery';
import { DeliveryCard } from '@/components/DeliveryCard';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { DriverSidebar } from '@/components/DriverSidebar';
import NotificationBell from '@/components/NotificationBell';

interface Driver {
  id: string;
  is_available: boolean;
}

export default function AvailableDeliveries() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [driver, setDriver] = useState<Driver | null>(null);

  const {
    deliveries: availableDeliveries,
    loading: deliveriesLoading,
  } = useNearbyDeliveries({
    driverId: driver?.id || '',
    isAvailable: driver?.is_available || false,
    maxDistanceKm: 20,
  });

  const { acceptDelivery, loading: acceptingDelivery } = useAcceptDelivery({
    onSuccess: (deliveryId) => {
      navigate(`/driver/pickup/${deliveryId}`);
    }
  });

  useEffect(() => {
    if (user) {
      fetchDriver();
    }
  }, [user]);

  const fetchDriver = async () => {
    const { data, error } = await supabase
      .from('drivers')
      .select('id, is_available')
      .eq('user_id', user?.id)
      .single();

    if (!error && data) {
      setDriver(data);
    }
  };

  const handleAcceptDelivery = async (deliveryId: string) => {
    if (!driver?.id) return;
    await acceptDelivery(deliveryId, driver.id);
  };

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full">
        <DriverSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-primary">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
              <h1 className="text-xl font-bold text-primary-foreground">Entregas Disponíveis</h1>
            </div>
            <NotificationBell />
          </header>

          <main className="flex-1 p-6 bg-background overflow-auto">
            <div className="max-w-4xl mx-auto">
              <Card>
                <CardHeader>
                  <CardTitle>Entregas Disponíveis</CardTitle>
                  <CardDescription>
                    {driver?.is_available
                      ? 'Aceite uma entrega para começar'
                      : 'Ative sua disponibilidade no dashboard para ver entregas'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!driver?.is_available ? (
                    <div className="text-center py-12">
                      <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">
                        Ative sua disponibilidade no dashboard para ver entregas disponíveis
                      </p>
                      <Button onClick={() => navigate('/driver/dashboard')} className="mt-4">
                        Ir para Dashboard
                      </Button>
                    </div>
                  ) : deliveriesLoading ? (
                    <div className="text-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-sm text-muted-foreground">Buscando entregas próximas...</p>
                    </div>
                  ) : availableDeliveries.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">Nenhuma entrega disponível no momento</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Novas entregas aparecerão aqui automaticamente
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {availableDeliveries.map((delivery, index) => (
                        <DeliveryCard
                          key={delivery.id}
                          delivery={delivery}
                          actionButton={
                            <Button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcceptDelivery(delivery.id);
                              }}
                              disabled={acceptingDelivery}
                              className="transition-all duration-300 hover:scale-110 active:scale-95"
                            >
                              Aceitar Coleta
                            </Button>
                          }
                          onNavigate={() => {}}
                        />
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
