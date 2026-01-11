import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  parseEdgeFunctionResponse, 
  isSessionExpired, 
  isAlreadyCompleted 
} from '@/lib/edgeFunctionResponse';

interface TransactionResult {
  total_amount: number;
  driver_earnings: number;
  platform_fee: number;
  is_last_delivery: boolean;
  total_route_earnings: number;
  new_driver_balance: number;
}

interface UseCompleteDeliveryParams {
  onSuccess?: (deliveryId: string, price: number, transaction?: TransactionResult) => void;
  onError?: (error: Error) => void;
  onSessionExpired?: () => void;
}

export const useCompleteDelivery = ({ 
  onSuccess, 
  onError,
  onSessionExpired 
}: UseCompleteDeliveryParams = {}) => {
  const [loading, setLoading] = useState(false);

  const completeDelivery = async (deliveryId: string, driverId: string, price: number) => {
    setLoading(true);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('complete-delivery', {
        body: {
          delivery_id: deliveryId,
          driver_id: driverId
        }
      });

      // Parse standardized response
      const response = parseEdgeFunctionResponse(data);

      // Handle invoke errors (network, etc) - should be rare with new pattern
      if (invokeError) {
        console.error('Network error completing delivery:', invokeError);
        toast({
          title: 'Erro de conexão',
          description: 'Verifique sua internet e tente novamente.',
        });
        onError?.(new Error(invokeError.message));
        return { success: false, error: invokeError.message };
      }

      // Handle session expired - requires user action
      if (isSessionExpired(response)) {
        toast({
          title: '⚠️ Sessão expirada',
          description: response.message || 'Faça login novamente.',
          variant: 'destructive',
        });
        onSessionExpired?.();
        return { success: false, error: response.message };
      }

      // Handle already completed (idempotent) - treat as success
      if (response.data?.already_completed) {
        toast({
          title: '✅ Entrega finalizada',
          description: response.message || 'Entrega já estava concluída.',
        });
        onSuccess?.(deliveryId, price);
        return { success: true, delivery: response.data?.delivery };
      }

      // Handle other errors with toast based on ui_behavior
      if (!response.success) {
        if (response.ui_behavior === 'toast') {
          toast({
            title: 'Aviso',
            description: response.message || 'Não foi possível finalizar a entrega.',
          });
        } else if (response.ui_behavior === 'silent') {
          console.log('Silent error:', response.code, response.message);
        }
        // Don't show error toast for silent or already-handled cases
        return { success: false, error: response.message };
      }

      // Success!
      const transaction = response.data?.transaction as TransactionResult | undefined;
      const isLastDelivery = transaction?.is_last_delivery ?? true;
      const totalRouteEarnings = transaction?.total_route_earnings ?? transaction?.driver_earnings ?? price * 0.80;
      
      if (isLastDelivery && totalRouteEarnings > 0) {
        toast({
          title: '🎉 Rota concluída!',
          description: response.message || `Parabéns! R$ ${totalRouteEarnings.toFixed(2)} foi creditado na sua carteira.`,
        });
      } else {
        toast({
          title: '✅ Entrega concluída!',
          description: response.message || 'Continue para a próxima entrega da rota.',
        });
      }

      onSuccess?.(deliveryId, price, transaction);
      return { success: true, delivery: response.data?.delivery, transaction };

    } catch (error) {
      // This should be very rare with the new pattern
      console.error('Unexpected error completing delivery:', error);
      
      toast({
        title: 'Erro inesperado',
        description: 'Tente novamente em alguns instantes.',
      });

      if (error instanceof Error) {
        onError?.(error);
      }

      return { success: false, error: 'Erro inesperado' };
    } finally {
      setLoading(false);
    }
  };

  return {
    completeDelivery,
    loading
  };
};
