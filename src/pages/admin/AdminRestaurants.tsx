import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminSidebar } from '@/components/AdminSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import {
  Search, MapPin, Phone, Star,
  Package, Loader2, Trash2, ChevronRight, Building2,
  CheckCircle2, Clock, Wallet, ShieldX, ShieldCheck,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Restaurant {
  id: string;
  user_id: string;
  business_name: string;
  cnpj: string | null;
  address: string;
  address_city: string | null;
  address_state: string | null;
  is_approved: boolean;
  is_blocked: boolean;
  block_reason: string | null;
  person_type: 'pf' | 'pj';
  company_name: string | null;
  fantasy_name: string | null;
  phone: string | null;
  rating: number;
  total_deliveries: number;
  wallet_balance: number;
  created_at: string;
  profile_name: string;
  profile_phone: string;
}

type FilterKey = 'all' | 'approved' | 'pending' | 'blocked';

function StatusBadge({ r }: { r: Restaurant }) {
  if (r.is_blocked) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">🚫 Bloqueado</span>;
  if (r.is_approved) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✅ Aprovado</span>;
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">⏳ Pendente</span>;
}

async function fetchRestaurants(): Promise<Restaurant[]> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, user_id, business_name, cnpj, address, address_city, address_state, is_approved, is_blocked, block_reason, person_type, company_name, fantasy_name, phone, rating, total_deliveries, wallet_balance, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const results = await Promise.all(
    (data || []).map(async (r) => {
      const { data: profile } = await supabase
        .from('profiles').select('full_name, phone').eq('id', r.user_id).maybeSingle();
      return {
        id: r.id, user_id: r.user_id,
        business_name: r.business_name, cnpj: r.cnpj || null,
        address: r.address, address_city: r.address_city || null, address_state: r.address_state || null,
        is_approved: r.is_approved, is_blocked: r.is_blocked ?? false, block_reason: r.block_reason || null,
        person_type: (r.person_type ?? 'pj') as 'pf' | 'pj',
        company_name: r.company_name || null, fantasy_name: r.fantasy_name || null, phone: r.phone || null,
        rating: r.rating || 0, total_deliveries: r.total_deliveries || 0,
        wallet_balance: r.wallet_balance || 0, created_at: r.created_at,
        profile_name: profile?.full_name || 'Sem nome', profile_phone: profile?.phone || '',
      } as Restaurant;
    })
  );
  return results;
}

