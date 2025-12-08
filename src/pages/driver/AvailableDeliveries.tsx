import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Filter } from 'lucide-react';
import { useNearbyDeliveries } from '@/hooks/useNearbyDeliveries';
import { useAcceptDelivery } from '@/hooks/useAcceptDelivery';
import { DeliveryCard } from '@/components/DeliveryCard';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { DriverSidebar } from '@/components/DriverSidebar';
import NotificationBell from '@/components/NotificationBell';
import { DeliveryListSkeleton } from '@/components/skeletons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Driver {
  id: string;
  is_available: boolean;
}

const PRODUCT_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'Documentos', label: 'Documentos' },
  { value: 'Produto Frágil', label: 'Frágil' },
  { value: 'Eletrônicos', label: 'Eletrônicos' },
  { value: 'Alimentos', label: 'Alimentos' },
  { value: 'Medicamentos', label: 'Medicamentos' },
  { value: 'Volumoso', label: 'Volumoso' },
];

export default function AvailableDeliveries() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [productFilter, setProductFilter] = useState<string>('all');

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

  const openPickupLocation = (latitude: number, longitude: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    window.open(url, '_blank');
  };

  // Filter deliveries by product type
  const filteredDeliveries = productFilter === 'all'
    ? availableDeliveries
    : availableDeliveries.filter(delivery => delivery.product_type === productFilter);

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
                    <DeliveryListSkeleton count={3} />
                  ) : (
                    <>
                      {/* Product Filter */}
                      {availableDeliveries.length > 0 && (
                        <div className="mb-4 flex items-center gap-2">
                          <Filter className="h-4 w-4 text-muted-foreground" />
                          <Select value={productFilter} onValueChange={setProductFilter}>
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Filtrar por tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              {PRODUCT_FILTER_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {filteredDeliveries.length === 0 ? (
                        <div className="text-center py-12">
                          <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                          <p className="text-muted-foreground">
                            {productFilter !== 'all'
                              ? 'Nenhuma entrega encontrada com este filtro'
                              : 'Nenhuma entrega disponível no momento'}
                          </p>
                          <p className="text-sm text-muted-foreground mt-2">
                            {productFilter !== 'all'
                              ? 'Tente outro filtro ou aguarde novas entregas'
                              : 'Aguarde novos pedidos ou ajuste seu raio de busca'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {filteredDeliveries.map((delivery) => (
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
                                  className="animate-pulse"
                                >
                                  {acceptingDelivery ? 'Aceitando...' : 'Aceitar Entrega'}
                                </Button>
                              }
                              onNavigate={() => openPickupLocation(delivery.pickup_latitude, delivery.pickup_longitude)}
                            />
                          ))}
                        </div>
                      )}
                    </>
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