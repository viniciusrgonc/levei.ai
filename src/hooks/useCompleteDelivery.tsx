import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface UseCompleteDeliveryParams {
  onSuccess?: (deliveryId: string, price: number) => void;
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

      toast({
        title: '🎉 Entrega concluída!',
        description: `Status atualizado. Você ganhou R$ ${price.toFixed(2)}`,
      });

      onSuccess?.(deliveryId, price);

      return { success: true, delivery: data.delivery };
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
