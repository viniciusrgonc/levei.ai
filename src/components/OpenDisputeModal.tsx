import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from '@/hooks/use-toast';
import { AlertTriangle, X, Loader2, ChevronDown } from 'lucide-react';

const DISPUTE_REASONS = [
  'Produto danificado',
  'Entregador não compareceu',
  'Produto errado entregue',
  'Atraso excessivo',
  'Comportamento inadequado',
  'Cobrança incorreta',
  'Problema com pagamento',
  'Outro',
];

interface OpenDisputeModalProps {
  deliveryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpened?: () => void;
}

export function OpenDisputeModal({
  deliveryId,
  open,
  onOpenChange,
  onOpened,
}: OpenDisputeModalProps) {
  const { user } = useAuth();
  const [reason, setReason]           = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading]         = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!reason) {
      toast({ variant: 'destructive', title: 'Selecione um motivo' });
      return;
    }
    if (!description.trim()) {
      toast({ variant: 'destructive', title: 'Descreva o problema' });
      return;
    }
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('disputes').insert({
        delivery_id:  deliveryId,
        reported_by:  user.id,
        reason,
        description:  description.trim(),
        status:       'open',
      });
      if (error) throw error;

      toast({
        title:       '📋 Disputa aberta!',
        description: 'Nossa equipe analisará em até 24 horas.',
      });
      setReason('');
      setDescription('');
      onOpenChange(false);
      onOpened?.();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao abrir disputa', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Sheet */}
      <div className="relative w-full bg-white rounded-t-3xl shadow-2xl"
        style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}>

        {/* Drag handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-4" />

        <div className="px-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 text-base leading-tight">Abrir disputa</h2>
                <p className="text-xs text-gray-500">Nossa equipe responderá em até 24h</p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"
            >
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Motivo *
            </label>
            <div className="relative">
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-11 px-4 pr-10 rounded-xl border border-gray-200 text-sm appearance-none bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
              >
                <option value="">Selecione o motivo...</option>
                {DISPUTE_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Descrição *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              placeholder="Descreva o ocorrido com o máximo de detalhes possível..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50 resize-none focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400 leading-relaxed"
            />
            <p className="text-right text-[10px] text-gray-400">
              {description.length}/500
            </p>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full h-12 rounded-2xl bg-orange-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-transform"
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" />Enviando...</>
              : '📋 Enviar disputa'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
