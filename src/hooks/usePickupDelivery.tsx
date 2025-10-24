import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface UsePickupDeliveryParams {
  onSuccess?: (deliveryId: string) => void;
  onError?: (error: Error) => void;
}

export const usePickupDelivery = ({ onSuccess, onError }: UsePickupDeliveryParams = {}) => {
  const [loading, setLoading] = useState(false);

  const pickupDelivery = async (deliveryId: string, driverId: string) => {
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('pickup-delivery', {
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
        title: '📦 Pedido coletado!',
        description: 'Status atualizado. Agora siga para o endereço de entrega.',
      });

      onSuccess?.(deliveryId);

      return { success: true, delivery: data.delivery };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Não foi possível atualizar o status';
      
      console.error('Error picking up delivery:', error);

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
    pickupDelivery,
    loading
  };
};
