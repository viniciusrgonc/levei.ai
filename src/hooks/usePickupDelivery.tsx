import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  parseEdgeFunctionResponse,
  isSessionExpired,
  validateDeliveryAction,
} from '@/lib/edgeFunctionResponse';

interface UsePickupDeliveryParams {
  onSuccess?: (deliveryId: string) => void;
  onError?: (error: Error) => void;
  onSessionExpired?: () => void;
}

export const usePickupDelivery = ({ 
  onSuccess, 
  onError,
  onSessionExpired 
}: UsePickupDeliveryParams = {}) => {
  const [loading, setLoading] = useState(false);

  const pickupDelivery = async (deliveryId: string, driverId: string) => {
    setLoading(true);

    try {
      // Validação Zod antes de chamar a edge function
      const validation = validateDeliveryAction(deliveryId, driverId);
      if (!validation.ok) {
        toast({ title: 'Dados inválidos', description: validation.error, variant: 'destructive' });
        return { success: false };
      }

      const { data, error: invokeError } = await supabase.functions.invoke('pickup-delivery', {
        body: {
          delivery_id: deliveryId,
          driver_id: driverId
        }
      });

      // Parse standardized response
      const response = parseEdgeFunctionResponse(data);

      // Handle invoke errors (network, etc)
      if (invokeError) {
        console.error('Network error picking up delivery:', invokeError);
        toast({
          title: 'Erro de conexão',
          description: 'Verifique sua internet e tente novamente.',
        });
        onError?.(new Error(invokeError.message));
        return { success: false, error: invokeError.message };
      }

      // Handle session expired
      if (isSessionExpired(response)) {
        toast({
          title: '⚠️ Sessão expirada',
          description: response.message || 'Faça login novamente.',
          variant: 'destructive',
        });
        onSessionExpired?.();
        return { success: false, error: response.message };
      }

      // Handle already picked up (idempotent) - treat as success
      if (response.data?.already_picked_up || response.data?.already_completed) {
        toast({
          title: '✅ Coleta confirmada',
          description: response.message || 'Siga para o destino.',
        });
        onSuccess?.(deliveryId);
        return { success: true, delivery: response.data?.delivery };
      }

      // Handle other errors
      if (!response.success) {
        if (response.ui_behavior === 'toast') {
          toast({
            title: 'Aviso',
            description: response.message || 'Não foi possível confirmar a coleta.',
          });
        }
        return { success: false, error: response.message };
      }

      // Success!
      toast({
        title: '📦 Pedido coletado!',
        description: response.message || 'Status atualizado. Siga para o endereço de entrega.',
      });

      if (onSuccess) {
        setTimeout(() => {
          onSuccess(deliveryId);
        }, 100);
      }

      return { success: true, delivery: response.data?.delivery };

    } catch (error) {
      console.error('Unexpected error picking up delivery:', error);
      
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
    pickupDelivery,
    loading
  };
};
