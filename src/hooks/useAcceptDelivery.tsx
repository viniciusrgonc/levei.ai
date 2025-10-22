import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface UseAcceptDeliveryParams {
  onSuccess?: (deliveryId: string) => void;
  onError?: (error: Error) => void;
}

export const useAcceptDelivery = ({ onSuccess, onError }: UseAcceptDeliveryParams = {}) => {
  const [loading, setLoading] = useState(false);

  const acceptDelivery = async (deliveryId: string, driverId: string) => {
    setLoading(true);

    try {
      // Chama a Edge Function accept-delivery
      const { data, error } = await supabase.functions.invoke('accept-delivery', {
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

      // Toast de sucesso
      toast({
        title: 'Entrega aceita!',
        description: 'Você aceitou esta entrega com sucesso.',
      });

      // Callback de sucesso
      onSuccess?.(deliveryId);

      return { success: true, delivery: data.delivery };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Não foi possível aceitar a entrega';
      
      console.error('Error accepting delivery:', error);

      // Toast de erro
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });

      // Callback de erro
      if (error instanceof Error) {
        onError?.(error);
      }

      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return {
    acceptDelivery,
    loading
  };
};
