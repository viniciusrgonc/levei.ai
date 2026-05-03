import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Send, MessageCircle } from 'lucide-react';
import { useDeliveryChat } from '@/hooks/useDeliveryChat';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import leveiLogo from '@/assets/levei-logo.png';

export default function DeliveryChat() {
  const { deliveryId } = useParams<{ deliveryId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // role vem da URL: ?role=driver ou ?role=restaurant
  const role = (searchParams.get('role') || 'driver') as 'driver' | 'restaurant';

  const [text, setText] = useState('');
  const [otherName, setOtherName] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, isLoading, sendMessage } = useDeliveryChat(deliveryId || '', role);

  // Busca o nome da outra parte
  useEffect(() => {
    if (!deliveryId) return;

    const fetchOtherParty = async () => {
      const { data: delivery } = await supabase
        .from('deliveries')
        .select('restaurant_id, driver_id')
        .eq('id', deliveryId)
        .single();

      if (!delivery) return;

      if (role === 'driver' && delivery.restaurant_id) {
        const { data } = await supabase
          .from('restaurants')
          .select('name')
          .eq('id', delivery.restaurant_id)
          .single();
        setOtherName(data?.name || 'Restaurante');
      } else if (role === 'restaurant' && delivery.driver_id) {
        const { data: driverData } = await supabase
          .from('drivers')
          .select('user_id')
          .eq('id', delivery.driver_id)
          .single();
        if (driverData?.user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', driverData.user_id)
            .single();
          setOtherName(profile?.full_name || 'Entregador');
        }
      }
    };

    fetchOtherParty();
  }, [deliveryId, role]);

  // Auto-scroll para o final ao receber novas mensagens
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sendMessage.isPending) return;
    setText('');
    await sendMessage.mutateAsync(trimmed);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Hoje';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  // Agrupa mensagens por data
  const groupedMessages: { date: string; msgs: typeof messages }[] = [];
  messages.forEach((msg) => {
    const date = formatDate(msg.created_at);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last && last.date === date) {
      last.msgs.push(msg);
    } else {
      groupedMessages.push({ date, msgs: [msg] });
    }
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <div className="bg-primary flex-shrink-0">
        <div
          className="flex items-center gap-3 px-4 pb-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
        >
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <img src={leveiLogo} alt="Levei" className="h-8 w-8 rounded-lg object-cover flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">
              {otherName || (role === 'driver' ? 'Restaurante' : 'Entregador')}
            </p>
            <p className="text-white/60 text-xs">Chat da entrega</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <MessageCircle className="h-4 w-4 text-white" />
          </div>
        </div>
      </div>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {isLoading ? (
          <div className="space-y-3 pt-4">
            <Skeleton className="h-10 w-3/4 rounded-2xl" />
            <Skeleton className="h-10 w-1/2 rounded-2xl ml-auto" />
            <Skeleton className="h-10 w-2/3 rounded-2xl" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full pt-16 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <MessageCircle className="h-8 w-8 text-primary" />
            </div>
            <p className="font-semibold text-gray-700 mb-1">Nenhuma mensagem ainda</p>
            <p className="text-sm text-gray-400">
              Inicie a conversa com {role === 'driver' ? 'o restaurante' : 'o entregador'}
            </p>
          </div>
        ) : (
          groupedMessages.map(({ date, msgs }) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium px-2">{date}</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {msgs.map((msg) => {
                const isMe = msg.sender_role === role;
                return (
                  <div
                    key={msg.id}
                    className={`flex mb-2 ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] px-4 py-2.5 rounded-2xl shadow-sm ${
                        isMe
                          ? 'bg-primary text-white rounded-br-sm'
                          : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'
                      }`}
                    >
                      <p className="text-sm leading-relaxed break-words">{msg.message}</p>
                      <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </main>

      {/* Input */}
      <div
        className="bg-white border-t border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
      >
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem..."
          className="flex-1 bg-gray-100 rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-gray-400"
          maxLength={500}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sendMessage.isPending}
          className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity active:scale-95"
        >
          <Send className="h-4 w-4 text-white" />
        </button>
      </div>
    </div>
  );
}
