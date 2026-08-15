import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
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
  /** Chamado quando o pacote já foi coletado e devolução é obrigatória (driver deve ir para tela de retorno) */
  onReturnRequired?: () => void;
  /** Quem está cancelando. Afeta: motivo padrão, quem é notificado. Default: 'restaurant' */
  cancellerRole?: 'restaurant' | 'driver';
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
  onReturnRequired,
  cancellerRole = 'restaurant',
}: CancelDeliveryModalProps) {
  const { user } = useAuth();
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
      const defaultReason = cancellerRole === 'driver'
        ? 'Cancelado pelo entregador'
        : 'Cancelado pelo solicitante';

      // Busca dados da entrega SEM joins embarcados para evitar falha silenciosa de RLS
      const { data: deliveryData } = await supabase
        .from('deliveries')
        .select('driver_id, restaurant_id, picked_up_at, status')
        .eq('id', deliveryId)
        .maybeSingle();

      const fromStatus = (deliveryData as any)?.status ?? 'unknown';

      // Busca user_id do driver e restaurante separadamente (evita bloqueio de RLS via join)
      let driverUserId: string | undefined;
      if (deliveryData?.driver_id) {
        const { data: dr } = await supabase
          .from('drivers').select('user_id').eq('id', deliveryData.driver_id).maybeSingle();
        driverUserId = dr?.user_id as string | undefined;
      }
      let restaurantUserId: string | undefined;
      if (deliveryData?.restaurant_id) {
        const { data: re } = await supabase
          .from('restaurants').select('user_id').eq('id', deliveryData.restaurant_id).maybeSingle();
        restaurantUserId = re?.user_id as string | undefined;
      }

      const { data: rawResult, error } = await supabase
        .rpc('refund_delivery_funds', {
          p_delivery_id: deliveryId,
          p_cancellation_reason: cancellationReason || defaultReason,
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

      // ── Regra de devolução: pacote já coletado? ────────────────────────────
      // Usa picked_up_at E status como fallback (caso picked_up_at seja null por inconsistência)
      const wasPickedUp = !!(deliveryData as any)?.picked_up_at ||
        ['picked_up', 'delivering', 'returning'].includes(fromStatus);

      if (wasPickedUp) {
        // Sobrescreve o status 'cancelled' da RPC — devolução obrigatória
        await supabase
          .from('deliveries')
          .update({
            status: 'cancelled_return_pending',
            cancelled_by_role: cancellerRole,
            cancelled_by_user_id: user?.id ?? null,
          } as any)
          .eq('id', deliveryId);

        // Registra no histórico de auditoria
        supabase
          .from('delivery_status_history' as any)
          .insert({
            delivery_id: deliveryId,
            from_status: fromStatus,
            to_status: 'cancelled_return_pending',
            changed_by: user?.id ?? null,
            changed_by_role: cancellerRole,
            reason: cancellationReason || defaultReason,
          })
          .catch(() => {});

        if (cancellerRole === 'driver') {
          // Driver cancelou → notifica restaurante + driver vai para tela de devolução
          if (restaurantUserId) {
            supabase.rpc('create_notification', {
              p_user_id: restaurantUserId,
              p_title: 'Entrega cancelada — pacote em devolução',
              p_message: 'O entregador cancelou após coletar o pacote. Ele está retornando ao seu local.',
              p_type: 'delivery_cancelled',
              p_delivery_id: deliveryId,
            }).catch(() => {});
            supabase.functions.invoke('send-push', {
              body: {
                user_id: restaurantUserId,
                title: 'Pacote sendo devolvido',
                message: 'O entregador cancelou após coletar. Ele está retornando o pacote.',
                url: '/restaurant/dashboard',
              },
            }).catch(() => {});
          }

          toast({
            title: 'Entrega cancelada',
            description: 'Você está com o pacote. Retorne ao local de coleta para devolvê-lo.',
          });

          if (onReturnRequired) {
            onReturnRequired();
          } else {
            onCancelled();
          }
        } else {
          // Restaurante cancelou → notifica driver que deve devolver
          if (driverUserId) {
            supabase.rpc('create_notification', {
              p_user_id: driverUserId,
              p_title: '⚠️ Devolva o pacote',
              p_message: 'O solicitante cancelou a entrega. Você está com o pacote — retorne ao local de coleta imediatamente.',
              p_type: 'delivery_cancelled',
              p_delivery_id: deliveryId,
            }).catch(() => {});
            supabase.functions.invoke('send-push', {
              body: {
                user_id: driverUserId,
                title: '⚠️ Devolva o pacote',
                message: 'Entrega cancelada. Retorne o pacote ao local de coleta.',
                url: `/driver/return-cancel/${deliveryId}`,
              },
            }).catch(() => {});
          }

          toast({
            title: 'Entrega cancelada',
            description: 'O entregador está com o pacote e foi notificado para devolvê-lo.',
          });
          onCancelled();
        }
      } else {
        // ── Cancelamento antes da coleta — fluxo normal ──────────────────────
        // Registra status explícito cancelled_before_pickup no histórico
        supabase
          .from('delivery_status_history' as any)
          .insert({
            delivery_id: deliveryId,
            from_status: fromStatus,
            to_status: 'cancelled_before_pickup',
            changed_by: user?.id ?? null,
            changed_by_role: cancellerRole,
            reason: cancellationReason || defaultReason,
          })
          .catch(() => {});

        if (cancellerRole === 'driver') {
          if (restaurantUserId) {
            supabase.rpc('create_notification', {
              p_user_id: restaurantUserId,
              p_title: 'Entrega cancelada pelo motoboy',
              p_message: 'O entregador cancelou a coleta. Sua entrega voltou para fila.',
              p_type: 'delivery_cancelled',
              p_delivery_id: deliveryId,
            }).catch(() => {});
            supabase.functions.invoke('send-push', {
              body: {
                user_id: restaurantUserId,
                title: 'Entrega cancelada pelo motoboy',
                message: 'O entregador cancelou. Sua entrega será redistribuída.',
                url: '/restaurant/dashboard',
              },
            }).catch(() => {});
          }
        } else {
          if (driverUserId) {
            supabase.rpc('create_notification', {
              p_user_id: driverUserId,
              p_title: 'Entrega cancelada',
              p_message: 'O restaurante cancelou uma entrega que estava sob sua responsabilidade.',
              p_type: 'delivery_cancelled',
              p_delivery_id: deliveryId,
            }).catch(() => {});
            supabase.functions.invoke('send-push', {
              body: {
                user_id: driverUserId,
                title: 'Entrega cancelada',
                message: 'O restaurante cancelou a entrega. Verifique seu painel.',
                url: '/driver/dashboard',
              },
            }).catch(() => {});
          }
        }

        const hasPenalty = (result.penalty_amount ?? 0) > 0;
        toast({
          title: 'Entrega cancelada',
          description: hasPenalty
            ? `Multa de R$ ${result.penalty_amount?.toFixed(2)} aplicada. Estorno de R$ ${result.refunded_amount?.toFixed(2)}.`
            : `Seu saldo de R$ ${result.refunded_amount?.toFixed(2)} foi estornado integralmente.`,
        });
        onCancelled();
      }
    } catch (error: any) {
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
              {cancellerRole === 'driver' ? 'Desistir da entrega?' : 'Cancelar entrega?'}
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
                    ? cancellerRole === 'driver'
                      ? 'Ao desistir, uma multa será retida. O restaurante será notificado e a entrega voltará para a fila.'
                      : 'Ao confirmar, a multa será aplicada e o restante será estornado ao seu saldo.'
                    : cancellerRole === 'driver'
                      ? 'Ao desistir, o valor será integralmente estornado ao restaurante. Esta ação não pode ser desfeita.'
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
