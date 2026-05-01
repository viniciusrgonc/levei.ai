import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface UseAddFundsParams {
  onSuccess?: (newBalance: number) => void;
  onError?: (error: Error) => void;
}

export const useAddFunds = ({ onSuccess, onError }: UseAddFundsParams = {}) => {
  const [loading, setLoading] = useState(false);

  const addFunds = async (restaurantId: string, amount: number) => {
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('add_restaurant_funds', {
        p_restaurant_id: restaurantId,
        p_amount: amount
      });

      if (error) {
        throw error;
      }

      const result = data as { success: boolean; new_balance: number; error?: string };

      if (result?.error) {
        throw new Error(result.error);
      }

      toast({
        title: '💰 Saldo adicionado!',
        description: `R$ ${amount.toFixed(2)} foram creditados na sua carteira`,
      });

      onSuccess?.(result.new_balance);

      return { success: true, newBalance: result.new_balance };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Não foi possível adicionar saldo';
      
      console.error('Error adding funds:', error);

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
    addFunds,
    loading
  };
};
