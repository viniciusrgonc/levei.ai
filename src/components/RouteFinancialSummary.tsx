import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface RouteSummary {
  total_gross: number;
  total_net: number;
  total_platform_fee: number;
  delivery_count: number;
  completed_count: number;
  pending_payment: boolean;
}

interface RouteFinancialSummaryProps {
  driverId: string;
}

export function RouteFinancialSummary({ driverId }: RouteFinancialSummaryProps) {
  const [summary, setSummary] = useState<RouteSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!driverId) return;

    const fetchSummary = async () => {
      const { data, error } = await supabase.rpc('get_route_financial_summary', {
        p_driver_id: driverId
      });

      if (!error && data) {
        setSummary(data as unknown as RouteSummary);
      }
      setLoading(false);
    };

    fetchSummary();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('route-financial-summary')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
          filter: `driver_id=eq.${driverId}`
        },
        () => {
          fetchSummary();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId]);

  if (loading || !summary || summary.delivery_count === 0) return null;

  const progress = summary.delivery_count > 0 
    ? (summary.completed_count / summary.delivery_count) * 100 
    : 0;

  return (
    <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">RESUMO DA ROTA</p>
              <p className="text-sm font-semibold text-foreground">
                {summary.delivery_count} entrega{summary.delivery_count > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {summary.pending_payment ? (
            <Badge variant="secondary" className="gap-1">
              <Clock className="w-3 h-3" />
              Pagamento ao final
            </Badge>
          ) : (
            <Badge variant="default" className="gap-1 bg-success">
              <CheckCircle className="w-3 h-3" />
              Pago
            </Badge>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Progresso</span>
            <span>{summary.completed_count} de {summary.delivery_count} concluídas</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Financial breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-background/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Valor bruto total</p>
            <p className="text-lg font-bold text-foreground">
              R$ {summary.total_gross.toFixed(2)}
            </p>
          </div>
          <div className="bg-success/10 rounded-lg p-3">
            <div className="flex items-center gap-1 mb-1">
              <Wallet className="w-3 h-3 text-success" />
              <p className="text-xs text-success font-medium">Seu ganho (80%)</p>
            </div>
            <p className="text-lg font-bold text-success">
              R$ {summary.total_net.toFixed(2)}
            </p>
          </div>
        </div>

        {summary.pending_payment && summary.delivery_count > 1 && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            💡 O pagamento será creditado após concluir a última entrega
          </p>
        )}
      </CardContent>
    </Card>
  );
}
