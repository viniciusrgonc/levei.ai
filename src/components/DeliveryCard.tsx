import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Package, Clock, Navigation, FileText } from 'lucide-react';
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
    product_type?: string | null;
    product_note?: string | null;
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
      <CardContent className="pt-4 sm:pt-6">
        <div className="flex justify-between items-start mb-3 sm:mb-4 gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3 flex-wrap">
              <span className="text-xl sm:text-2xl">{statusConfig.icon}</span>
              <Badge variant={statusConfig.variant} className="text-xs">{statusConfig.label}</Badge>
            </div>
            
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-start gap-1.5 sm:gap-2">
                <Package className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary mt-0.5 sm:mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs sm:text-sm">Coleta</p>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">{delivery.pickup_address}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-1.5 sm:gap-2">
                <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary mt-0.5 sm:mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs sm:text-sm">Entrega</p>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">{delivery.delivery_address}</p>
                </div>
              </div>

              {delivery.distanceFromDriver && (
                <Badge variant="secondary" className="animate-scale-in text-xs">
                  <Navigation className="h-3 w-3 mr-1" />
                  {delivery.distanceFromDriver.toFixed(1)} km de você
                </Badge>
              )}

              {delivery.product_type && (
                <div className="flex items-start gap-1.5 sm:gap-2 mt-1.5 sm:mt-2 p-2 sm:p-3 bg-primary/5 rounded-md border border-primary/10">
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs sm:text-sm text-primary">
                      Tipo de Produto: {delivery.product_type}
                    </p>
                    {delivery.product_note && (
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                        <span className="font-medium">Observações:</span> {delivery.product_note}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {delivery.description && (
                <p className="text-xs sm:text-sm text-muted-foreground italic">{delivery.description}</p>
              )}
            </div>
          </div>
          
          <div className="text-right shrink-0 ml-2 sm:ml-4">
            <div className="text-xl sm:text-2xl font-bold text-primary animate-pulse">
              R$ {Number(delivery.price).toFixed(2)}
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              {Number(delivery.distance_km).toFixed(1)} km
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 sm:pt-4 border-t gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="truncate">{new Date(delivery.created_at).toLocaleString('pt-BR')}</span>
          </div>
          {actionButton}
        </div>
      </CardContent>
    </Card>
  );
}
