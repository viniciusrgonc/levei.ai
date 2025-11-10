import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Package, Clock, Navigation } from 'lucide-react';
import { getStatusConfig } from '@/lib/deliveryStatus';

interface DeliveryCardProps {
  delivery: {
    id: string;
    status: string;
    pickup_address: string;
    delivery_address: string;
    distance_km: number;
    price: number;
    description?: string | null;
    created_at: string;
    distanceFromDriver?: number;
  };
  actionButton?: React.ReactNode;
  onNavigate?: () => void;
}

export function DeliveryCard({ delivery, actionButton, onNavigate }: DeliveryCardProps) {
  // Safety check
  if (!delivery) {
    console.error('DeliveryCard: delivery prop is undefined');
    return null;
  }

  console.log('DeliveryCard render:', {
    deliveryId: delivery.id,
    actionButtonType: typeof actionButton,
    onNavigateType: typeof onNavigate
  });

  const statusConfig = getStatusConfig(delivery.status as any);

  return (
    <Card 
      className="animate-fade-in hover:shadow-lg transition-all duration-300 hover:scale-[1.01] cursor-pointer"
      onClick={onNavigate}
    >
      <CardContent className="pt-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{statusConfig.icon}</span>
              <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <Package className="h-4 w-4 text-primary mt-1 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Coleta</p>
                  <p className="text-sm text-muted-foreground">{delivery.pickup_address}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-primary mt-1 shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Entrega</p>
                  <p className="text-sm text-muted-foreground">{delivery.delivery_address}</p>
                </div>
              </div>

              {delivery.distanceFromDriver && (
                <Badge variant="secondary" className="animate-scale-in">
                  <Navigation className="h-3 w-3 mr-1" />
                  {delivery.distanceFromDriver.toFixed(1)} km de você
                </Badge>
              )}

              {delivery.description && (
                <p className="text-sm text-muted-foreground italic">{delivery.description}</p>
              )}
            </div>
          </div>
          
          <div className="text-right shrink-0 ml-4">
            <div className="text-2xl font-bold text-primary animate-pulse">
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
          {actionButton}
        </div>
      </CardContent>
    </Card>
  );
}
