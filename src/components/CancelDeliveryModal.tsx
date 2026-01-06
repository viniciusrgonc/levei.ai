import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, AlertTriangle, DollarSign, Percent, RefreshCw, Package, Link2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface CancelDeliveryModalProps {
  deliveryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void;
}

interface PenaltyInfo {
  success: boolean;
  can_cancel: boolean;
  message: string;
  total_amount: number;
  penalty_rate: number;
  penalty_amount: number;
  refund_amount: number;
  driver_share: number;
  platform_share: number;
  status: string;
  is_additional?: boolean;
  child_deliveries_count?: number;
  error?: string;
}

export function CancelDeliveryModal({
  deliveryId,
  open,
  onOpenChange,
  onCancelled,
}: CancelDeliveryModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingPenalty, setIsFetchingPenalty] = useState(false);
  const [penaltyInfo, setPenaltyInfo] = useState<PenaltyInfo | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  useEffect(() => {
    if (open && deliveryId) {
      fetchPenaltyInfo();
    }
  }, [open, deliveryId]);

  const fetchPenaltyInfo = async () => {
    setIsFetchingPenalty(true);
    try {
      const { data, error } = await supabase
        .rpc('calculate_cancellation_penalty', { p_delivery_id: deliveryId });

      if (error) throw error;
      setPenaltyInfo(data as unknown as PenaltyInfo);
    } catch (error: any) {
      console.error('Error fetching penalty info:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível calcular a multa de cancelamento.',
      });
    } finally {
      setIsFetchingPenalty(false);
    }
  };

  const handleCancel = async () => {
    setIsLoading(true);

    try {
      const { data: rawResult, error } = await supabase
        .rpc('refund_delivery_funds', { 
          p_delivery_id: deliveryId,
          p_cancellation_reason: cancellationReason || 'Cancelado pelo solicitante'
        });

      if (error) throw error;
      
      const result = rawResult as { 
        success: boolean; 
        error?: string; 
        refunded_amount?: number;
        penalty_amount?: number;
      } | null;

      if (!result?.success) {
        throw new Error(result?.error || 'Erro ao cancelar entrega');
      }

      const hasPenalty = (result.penalty_amount ?? 0) > 0;
      
      toast({
        title: 'Entrega cancelada',
        description: hasPenalty
          ? `Multa de R$ ${result.penalty_amount?.toFixed(2)} aplicada. Estorno de R$ ${result.refunded_amount?.toFixed(2)}.`
          : `Seu saldo de R$ ${result.refunded_amount?.toFixed(2)} foi estornado integralmente.`,
      });

      onCancelled();
    } catch (error: any) {
      console.error('Error cancelling delivery:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao cancelar',
        description: error.message || 'Não foi possível cancelar a entrega. Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getPenaltyColor = () => {
    if (!penaltyInfo) return '';
    if (penaltyInfo.penalty_rate === 0) return 'text-green-600';
    if (penaltyInfo.penalty_rate <= 0.2) return 'text-amber-600';
    return 'text-red-600';
  };

  const getStatusLabel = () => {
    if (!penaltyInfo) return '';
    switch (penaltyInfo.status) {
      case 'pending': return 'Aguardando entregador';
      case 'accepted': return 'Entregador aceitou';
      case 'picking_up': return 'Entregador a caminho';
      case 'picked_up': return 'Coleta realizada';
      case 'delivering': return 'Em rota de entrega';
      default: return penaltyInfo.status;
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setCancellationReason('');
    }
    onOpenChange(open);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <AlertDialogTitle className="text-left">
              Cancelar entrega?
            </AlertDialogTitle>
          </div>
        </AlertDialogHeader>

        {isFetchingPenalty ? (
          <div className="py-6 flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Calculando valores...</p>
          </div>
        ) : penaltyInfo ? (
          <div className="space-y-4">
            {/* Não pode cancelar */}
            {!penaltyInfo.can_cancel ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-destructive font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {penaltyInfo.message}
                </p>
              </div>
            ) : (
              <>
                {/* Tipo de entrega */}
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {penaltyInfo.is_additional ? 'Entrega Adicional' : 'Entrega Principal'}
                  </span>
                  {penaltyInfo.is_additional && (
                    <Badge variant="outline" className="text-xs">Batch</Badge>
                  )}
                </div>

                {/* Status atual */}
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Status atual</p>
                  <p className="font-medium">{getStatusLabel()}</p>
                  <p className={`text-sm ${getPenaltyColor()}`}>{penaltyInfo.message}</p>
                </div>

            {/* Breakdown financeiro */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Valor total da entrega</span>
                </div>
                <span className="font-medium">R$ {penaltyInfo.total_amount.toFixed(2)}</span>
              </div>

              {penaltyInfo.penalty_amount > 0 && (
                <div className="flex items-center justify-between text-destructive">
                  <div className="flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    <span className="text-sm">
                      Multa ({(penaltyInfo.penalty_rate * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <span className="font-medium">- R$ {penaltyInfo.penalty_amount.toFixed(2)}</span>
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Valor a ser estornado</span>
                </div>
                <span className="font-bold text-green-600">
                  R$ {penaltyInfo.refund_amount.toFixed(2)}
                </span>
              </div>
            </div>

                {/* Aviso sobre entregas vinculadas */}
                {(penaltyInfo.child_deliveries_count ?? 0) > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 rounded-lg p-3">
                    <p className="text-sm text-yellow-800 dark:text-yellow-400 flex items-center gap-2">
                      <Link2 className="w-4 h-4" />
                      <strong>{penaltyInfo.child_deliveries_count}</strong> entrega(s) adicional(is) também será(ão) cancelada(s) automaticamente
                    </p>
                  </div>
                )}

                {/* Campo de motivo */}
                <div className="space-y-2">
                  <Label htmlFor="cancellation-reason" className="text-sm">
                    Motivo do cancelamento (opcional)
                  </Label>
                  <Textarea
                    id="cancellation-reason"
                    placeholder="Informe o motivo do cancelamento..."
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                </div>

                <AlertDialogDescription className="text-left pt-2">
                  {penaltyInfo.penalty_amount > 0 
                    ? 'Ao confirmar, a multa será aplicada e o restante será estornado ao seu saldo.'
                    : 'Ao confirmar, o valor total será estornado ao seu saldo. Esta ação não pode ser desfeita.'}
                </AlertDialogDescription>
              </>
            )}
          </div>
        ) : (
          <AlertDialogDescription className="text-left pt-2">
            Tem certeza que deseja cancelar esta entrega? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        )}

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel disabled={isLoading} className="w-full sm:w-auto">
            Voltar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleCancel();
            }}
            disabled={isLoading || isFetchingPenalty || (penaltyInfo && !penaltyInfo.can_cancel)}
            className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cancelando...
              </>
            ) : (
              'Sim, cancelar entrega'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
