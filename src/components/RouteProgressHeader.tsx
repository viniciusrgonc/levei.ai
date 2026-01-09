import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { MapPin, ChevronRight, Wallet } from 'lucide-react';

interface RouteDelivery {
  id: string;
  delivery_sequence: number;
  delivery_address: string;
  status: string;
}

interface RouteProgressHeaderProps {
  currentSequence: number;
  totalDeliveries: number;
  nextDeliveryAddress?: string;
  accumulatedEarnings: number;
}

export function RouteProgressHeader({
  currentSequence,
  totalDeliveries,
  nextDeliveryAddress,
  accumulatedEarnings
}: RouteProgressHeaderProps) {
  // Don't show for single deliveries
  if (totalDeliveries <= 1) return null;

  const progress = (currentSequence / totalDeliveries) * 100;
  const isLastDelivery = currentSequence === totalDeliveries;

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Progress value={progress} className="h-1.5" />
        </div>
        <Badge variant="secondary" className="text-xs font-semibold shrink-0">
          {currentSequence}/{totalDeliveries}
        </Badge>
      </div>

      {/* Route info row */}
      <div className="flex items-center justify-between gap-2">
        {/* Accumulated earnings */}
        <Badge variant="outline" className="gap-1 text-xs bg-success/10 text-success border-success/30">
          <Wallet className="w-3 h-3" />
          R$ {accumulatedEarnings.toFixed(2)}
        </Badge>

        {/* Next delivery preview */}
        {!isLastDelivery && nextDeliveryAddress && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground truncate max-w-[180px]">
            <span className="shrink-0">Próx:</span>
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{nextDeliveryAddress}</span>
            <ChevronRight className="w-3 h-3 shrink-0" />
          </div>
        )}

        {isLastDelivery && (
          <Badge variant="default" className="text-xs">
            Última entrega
          </Badge>
        )}
      </div>
    </div>
  );
}
