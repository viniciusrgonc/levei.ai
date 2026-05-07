import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import {
  AlertCircle, CheckCircle2, XCircle, Clock, Search,
  ChevronRight, MapPin, User, Calendar, X, Loader2,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Dispute {
  id: string;
  delivery_id: string;
  reported_by: string;
  reason: string;
  description: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  reporter_name: string;
  deliveries: {
    pickup_address: string;
    delivery_address: string;
  } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  open:     { label: 'Aberta',    color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  resolved: { label: 'Resolvida', color: 'bg-green-100 text-green-700',   icon: CheckCircle2 },
  rejected: { label: 'Rejeitada', color: 'bg-red-100 text-red-600',       icon: XCircle },
};

// ── Query ─────────────────────────────────────────────────────────────────────
async function fetchDisputes(): Promise<Dispute[]> {
  const { data, error } = await supabase
    .from('disputes')
    .select('*, deliveries(pickup_address, delivery_address)')
    .order('created_at', { ascending: false });
  if (error) throw error;

  // enrich with reporter names
  const enriched = await Promise.all(
    (data || []).map(async (d) => {
      const { data: p } = await supabase
        .from('profiles').select('full_name').eq('id', d.reported_by).single();
      return { ...d, reporter_name: p?.full_name ?? 'Usuário desconhecido' };
    })
  );
  return enriched as Dispute[];
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminDisputes() {
  const queryClient                             = useQueryClient();
  const [selected, setSelected]                 = useState<Dispute | null>(null);
  const [resolution, setResolution]             = useState('');
  const [search, setSearch]                     = useState('');
  const [filterStatus, setFilterStatus]         = useState<'all' | 'open' | 'resolved' | 'rejected'>('all');

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data: disputes = [], isLoading } = useQuery<Dispute[]>({
    queryKey: ['admin-disputes'],
    queryFn:  fetchDisputes,
    staleTime: 30 * 1000,
  });

  // ── Mutation ───────────────────────────────────────────────────────────────
  const resolveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'resolved' | 'rejected' }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('disputes').update({
        status,
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id ?? null,
        description: selected!.description + (resolution ? `\n\n[Admin]: ${resolution}` : ''),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast({ title: status === 'resolved' ? '✅ Disputa resolvida!' : '❌ Disputa rejeitada' });
      queryClient.invalidateQueries({ queryKey: ['admin-disputes'] });
      setSelected(null);
      setResolution('');
    },
    onError: () => toast({ title: 'Erro ao atualizar disputa', variant: 'destructive' }),
  });

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = disputes.filter((d) => {
    const matchStatus = filterStatus === 'all' || d.status === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q || d.reporter_name.toLowerCase().includes(q) || d.reason.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const openCount     = disputes.filter(d => d.status === 'open').length;
  const resolvedCount = disputes.filter(d => d.status === 'resolved').length;
  const rejectedCount = disputes.filter(d => d.status === 'rejected').length;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AdminSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <AdminPageHeader title="Disputas" showBack showLogout />

          <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-5xl mx-auto space-y-5">

              {/* ── KPI row ── */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Abertas',    count: openCount,     color: 'orange', status: 'open'     },
                  { label: 'Resolvidas', count: resolvedCount, color: 'green',  status: 'resolved' },
                  { label: 'Rejeitadas', count: rejectedCount, color: 'red',    status: 'rejected' },
                ].map(({ label, count, color, status }) => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(filterStatus === status ? 'all' : status as any)}
                    className={`bg-white rounded-2xl p-4 shadow-sm border-2 text-left transition-all ${
                      filterStatus === status ? `border-${color}-300` : 'border-transparent'
                    }`}
                  >
                    <p className={`text-2xl font-bold text-${color}-600`}>{count}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </button>
                ))}
              </div>

              {/* ── Search bar ── */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome ou motivo..."
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* ── List ── */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-16 text-center text-gray-400">
                    <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Nenhuma disputa encontrada</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {filtered.map((dispute) => {
                      const cfg = statusConfig[dispute.status] ?? statusConfig.open;
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={dispute.id}
                          onClick={() => { setSelected(dispute); setResolution(''); }}
                          className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                        >
                          {/* Icon */}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                            <Icon className="h-5 w-5" />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {dispute.reporter_name}
                              </p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.color}`}>
                                {cfg.label}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 truncate mt-0.5">{dispute.reason}</p>
                            <div className="flex items-center gap-1 mt-1">
                              <Calendar className="h-3 w-3 text-gray-300" />
                              <span className="text-[11px] text-gray-400">
                                {new Date(dispute.created_at).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </div>

                          <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </main>
        </div>
      </div>

      {/* ── Detail panel ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div>
                <h2 className="font-bold text-gray-900 text-base">Detalhes da disputa</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(selected.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Status badge */}
              {(() => {
                const cfg = statusConfig[selected.status] ?? statusConfig.open;
                const Icon = cfg.icon;
                return (
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${cfg.color}`}>
                    <Icon className="h-4 w-4" />
                    {cfg.label}
                  </div>
                );
              })()}

              {/* Reporter */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-[11px] text-gray-400 uppercase font-bold tracking-wide">Reportado por</p>
                    <p className="text-sm font-semibold text-gray-900">{selected.reporter_name}</p>
                  </div>
                </div>
                <div className="h-px bg-gray-200" />
                <div>
                  <p className="text-[11px] text-gray-400 uppercase font-bold tracking-wide mb-0.5">Motivo</p>
                  <p className="text-sm text-gray-800">{selected.reason}</p>
                </div>
                <div className="h-px bg-gray-200" />
                <div>
                  <p className="text-[11px] text-gray-400 uppercase font-bold tracking-wide mb-0.5">Descrição</p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{selected.description}</p>
                </div>
              </div>

              {/* Delivery addresses */}
              {selected.deliveries && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] text-gray-400 font-semibold">Coleta</p>
                      <p className="text-xs text-gray-700">{selected.deliveries.pickup_address}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[11px] text-gray-400 font-semibold">Destino</p>
                      <p className="text-xs text-gray-700">{selected.deliveries.delivery_address}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Resolution note (only for open) */}
              {selected.status === 'open' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">
                    Observações da resolução <span className="text-gray-400">(opcional)</span>
                  </label>
                  <textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="Adicione observações sobre a decisão..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm bg-gray-50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              )}

              {/* Actions */}
              {selected.status === 'open' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => resolveMutation.mutate({ id: selected.id, status: 'rejected' })}
                    disabled={resolveMutation.isPending}
                    className="flex-1 h-12 rounded-2xl border-2 border-red-200 text-red-500 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {resolveMutation.isPending
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <><XCircle className="h-4 w-4" />Rejeitar</>
                    }
                  </button>
                  <button
                    onClick={() => resolveMutation.mutate({ id: selected.id, status: 'resolved' })}
                    disabled={resolveMutation.isPending}
                    className="flex-1 h-12 rounded-2xl bg-green-500 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {resolveMutation.isPending
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <><CheckCircle2 className="h-4 w-4" />Resolver</>
                    }
                  </button>
                </div>
              )}

              {selected.status !== 'open' && selected.resolved_at && (
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-400">
                    {statusConfig[selected.status]?.label} em{' '}
                    {new Date(selected.resolved_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </SidebarProvider>
  );
}
