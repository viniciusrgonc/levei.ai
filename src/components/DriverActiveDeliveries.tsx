import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, ChevronRight, Lock } from 'lucide-react';
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
  delivery_sequence: number;
  parent_delivery_id: string | null;
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
        .select('id, status, pickup_address, delivery_address, price_adjusted, distance_km, product_type, is_additional_delivery, delivery_sequence, parent_delivery_id')
        .eq('driver_id', driverId)
        .in('status', ['accepted', 'picking_up', 'picked_up', 'delivering'])
        .order('delivery_sequence', { ascending: true });

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

  // Get next delivery based on sequence (lowest sequence that is not delivered)
  const getNextDelivery = () => {
    // Sort by sequence and find first non-delivered
    const sorted = [...deliveries].sort((a, b) => a.delivery_sequence - b.delivery_sequence);
    return sorted.find(d => d.status !== 'delivered');
  };

  const nextDelivery = getNextDelivery();
  const totalDeliveries = deliveries.length;

  // Check if a delivery can be worked on (previous ones must be picked up or delivered)
  const canWorkOnDelivery = (delivery: Delivery) => {
    if (delivery.delivery_sequence === 1) return true;
    
    // Check all deliveries with lower sequence
    const previousDeliveries = deliveries.filter(d => d.delivery_sequence < delivery.delivery_sequence);
    
    // For pickup phase: all previous must be at least picked_up
    if (delivery.status === 'accepted' || delivery.status === 'picking_up') {
      return previousDeliveries.every(d => 
        d.status === 'picked_up' || d.status === 'delivering' || d.status === 'delivered'
      );
    }
    
    // For delivery phase: all previous must be delivered
    if (delivery.status === 'picked_up' || delivery.status === 'delivering') {
      return previousDeliveries.every(d => d.status === 'delivered');
    }
    
    return true;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Suas Entregas Ativas</span>
          <Badge variant="secondary">{deliveries.length} entrega(s)</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {deliveries
          .sort((a, b) => a.delivery_sequence - b.delivery_sequence)
          .map((delivery) => {
          const statusInfo = getStatusConfig(delivery.status as DeliveryStatus);
          const isNext = delivery.id === nextDelivery?.id;
          const isLocked = !canWorkOnDelivery(delivery);
          
          return (
            <div
              key={delivery.id}
              onClick={() => !isLocked && handleDeliveryClick(delivery)}
              className={`p-3 rounded-lg border transition-all ${
                isLocked 
                  ? 'opacity-50 cursor-not-allowed bg-muted/30' 
                  : 'cursor-pointer hover:bg-muted/50'
              } ${isNext ? 'border-primary bg-primary/5' : ''}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    isNext ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    {isLocked ? <Lock className="w-4 h-4" /> : delivery.delivery_sequence}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        Entrega {delivery.delivery_sequence} de {totalDeliveries}
                      </Badge>
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </Badge>
                      {delivery.is_additional_delivery && (
                        <Badge variant="outline" className="text-xs border-dashed">
                          Adicional
                        </Badge>
                      )}
                      {isNext && (
                        <Badge className="text-xs">Próxima</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {delivery.status === 'picked_up' || delivery.status === 'delivering' ? (
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
                  {!isLocked && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
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
