import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  parseEdgeFunctionResponse, 
  isSessionExpired,
  StandardResponse 
} from '@/lib/edgeFunctionResponse';

interface UseAcceptDeliveryParams {
  onSuccess?: (deliveryId: string) => void;
  onError?: (error: { code: string; message: string }) => void;
  onSessionExpired?: () => void;
}

export const useAcceptDelivery = ({ 
  onSuccess, 
  onError,
  onSessionExpired 
}: UseAcceptDeliveryParams = {}) => {
  const [loading, setLoading] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const handleError = (response: StandardResponse) => {
    const code = response.code || 'UNKNOWN';
    const message = response.message || 'Não foi possível aceitar a entrega';

    // Specific user-friendly messages based on code
    switch (code) {
      case 'DELIVERY_ALREADY_ACCEPTED':
        toast({
          title: 'Entrega indisponível',
          description: 'Esta entrega já foi aceita por outro entregador.',
        });
        break;
      case 'DELIVERY_UNAVAILABLE':
        toast({
          title: 'Entrega indisponível',
          description: 'Esta entrega não está mais disponível.',
        });
        break;
      case 'OUT_OF_RADIUS':
        toast({
          title: 'Fora do raio',
          description: message,
        });
        break;
      default:
        // Only show toast if ui_behavior is 'toast'
        if (response.ui_behavior === 'toast') {
          toast({
            title: 'Aviso',
            description: message,
          });
        }
    }

    onError?.({ code, message });
  };

  const acceptDelivery = useCallback(async (deliveryId: string, driverId: string) => {
    if (loading) {
      console.log('[useAcceptDelivery] Already processing, ignoring duplicate call');
      return { success: false };
    }

    setLoading(true);
    setAcceptingId(deliveryId);

    try {
      // Get current session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData.session?.access_token) {
        toast({
          title: '⚠️ Sessão expirada',
          description: 'Faça login novamente.',
          variant: 'destructive',
        });
        onSessionExpired?.();
        return { success: false };
      }

      console.log('[useAcceptDelivery] Calling accept-delivery function', { deliveryId, driverId });

      // Call edge function with auth header
      const { data, error: invokeError } = await supabase.functions.invoke('accept-delivery', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: { 
          delivery_id: deliveryId, 
          driver_id: driverId 
        }
      });

      // Parse standardized response (always HTTP 200 now)
      const response = parseEdgeFunctionResponse(data);

      // Handle network errors (rare with new pattern)
      if (invokeError) {
        console.error('[useAcceptDelivery] Network error:', invokeError);
        toast({
          title: 'Erro de conexão',
          description: 'Verifique sua internet e tente novamente.',
        });
        onError?.({ code: 'NETWORK_ERROR', message: invokeError.message });
        return { success: false };
      }

      // Handle session expired
      if (isSessionExpired(response)) {
        toast({
          title: '⚠️ Sessão expirada',
          description: response.message || 'Faça login novamente.',
          variant: 'destructive',
        });
        onSessionExpired?.();
        return { success: false };
      }

      // Handle errors
      if (!response.success) {
        handleError(response);
        return { success: false };
      }

      // Success (including idempotent case)
      console.log('[useAcceptDelivery] Delivery accepted successfully');
      
      toast({
        title: '🎉 Entrega aceita!',
        description: response.message || 'Vá até o local de coleta.',
      });
      
      onSuccess?.(deliveryId);
      
      return { 
        success: true, 
        delivery: response.data?.delivery
      };

    } catch (err) {
      console.error('[useAcceptDelivery] Unexpected error:', err);
      
      toast({
        title: 'Erro inesperado',
        description: 'Tente novamente em alguns instantes.',
      });
      
      const message = err instanceof Error ? err.message : 'Erro inesperado';
      onError?.({ code: 'UNEXPECTED_ERROR', message });
      return { success: false };

    } finally {
      setLoading(false);
      setAcceptingId(null);
    }
  }, [loading, onSuccess, onError, onSessionExpired]);

  return {
    acceptDelivery,
    loading,
    acceptingId,
  };
};
