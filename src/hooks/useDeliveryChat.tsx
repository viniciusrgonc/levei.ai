import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  id: string;
  delivery_id: string;
  sender_id: string;
  sender_role: 'driver' | 'restaurant';
  message: string;
  read_at: string | null;
  created_at: string;
}

async function fetchMessages(deliveryId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('delivery_messages')
    .select('*')
    .eq('delivery_id', deliveryId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as ChatMessage[]) || [];
}

export function useDeliveryChat(deliveryId: string, senderRole: 'driver' | 'restaurant') {
  const queryClient = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['delivery-chat', deliveryId],
    queryFn: () => fetchMessages(deliveryId),
    enabled: !!deliveryId,
    staleTime: 0,
  });

  // Realtime: escuta novas mensagens
  useEffect(() => {
    if (!deliveryId) return;

    const channel = supabase
      .channel(`chat-${deliveryId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'delivery_messages',
          filter: `delivery_id=eq.${deliveryId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['delivery-chat', deliveryId] });
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [deliveryId, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('delivery_messages').insert({
        delivery_id: deliveryId,
        sender_id: user.id,
        sender_role: senderRole,
        message: message.trim(),
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-chat', deliveryId] });
    },
  });

  return { messages, isLoading, sendMessage };
}
