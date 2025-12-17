import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, MapPin, Navigation, Clock, ArrowLeft, Bike } from 'lucide-react';
import { useNearbyDeliveries } from '@/hooks/useNearbyDeliveries';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { DriverSidebar } from '@/components/DriverSidebar';
import NotificationBell from '@/components/NotificationBell';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';

interface Driver {
  id: string;
  is_available: boolean;
}

// Empty state
function EmptyState({ isAvailable, radiusKm, onGoToDashboard }: { isAvailable: boolean; radiusKm: number; onGoToDashboard: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
        <Package className="w-10 h-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {isAvailable ? 'Nenhuma entrega disponível' : 'Você está offline'}
      </h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        {isAvailable 
          ? `Não há entregas em um raio de ${radiusKm} km da sua localização.`
          : 'Ative sua disponibilidade para ver entregas.'}
      </p>
      <Button onClick={onGoToDashboard}>
        Ir para o Início
      </Button>
    </div>
  );
}

// Delivery card
function DeliveryListCard({ 
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
        {/* Header com valor */}
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

          {delivery.product_type && (
            <Badge variant="outline" className="text-xs">
              {delivery.product_type}
            </Badge>
          )}
        </div>

        {/* Botão de ação */}
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

export default function AvailableDeliveries() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [loading, setLoading] = useState(true);

  const {
    deliveries: availableDeliveries,
    loading: deliveriesLoading,
    radiusKm,
  } = useNearbyDeliveries({
    driverId: driver?.id || '',
    isAvailable: driver?.is_available || false,
  });

  const safeDeliveries = Array.isArray(availableDeliveries) ? availableDeliveries : [];

  useEffect(() => {
    if (user) fetchDriver();
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
    setLoading(false);
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

  if (loading) {
    return (
      <SidebarProvider defaultOpen={false}>
        <div className="min-h-screen flex w-full">
          <DriverSidebar />
          <div className="flex-1 flex flex-col">
            <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-primary safe-top">
              <div className="flex items-center gap-3">
                <SidebarTrigger className="text-primary-foreground" />
                <h1 className="text-lg font-bold text-primary-foreground">Entregas</h1>
              </div>
              <NotificationBell />
            </header>
            <main className="flex-1 p-4 bg-background">
              <div className="space-y-3">
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
              </div>
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
          {/* Header */}
          <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-primary safe-top">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-primary-foreground" />
              <div className="flex items-center gap-2">
                <Bike className="w-5 h-5 text-primary-foreground" />
                <h1 className="text-lg font-bold text-primary-foreground">Entregas</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {safeDeliveries.length > 0 && (
                <Badge variant="secondary">{safeDeliveries.length}</Badge>
              )}
              <NotificationBell />
            </div>
          </header>

          <main className="flex-1 p-4 bg-background overflow-auto safe-bottom">
            <div className="max-w-lg mx-auto space-y-4">
              {/* Back button */}
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/driver/dashboard')}
                className="mb-2"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>

              {/* Status com raio */}
              {driver?.is_available && (
                <p className="text-sm text-muted-foreground">
                  {safeDeliveries.length > 0 
                    ? `${safeDeliveries.length} ${safeDeliveries.length === 1 ? 'entrega disponível' : 'entregas disponíveis'} em um raio de ${radiusKm} km`
                    : `Mostrando entregas em um raio de ${radiusKm} km`}
                </p>
              )}

              {/* Content */}
              {!driver?.is_available || safeDeliveries.length === 0 ? (
                <Card>
                  <EmptyState 
                    isAvailable={driver?.is_available || false} 
                    radiusKm={radiusKm}
                    onGoToDashboard={() => navigate('/driver/dashboard')} 
                  />
                </Card>
              ) : deliveriesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-40 rounded-xl" />
                  <Skeleton className="h-40 rounded-xl" />
                </div>
              ) : (
                <div className="space-y-3">
                  {safeDeliveries.map((delivery) => (
                    <DeliveryListCard
                      key={delivery.id}
                      delivery={delivery}
                      onAccept={acceptDelivery}
                      accepting={accepting}
                    />
                  ))}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}