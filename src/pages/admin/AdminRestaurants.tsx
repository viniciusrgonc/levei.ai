import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminSidebar } from '@/components/AdminSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import {
  Search, UserCheck, UserX, MapPin, Phone, Star,
  Package, Loader2, Trash2, ChevronRight, Building2,
  CheckCircle2, Clock, Wallet,
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
  cnpj: string;
  address: string;
  is_approved: boolean;
  rating: number;
  total_deliveries: number;
  wallet_balance: number;
  created_at: string;
  profile_name: string;
  profile_phone: string;
}

// ── Query function ─────────────────────────────────────────────────────────────
async function fetchRestaurants(): Promise<Restaurant[]> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const results = await Promise.all(
    (data || []).map(async (r) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', r.user_id)
        .maybeSingle();
      return {
        id: r.id,
        user_id: r.user_id,
        business_name: r.business_name,
        cnpj: r.cnpj || '',
        address: r.address,
        is_approved: r.is_approved,
        rating: r.rating || 0,
        total_deliveries: r.total_deliveries || 0,
        wallet_balance: r.wallet_balance || 0,
        created_at: r.created_at,
        profile_name: profile?.full_name || 'Sem nome',
        profile_phone: profile?.phone || '',
      };
    })
  );
  return results;
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function AdminRestaurants() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Restaurant | null>(null);

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data: restaurants = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-restaurants'],
    queryFn: fetchRestaurants,
    staleTime: 60 * 1000,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from('restaurants').update({ is_approved: value }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { value }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] });
      toast({ title: value ? '✅ Solicitante aprovado!' : 'Solicitante desaprovado.' });
      setSelected(null);
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: active } = await supabase
        .from('deliveries').select('id').eq('restaurant_id', id)
        .in('status', ['pending', 'accepted', 'picked_up']);
      if (active && active.length > 0) throw new Error('Existem entregas ativas para este solicitante.');
      const { error } = await supabase.from('restaurants').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] });
      toast({ title: '🗑️ Solicitante excluído.' });
      setDeleteTarget(null);
      setSelected(null);
    },
    onError: (e: any) => toast({ title: 'Não foi possível excluir', description: e.message, variant: 'destructive' }),
  });

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = restaurants;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.business_name.toLowerCase().includes(q) ||
        r.profile_phone.includes(q) ||
        r.cnpj.includes(q)
      );
    }
    if (filter === 'approved') list = list.filter(r => r.is_approved);
    if (filter === 'pending') list = list.filter(r => !r.is_approved);
    return list;
  }, [restaurants, search, filter]);

  const approvedCount = restaurants.filter(r => r.is_approved).length;
  const pendingCount = restaurants.filter(r => !r.is_approved).length;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">

          {/* ── Header ── */}
          <header className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
            <div className="flex items-center gap-3 px-4 h-14">
              <SidebarTrigger className="text-gray-500" />
              <div className="flex-1 min-w-0">
                <h1 className="font-semibold text-gray-900">Solicitantes</h1>
              </div>
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="h-9 px-3 rounded-xl border border-gray-200 text-sm text-gray-600 flex items-center gap-1.5 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <Loader2 className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : 'hidden'}`} />
                Atualizar
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto w-full">

            {/* ── KPIs ── */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <p className="text-xs text-gray-400">Total</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{restaurants.length}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <p className="text-xs text-gray-400">Aprovados</p>
                </div>
                <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-orange-400" />
                  <p className="text-xs text-gray-400">Pendentes</p>
                </div>
                <p className="text-2xl font-bold text-orange-500">{pendingCount}</p>
              </div>
            </div>

            {/* ── Busca + filtros ── */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nome, telefone ou CNPJ..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-11 rounded-xl border-gray-200 bg-white"
                />
              </div>
              <div className="flex gap-2">
                {([
                  { key: 'all', label: 'Todos' },
                  { key: 'approved', label: '✅ Aprovados' },
                  { key: 'pending', label: '⏳ Pendentes' },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setFilter(opt.key)}
                    className={`flex-shrink-0 h-8 px-3 rounded-full text-xs font-semibold transition-colors ${
                      filter === opt.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Lista ── */}
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
              </div>
            ) : isError ? (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                <p className="text-gray-500 mb-3">Erro ao carregar solicitantes</p>
                <button onClick={() => refetch()} className="text-sm text-blue-600 font-semibold hover:underline">
                  Tentar novamente
                </button>
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
                  <button
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-shadow text-left"
                  >
                    {/* Avatar */}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${
                      r.is_approved ? 'bg-green-50' : 'bg-orange-50'
                    }`}>
                      🏢
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900 text-sm truncate">{r.business_name}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                          r.is_approved ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {r.is_approved ? '✅ Aprovado' : '⏳ Pendente'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        {r.profile_phone && <span>{r.profile_phone}</span>}
                        <span>· 📦 {r.total_deliveries} entregas</span>
                        <span>· 💰 R$ {Number(r.wallet_balance).toFixed(2)}</span>
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

      {/* ── Drawer de detalhes ── */}
      <Dialog open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Detalhes do Solicitante</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl ${
                  selected.is_approved ? 'bg-green-100' : 'bg-orange-100'
                }`}>
                  🏢
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 truncate">{selected.business_name}</p>
                  <p className="text-sm text-gray-500">{selected.profile_name}</p>
                  <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    selected.is_approved ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {selected.is_approved ? '✅ Aprovado' : '⏳ Pendente aprovação'}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <Star className="h-4 w-4 text-yellow-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">{Number(selected.rating).toFixed(1)}</p>
                  <p className="text-[10px] text-gray-400">Avaliação</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <Package className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">{selected.total_deliveries}</p>
                  <p className="text-[10px] text-gray-400">Entregas</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <Wallet className="h-4 w-4 text-green-500 mx-auto mb-1" />
                  <p className="text-base font-bold text-gray-900">R$ {Number(selected.wallet_balance).toFixed(0)}</p>
                  <p className="text-[10px] text-gray-400">Saldo</p>
                </div>
              </div>

              {/* Dados */}
              <div className="bg-gray-50 rounded-2xl divide-y divide-gray-100 overflow-hidden">
                {selected.profile_phone && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Telefone</p>
                      <p className="text-sm font-semibold text-gray-900">{selected.profile_phone}</p>
                    </div>
                  </div>
                )}
                {selected.cnpj && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">CNPJ</p>
                      <p className="text-sm font-semibold text-gray-900">{selected.cnpj}</p>
                    </div>
                  </div>
                )}
                {selected.address && (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Endereço</p>
                      <p className="text-sm font-semibold text-gray-900">{selected.address}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 px-4 py-3">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Cadastrado em</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {new Date(selected.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => approveMutation.mutate({ id: selected.id, value: !selected.is_approved })}
                  disabled={approveMutation.isPending}
                  className={`w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${
                    selected.is_approved
                      ? 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : selected.is_approved ? (
                    <><UserX className="h-4 w-4" />Desaprovar solicitante</>
                  ) : (
                    <><UserCheck className="h-4 w-4" />Aprovar solicitante</>
                  )}
                </button>

                <button
                  onClick={() => setDeleteTarget(selected)}
                  className="w-full h-11 rounded-xl text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 flex items-center justify-center gap-2 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir solicitante
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Confirm delete ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{deleteTarget?.business_name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Não é possível excluir solicitantes com entregas ativas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
