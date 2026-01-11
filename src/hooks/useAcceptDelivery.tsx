import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// Error codes from backend
const ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: 'Você precisa estar autenticado para aceitar entregas',
  INVALID_TOKEN: 'Sessão expirada. Faça login novamente.',
  INVALID_INPUT: 'Dados inválidos. Tente novamente.',
  DRIVER_NOT_FOUND: 'Conta de motorista não encontrada',
  UNAUTHORIZED_DRIVER: 'Você não tem permissão para aceitar entregas com esta conta',
  DELIVERY_NOT_FOUND: 'Entrega não encontrada',
  DELIVERY_ALREADY_ACCEPTED: 'Esta entrega já foi aceita por outro entregador',
  DELIVERY_UNAVAILABLE: 'Esta entrega não está mais disponível',
  DRIVER_HAS_ACTIVE_DELIVERY: 'Você já possui uma entrega ativa',
  OUT_OF_RADIUS: 'Você está fora do raio permitido para esta entrega',
  INTERNAL_ERROR: 'Erro interno. Tente novamente em alguns instantes.',
};

interface AcceptDeliveryResult {
  success: boolean;
  delivery?: { id: string };
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

interface UseAcceptDeliveryParams {
  onSuccess?: (deliveryId: string) => void;
  onError?: (error: { code: string; message: string }) => void;
}

export const useAcceptDelivery = ({ onSuccess, onError }: UseAcceptDeliveryParams = {}) => {
  const [loading, setLoading] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const getErrorMessage = (code: string, fallback: string): string => {
    return ERROR_MESSAGES[code] || fallback || 'Não foi possível aceitar a entrega';
  };

  const acceptDelivery = useCallback(async (deliveryId: string, driverId: string) => {
    if (loading) {
      console.log('[useAcceptDelivery] Already processing, ignoring duplicate call');
      return { success: false, error: { code: 'BUSY', message: 'Aguarde...' } };
    }

    setLoading(true);
    setAcceptingId(deliveryId);

    try {
      // Get current session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData.session?.access_token) {
        const error = { code: 'AUTH_REQUIRED', message: getErrorMessage('AUTH_REQUIRED', '') };
        toast({
          title: 'Sessão expirada',
          description: error.message,
          variant: 'destructive',
        });
        onError?.(error);
        return { success: false, error };
      }

      console.log('[useAcceptDelivery] Calling accept-delivery function', { deliveryId, driverId });

      // Call edge function with auth header
      const { data, error } = await supabase.functions.invoke<AcceptDeliveryResult>('accept-delivery', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: { 
          delivery_id: deliveryId, 
          driver_id: driverId 
        }
      });

      // Handle fetch/network errors
      if (error) {
        console.error('[useAcceptDelivery] Function invoke error:', error);
        
        // Parse error message if possible
        let errorCode = 'INTERNAL_ERROR';
        let errorMessage = 'Erro ao conectar com o servidor';
        
        if (error.message) {
          // Try to extract meaningful error from the message
          if (error.message.includes('401')) {
            errorCode = 'AUTH_REQUIRED';
            errorMessage = getErrorMessage('AUTH_REQUIRED', '');
          } else if (error.message.includes('403')) {
            errorCode = 'UNAUTHORIZED_DRIVER';
            errorMessage = getErrorMessage('UNAUTHORIZED_DRIVER', '');
          } else if (error.message.includes('409')) {
            errorCode = 'DELIVERY_ALREADY_ACCEPTED';
            errorMessage = getErrorMessage('DELIVERY_ALREADY_ACCEPTED', '');
          } else if (error.message.includes('non-2xx')) {
            // Generic edge function error - try to parse body
            errorMessage = 'Não foi possível aceitar a entrega. Tente novamente.';
          } else {
            errorMessage = error.message;
          }
        }

        const parsedError = { code: errorCode, message: errorMessage };
        
        toast({
          title: 'Erro',
          description: errorMessage,
          variant: 'destructive',
        });
        
        onError?.(parsedError);
        return { success: false, error: parsedError };
      }

      // Handle structured error response from edge function
      if (data && !data.success && data.error) {
        console.log('[useAcceptDelivery] Backend returned error:', data.error);
        
        const errorMessage = getErrorMessage(data.error.code, data.error.message);
        
        toast({
          title: 'Não foi possível aceitar',
          description: errorMessage,
          variant: 'destructive',
        });
        
        onError?.(data.error);
        return { success: false, error: data.error };
      }

      // Success!
      console.log('[useAcceptDelivery] Delivery accepted successfully:', data);
      
      toast({
        title: '✅ Entrega aceita!',
        description: data?.message || 'Vá até o ponto de coleta',
      });
      
      onSuccess?.(deliveryId);
      
      return { 
        success: true, 
        delivery: data?.delivery,
        message: data?.message 
      };

    } catch (err) {
      console.error('[useAcceptDelivery] Unexpected error:', err);
      
      const errorMessage = err instanceof Error ? err.message : 'Erro inesperado';
      const error = { code: 'INTERNAL_ERROR', message: errorMessage };
      
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive',
      });
      
      onError?.(error);
      return { success: false, error };

    } finally {
      setLoading(false);
      setAcceptingId(null);
    }
  }, [loading, onSuccess, onError]);

  return {
    acceptDelivery,
    loading,
    acceptingId,
  };
};
