import { useState } from 'react';
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
import { Loader2, AlertTriangle } from 'lucide-react';

interface CancelDeliveryModalProps {
  deliveryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: () => void;
}

export function CancelDeliveryModal({
  deliveryId,
  open,
  onOpenChange,
  onCancelled,
}: CancelDeliveryModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleCancel = async () => {
    setIsLoading(true);

    try {
      // Use the refund function to handle escrow refund
      const { data: rawResult, error } = await supabase
        .rpc('refund_delivery_funds', { p_delivery_id: deliveryId });

      if (error) throw error;
      
      const result = rawResult as { success: boolean; error?: string; refunded_amount?: number } | null;

      if (!result?.success) {
        throw new Error(result?.error || 'Erro ao cancelar entrega');
      }

      toast({
        title: 'Entrega cancelada',
        description: `Seu saldo de R$ ${result.refunded_amount?.toFixed(2)} foi estornado.`,
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

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
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
          <AlertDialogDescription className="text-left pt-2">
            Tem certeza que deseja cancelar esta entrega? Esta ação não pode ser desfeita e a entrega será removida da lista de disponíveis.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel disabled={isLoading} className="w-full sm:w-auto">
            Voltar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleCancel();
            }}
            disabled={isLoading}
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
