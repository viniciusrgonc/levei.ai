import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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
}

export const useCompleteDelivery = ({ onSuccess, onError }: UseCompleteDeliveryParams = {}) => {
  const [loading, setLoading] = useState(false);

  const completeDelivery = async (deliveryId: string, driverId: string, price: number) => {
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('complete-delivery', {
        body: {
          delivery_id: deliveryId,
          driver_id: driverId
        }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const transaction = data.transaction as TransactionResult | undefined;
      const isLastDelivery = transaction?.is_last_delivery ?? true;
      const earnings = transaction?.driver_earnings ?? price * 0.80;
      const totalRouteEarnings = transaction?.total_route_earnings ?? earnings;
      
      // Show appropriate message based on batch status
      if (isLastDelivery && totalRouteEarnings > 0) {
        toast({
          title: '🎉 Rota concluída!',
          description: `Parabéns! R$ ${totalRouteEarnings.toFixed(2)} foi creditado na sua carteira.`,
        });
      } else {
        toast({
          title: '✅ Entrega concluída!',
          description: `Continue para a próxima entrega da rota.`,
        });
      }

      onSuccess?.(deliveryId, price, transaction);

      return { success: true, delivery: data.delivery, transaction };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Não foi possível atualizar o status';
      
      console.error('Error completing delivery:', error);

      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });

      if (error instanceof Error) {
        onError?.(error);
      }

      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return {
    completeDelivery,
    loading
  };
};
