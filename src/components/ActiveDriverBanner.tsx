import { Clock, Plus, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';

interface ActiveDriverBannerProps {
  driverId: string;
  parentDeliveryId: string;
  currentCount: number;
  maxCount: number;
  timeRemainingMinutes: number;
  basePrice: number;
  pricePerKm: number;
}

export function ActiveDriverBanner({
  parentDeliveryId,
  currentCount,
  maxCount,
  timeRemainingMinutes,
  basePrice,
  pricePerKm
}: ActiveDriverBannerProps) {
  const navigate = useNavigate();
  const remainingSlots = maxCount - currentCount;

  if (remainingSlots <= 0 || timeRemainingMinutes <= 0) return null;

  const handleAddDelivery = () => {
    navigate(`/restaurant/new-delivery?parent=${parentDeliveryId}`);
  };

  return (
    <Card className="border-success/50 bg-success/5 animate-pulse-subtle">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
              <Package className="w-6 h-6 text-success" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                Entregador em coleta
                <Badge variant="secondary" className="bg-success/10 text-success">
                  <Clock className="w-3 h-3 mr-1" />
                  {Math.ceil(timeRemainingMinutes)} min restantes
                </Badge>
              </h3>
              <p className="text-sm text-muted-foreground">
                Adicione mais entregas à rota dele! ({currentCount}/{maxCount} entregas)
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Preço especial: R$ {basePrice.toFixed(2)} + R$ {pricePerKm.toFixed(2)}/km
              </p>
            </div>
          </div>
          <Button onClick={handleAddDelivery} className="shrink-0 gap-2">
            <Plus className="w-4 h-4" />
            Adicionar à Rota
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