export default function AdminRestaurants() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Restaurant | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [showBlockInput, setShowBlockInput] = useState(false);

  const { data: restaurants = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-restaurants'],
    queryFn: fetchRestaurants,
    staleTime: 60 * 1000,
  });

  const blockMutation = useMutation({
    mutationFn: async ({ id, block, reason }: { id: string; block: boolean; reason?: string }) => {
      const { error } = await supabase.from('restaurants').update(
        block
          ? { is_blocked: true, is_approved: false, block_reason: reason || null }
          : { is_blocked: false, is_approved: true, block_reason: null }
      ).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { block }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] });
      toast({ title: block ? '🚫 Solicitante bloqueado.' : '✅ Solicitante desbloqueado!' });
      setSelected(null); setShowBlockInput(false); setBlockReason('');
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: active } = await supabase.from('deliveries').select('id').eq('restaurant_id', id).in('status', ['pending','accepted','picked_up']);
      if (active && active.length > 0) throw new Error('Existem entregas ativas para este solicitante.');
      const { error } = await supabase.from('restaurants').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] });
      toast({ title: '🗑️ Solicitante excluído.' });
      setDeleteTarget(null); setSelected(null);
    },
    onError: (e: any) => toast({ title: 'Não foi possível excluir', description: e.message, variant: 'destructive' }),
  });

  const filtered = useMemo(() => {
    let list = restaurants;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.business_name.toLowerCase().includes(q) ||
        (r.profile_name || '').toLowerCase().includes(q) ||
        (r.phone || r.profile_phone || '').includes(q) ||
        (r.cnpj || '').includes(q) ||
        (r.address_city || '').toLowerCase().includes(q)
      );
    }
    if (filter === 'approved') list = list.filter(r => r.is_approved && !r.is_blocked);
    if (filter === 'blocked')  list = list.filter(r => r.is_blocked);
    if (filter === 'pending')  list = list.filter(r => !r.is_approved && !r.is_blocked);
    return list;
  }, [restaurants, search, filter]);

  const counts = useMemo(() => ({
    total:    restaurants.length,
    approved: restaurants.filter(r => r.is_approved && !r.is_blocked).length,
    blocked:  restaurants.filter(r => r.is_blocked).length,
    pending:  restaurants.filter(r => !r.is_approved && !r.is_blocked).length,
  }), [restaurants]);

  const closeModal = () => { setSelected(null); setShowBlockInput(false); setBlockReason(''); };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">

          <AdminPageHeader title="Solicitantes" showBack showLogout>
            <button onClick={() => refetch()} disabled={isLoading} className="h-9 px-2.5 rounded-xl border border-white/20 text-sm text-white/80 flex items-center gap-1.5 hover:bg-white/10 transition-colors disabled:opacity-50">
              <Loader2 className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </AdminPageHeader>

          <main className="flex-1 overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto w-full">

            {/* KPIs */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Total',     value: counts.total,    icon: Building2,   cls: 'text-gray-400' },
                { label: 'Aprovados', value: counts.approved, icon: CheckCircle2, cls: 'text-green-500' },
                { label: 'Bloqueados',value: counts.blocked,  icon: ShieldX,      cls: 'text-red-500' },
                { label: 'Pendentes', value: counts.pending,  icon: Clock,        cls: 'text-orange-400' },
              ].map(({ label, value, icon: Icon, cls }) => (
                <div key={label} className="bg-white rounded-2xl shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-1"><Icon className={`h-4 w-4 ${cls}`} /><p className="text-xs text-gray-400">{label}</p></div>
                  <p className={`text-2xl font-bold ${cls === 'text-gray-400' ? 'text-gray-900' : cls}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Busca + filtros */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Buscar por nome, cidade, telefone ou CNPJ..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-11 rounded-xl border-gray-200 bg-white" />
              </div>
              <div className="flex gap-2 flex-wrap">
                {([
                  { key: 'all', label: 'Todos' },
                  { key: 'approved', label: '✅ Aprovados' },
                  { key: 'pending', label: '⏳ Pendentes' },
                  { key: 'blocked', label: '🚫 Bloqueados' },
                ] as const).map(opt => (
                  <button key={opt.key} onClick={() => setFilter(opt.key)}
                    className={`flex-shrink-0 h-8 px-3 rounded-full text-xs font-semibold transition-colors ${filter === opt.key ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista */}
            {isLoading ? (
              <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
            ) : isError ? (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                <p className="text-gray-500 mb-3">Erro ao carregar solicitantes</p>
                <button onClick={() => refetch()} className="text-sm text-primary font-semibold hover:underline">Tentar novamente</button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="font-semibold text-gray-600">Nenhum solicitante encontrado</p>
                <p className="text-sm text-gray-400 mt-1">Tente ajustar os filtros de busca</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 px-1">{filtered.length} solicitante(s)</p>
                {filtered.map((r) => (
                  <button key={r.id} onClick={() => setSelected(r)} className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-shadow text-left">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${r.is_blocked ? 'bg-red-50' : r.is_approved ? 'bg-green-50' : 'bg-orange-50'}`}>
                      {r.person_type === 'pf' ? '👤' : '🏢'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900 text-sm truncate">{r.business_name}</p>
                        <StatusBadge r={r} />
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${r.person_type === 'pj' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {r.person_type === 'pj' ? 'PJ' : 'PF'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                        {(r.phone || r.profile_phone) && <span>{r.phone || r.profile_phone}</span>}
                        {r.address_city && <span>· 📍 {r.address_city}{r.address_state ? `/${r.address_state}` : ''}</span>}
                        <span>· 📦 {r.total_deliveries} entregas</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Modal detalhes */}
      <Dialog open={!!selected} onOpenChange={open => !open && closeModal()}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader><DialogTitle className="text-lg font-bold">Detalhes do Solicitante</DialogTitle></DialogHeader>

          {selected && (
            <div className="space-y-4">
              <div className={`flex items-center gap-4 rounded-2xl p-4 ${selected.is_blocked ? 'bg-red-50' : 'bg-gray-50'}`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl ${selected.is_blocked ? 'bg-red-100' : selected.is_approved ? 'bg-green-100' : 'bg-orange-100'}`}>
                  {selected.person_type === 'pf' ? '👤' : '🏢'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 truncate">{selected.business_name}</p>
                  {selected.company_name && <p className="text-xs text-gray-500 truncate">{selected.company_name}</p>}
                  <p className="text-sm text-gray-500">{selected.profile_name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <StatusBadge r={selected} />
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selected.person_type === 'pj' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {selected.person_type === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                    </span>
                  </div>
                </div>
              </div>

              {selected.is_blocked && selected.block_reason && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <p className="text-xs font-bold text-red-700 mb-0.5">Motivo do bloqueio</p>
                  <p className="text-sm text-red-600">{selected.block_reason}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Star, color: 'text-yellow-500', value: Number(selected.rating).toFixed(1), label: 'Avaliação' },
                  { icon: Package, color: 'text-blue-500', value: selected.total_deliveries, label: 'Entregas' },
                  { icon: Wallet, color: 'text-green-500', value: `R$ ${Number(selected.wallet_balance).toFixed(0)}`, label: 'Saldo' },
                ].map(({ icon: Icon, color, value, label }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <Icon className={`h-4 w-4 ${color} mx-auto mb-1`} />
                    <p className="text-base font-bold text-gray-900">{value}</p>
                    <p className="text-[10px] text-gray-400">{label}</p>
                  </div>
                ))}
              </div>

              <div className="bg-gray-50 rounded-2xl divide-y divide-gray-100 overflow-hidden">
                {(selected.phone || selected.profile_phone) && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <div><p className="text-[10px] text-gray-400 uppercase tracking-wider">Telefone</p><p className="text-sm font-semibold text-gray-900">{selected.phone || selected.profile_phone}</p></div>
                  </div>
                )}
                {selected.cnpj && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <div><p className="text-[10px] text-gray-400 uppercase tracking-wider">{selected.person_type === 'pj' ? 'CNPJ' : 'CPF'}</p><p className="text-sm font-semibold text-gray-900">{selected.cnpj}</p></div>
                  </div>
                )}
                {(selected.address_city || selected.address) && (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Localização</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {selected.address_city ? `${selected.address_city}${selected.address_state ? `/${selected.address_state}` : ''}` : selected.address}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 px-4 py-3">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <div><p className="text-[10px] text-gray-400 uppercase tracking-wider">Cadastrado em</p><p className="text-sm font-semibold text-gray-900">{new Date(selected.created_at).toLocaleDateString('pt-BR')}</p></div>
                </div>
              </div>

              {/* Block input */}
              {showBlockInput && !selected.is_blocked && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500">Motivo do bloqueio *</label>
                  <input
                    value={blockReason} onChange={e => setBlockReason(e.target.value)}
                    placeholder="Ex: Violação dos termos de uso..."
                    className="w-full h-11 px-3 rounded-xl border border-red-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={() => { setShowBlockInput(false); setBlockReason(''); }} className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600">Cancelar</button>
                    <button
                      onClick={() => blockMutation.mutate({ id: selected.id, block: true, reason: blockReason })}
                      disabled={!blockReason.trim() || blockMutation.isPending}
                      className="flex-1 h-10 rounded-xl bg-red-600 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {blockMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldX className="h-4 w-4" />Confirmar</>}
                    </button>
                  </div>
                </div>
              )}

              {/* Ações */}
              {!showBlockInput && (
                <div className="space-y-2 pt-1">
                  {selected.is_blocked ? (
                    <button onClick={() => blockMutation.mutate({ id: selected.id, block: false })} disabled={blockMutation.isPending}
                      className="w-full h-11 rounded-xl bg-green-600 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60">
                      {blockMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldCheck className="h-4 w-4" />Desbloquear solicitante</>}
                    </button>
                  ) : (
                    <button onClick={() => setShowBlockInput(true)}
                      className="w-full h-11 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 text-sm font-semibold flex items-center justify-center gap-2 transition-colors">
                      <ShieldX className="h-4 w-4" />Bloquear solicitante
                    </button>
                  )}
                  <button onClick={() => setDeleteTarget(selected)}
                    className="w-full h-11 rounded-xl text-sm font-semibold bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-200 flex items-center justify-center gap-2 transition-colors">
                    <Trash2 className="h-4 w-4" />Excluir solicitante
                  </button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{deleteTarget?.business_name}"?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. Não é possível excluir solicitantes com entregas ativas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
