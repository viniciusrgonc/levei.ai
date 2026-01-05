import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, ChevronRight } from 'lucide-react';
import { getStatusConfig, DeliveryStatus } from '@/lib/deliveryStatus';

interface Delivery {
  id: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  price_adjusted: number;
  distance_km: number;
  product_type: string | null;
  is_additional_delivery: boolean;
}

interface DriverActiveDeliveriesProps {
  driverId: string;
}

export function DriverActiveDeliveries({ driverId }: DriverActiveDeliveriesProps) {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId) return;

    const fetchDeliveries = async () => {
      const { data, error } = await supabase
        .from('deliveries')
        .select('id, status, pickup_address, delivery_address, price_adjusted, distance_km, product_type, is_additional_delivery')
        .eq('driver_id', driverId)
        .in('status', ['accepted', 'picking_up', 'picked_up', 'delivering'])
        .order('created_at', { ascending: true });

      if (!error && data) {
        setDeliveries(data);
      }
      setLoading(false);
    };

    fetchDeliveries();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('driver-active-deliveries')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
          filter: `driver_id=eq.${driverId}`
        },
        () => {
          fetchDeliveries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId]);

  if (loading || deliveries.length === 0) return null;

  const handleDeliveryClick = (delivery: Delivery) => {
    if (delivery.status === 'accepted' || delivery.status === 'picking_up') {
      navigate(`/driver/pickup/${delivery.id}`);
    } else {
      navigate(`/driver/delivery/${delivery.id}`);
    }
  };

  const getNextDelivery = () => {
    // Priority: picking_up > accepted > picked_up
    const pickingUp = deliveries.find(d => d.status === 'picking_up');
    if (pickingUp) return pickingUp;
    
    const accepted = deliveries.find(d => d.status === 'accepted');
    if (accepted) return accepted;
    
    return deliveries.find(d => d.status === 'picked_up');
  };

  const nextDelivery = getNextDelivery();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Suas Entregas Ativas</span>
          <Badge variant="secondary">{deliveries.length} entrega(s)</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {deliveries.map((delivery, index) => {
          const statusInfo = getStatusConfig(delivery.status as DeliveryStatus);
          const isNext = delivery.id === nextDelivery?.id;
          
          return (
            <div
              key={delivery.id}
              onClick={() => handleDeliveryClick(delivery)}
              className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/50 ${
                isNext ? 'border-primary bg-primary/5' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    isNext ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </Badge>
                      {delivery.is_additional_delivery && (
                        <Badge variant="outline" className="text-xs">
                          Adicional
                        </Badge>
                      )}
                      {isNext && (
                        <Badge className="text-xs">Próxima</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {delivery.status === 'picked_up' ? (
                        <span className="flex items-center gap-1">
                          <Navigation className="w-3 h-3" />
                          {delivery.delivery_address}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {delivery.pickup_address}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-primary">
                    R$ {Number(delivery.price_adjusted).toFixed(2)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </div>
          );
        })}

        {nextDelivery && (
          <Button 
            onClick={() => handleDeliveryClick(nextDelivery)}
            className="w-full mt-2"
            size="lg"
          >
            <Navigation className="w-4 h-4 mr-2" />
            Ir para Próxima Entrega
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
