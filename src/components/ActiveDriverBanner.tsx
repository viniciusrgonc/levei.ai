import { Clock, Plus, Package, Percent, TrendingDown, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';

interface ActiveDriverBannerProps {
  driverId: string;
  parentDeliveryId: string;
  currentCount: number;
  maxCount: number;
  timeRemainingMinutes: number;
  basePrice: number;
  pricePerKm: number;
  regularBasePrice?: number;
  regularPricePerKm?: number;
}

export function ActiveDriverBanner({
  parentDeliveryId,
  currentCount,
  maxCount,
  timeRemainingMinutes,
  basePrice,
  pricePerKm,
  regularBasePrice = 5.00,
  regularPricePerKm = 2.50
}: ActiveDriverBannerProps) {
  const navigate = useNavigate();
  const remainingSlots = maxCount - currentCount;

  if (remainingSlots <= 0 || timeRemainingMinutes <= 0) return null;

  // Calculate discount percentage
  const regularTotal = regularBasePrice + regularPricePerKm * 5; // Example 5km
  const discountedTotal = basePrice + pricePerKm * 5;
  const discountPercent = Math.round(((regularTotal - discountedTotal) / regularTotal) * 100);

  const timeProgress = Math.max(0, Math.min(100, (timeRemainingMinutes / 15) * 100));
  const isUrgent = timeRemainingMinutes <= 5;

  const handleAddDelivery = () => {
    navigate(`/restaurant/new-delivery?parent=${parentDeliveryId}`);
  };

  return (
    <Card className={`border-2 overflow-hidden ${isUrgent ? 'border-warning bg-warning/5' : 'border-success bg-success/5'}`}>
      <CardContent className="p-0">
        {/* Header com destaque */}
        <div className={`px-4 py-2 ${isUrgent ? 'bg-warning/10' : 'bg-success/10'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isUrgent ? 'bg-warning/20' : 'bg-success/20'}`}>
                <Truck className={`w-4 h-4 ${isUrgent ? 'text-warning' : 'text-success'}`} />
              </div>
              <div>
                <p className={`text-sm font-semibold ${isUrgent ? 'text-warning' : 'text-success'}`}>
                  Entregador em rota
                </p>
                <p className="text-xs text-muted-foreground">
                  Já em coleta no seu estabelecimento
                </p>
              </div>
            </div>
            {discountPercent > 0 && (
              <Badge className="bg-success text-success-foreground gap-1">
                <TrendingDown className="w-3 h-3" />
                -{discountPercent}%
              </Badge>
            )}
          </div>
        </div>

        {/* Conteúdo principal */}
        <div className="p-4 space-y-3">
          {/* Preço especial */}
          <div className="flex items-center justify-between bg-background/50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-success" />
              <span className="text-sm text-muted-foreground">Preço reduzido:</span>
            </div>
            <div className="text-right">
              <p className="font-bold text-success">
                R$ {basePrice.toFixed(2)} + R$ {pricePerKm.toFixed(2)}/km
              </p>
            </div>
          </div>

          {/* Tempo restante */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-3 h-3" />
                Tempo restante
              </span>
              <span className={`font-medium ${isUrgent ? 'text-warning' : 'text-foreground'}`}>
                {Math.ceil(timeRemainingMinutes)} min
              </span>
            </div>
            <Progress 
              value={timeProgress} 
              className={`h-1.5 ${isUrgent ? '[&>div]:bg-warning' : ''}`} 
            />
          </div>

          {/* Slots disponíveis */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Entregas na rota:</span>
            <div className="flex items-center gap-1">
              {Array.from({ length: maxCount }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full ${
                    i < currentCount ? 'bg-success' : 'bg-muted border border-dashed border-muted-foreground/30'
                  }`}
                />
              ))}
              <span className="text-xs text-muted-foreground ml-1">
                ({remainingSlots} {remainingSlots === 1 ? 'vaga' : 'vagas'})
              </span>
            </div>
          </div>

          {/* CTA */}
          <Button 
            onClick={handleAddDelivery} 
            className="w-full gap-2 font-semibold"
            size="lg"
          >
            <Plus className="w-4 h-4" />
            Adicionar Entrega à Rota
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
