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
  Search, UserCheck, UserX, Phone, Star, Package,
  Users, CheckCircle2, Clock, Loader2, Trash2, ChevronRight,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Driver {
  id: string;
  user_id: string;
  vehicle_type: string;
  license_plate: string;
  is_available: boolean;
  is_approved: boolean;
  rating: number;
  total_deliveries: number;
  created_at: string;
  profile_name: string;
  profile_phone: string;
}

// ── Query function ────────────────────────────────────────────────────────────
async function fetchDrivers(): Promise<Driver[]> {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const results = await Promise.all(
    (data || []).map(async (driver) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', driver.user_id)
        .maybeSingle();
      return {
        id: driver.id,
        user_id: driver.user_id,
        vehicle_type: driver.vehicle_type,
        license_plate: driver.license_plate || '',
        is_available: driver.is_available,
        is_approved: driver.is_approved,
        rating: driver.rating || 0,
        total_deliveries: driver.total_deliveries || 0,
        created_at: driver.created_at,
        profile_name: profile?.full_name || 'Sem nome',
        profile_phone: profile?.phone || '',
      };
    })
  );
  return results;
}

function vehicleEmoji(type: string) {
  const t = (type || '').toLowerCase();
  if (t.includes('moto') || t.includes('bike')) return '🛵';
  if (t.includes('carro') || t.includes('car')) return '🚗';
  if (t.includes('van')) return '🚐';
  if (t.includes('caminhão') || t.includes('caminhao')) return '🚛';
  if (t.includes('bicicleta') || t.includes('bike')) return '🚲';
  return '🚗';
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminDrivers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending' | 'available'>('all');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data: drivers = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-drivers'],
    queryFn: fetchDrivers,
    staleTime: 60 * 1000,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from('drivers').update({ is_approved: value }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { value }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-drivers'] });
      toast({ title: value ? '✅ Entregador aprovado!' : 'Entregador desaprovado.' });
      setSelectedDriver(null);
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check active deliveries
      const { data: active } = await supabase
        .from('deliveries').select('id').eq('driver_id', id)
        .in('status', ['pending', 'accepted', 'picked_up']);
      if (active && active.length > 0) throw new Error('Existem entregas ativas para este entregador.');
      const { error } = await supabase.from('drivers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-drivers'] });
      toast({ title: '🗑️ Entregador excluído.' });
      setDeleteTarget(null);
      setSelectedDriver(null);
    },
    onError: (e: any) => toast({ title: 'Não foi possível excluir', description: e.message, variant: 'destructive' }),
  });

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = drivers;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        d.profile_name.toLowerCase().includes(q) ||
        d.profile_phone.includes(q) ||
        d.license_plate.toLowerCase().includes(q)
      );
    }
    if (filter === 'approved') list = list.filter(d => d.is_approved);
    if (filter === 'pending') list = list.filter(d => !d.is_approved);
    if (filter === 'available') list = list.filter(d => d.is_available);
    return list;
  }, [drivers, search, filter]);

  const approvedCount = drivers.filter(d => d.is_approved).length;
  const pendingCount = drivers.filter(d => !d.is_approved).length;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">

          <AdminPageHeader title="Entregadores" showBack showLogout>
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="h-9 px-2.5 rounded-xl border border-white/20 text-sm text-white/80 flex items-center gap-1.5 hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              <Loader2 className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </AdminPageHeader>

          <main className="flex-1 overflow-y-auto p-4 space-y-4 max-w-4xl mx-auto w-full">

            {/* ── KPIs ── */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-gray-400" />
                  <p className="text-xs text-gray-400">Total</p>
                </div>
                <p className="text-2xl font-bold text-gray-900">{drivers.length}</p>
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
                  placeholder="Buscar por nome, telefone ou placa..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-11 rounded-xl border-gray-200 bg-white"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {([
                  { key: 'all', label: 'Todos' },
                  { key: 'approved', label: '✅ Aprovados' },
                  { key: 'pending', label: '⏳ Pendentes' },
                  { key: 'available', label: '🟢 Disponíveis' },
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
                <p className="text-gray-500 mb-3">Erro ao carregar entregadores</p>
                <button onClick={() => refetch()}
                  className="text-sm text-blue-600 font-semibold hover:underline">Tentar novamente</button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="font-semibold text-gray-600">Nenhum entregador encontrado</p>
                <p className="text-sm text-gray-400 mt-1">Tente ajustar os filtros de busca</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 px-1">{filtered.length} entregador(es)</p>
                {filtered.map((driver) => (
                  <button
                    key={driver.id}
                    onClick={() => setSelectedDriver(driver)}
                    className="w-full bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-shadow text-left"
                  >
                    {/* Avatar */}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${
                      driver.is_approved ? 'bg-green-50' : 'bg-orange-50'
                    }`}>
                      {vehicleEmoji(driver.vehicle_type)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900 text-sm">{driver.profile_name}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          driver.is_approved
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {driver.is_approved ? '✅ Aprovado' : '⏳ Pendente'}
                        </span>
                        {driver.is_available && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            🟢 Online
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span className="capitalize">{driver.vehicle_type}</span>
                        {driver.license_plate && <span>· {driver.license_plate}</span>}
                        <span>· ⭐ {Number(driver.rating).toFixed(1)}</span>
                        <span>· {driver.total_deliveries} entregas</span>
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
      <Dialog open={!!selectedDriver} onOpenChange={open => !open && setSelectedDriver(null)}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Detalhes do Entregador</DialogTitle>
          </DialogHeader>

          {selectedDriver && (
            <div className="space-y-4">
              {/* Avatar + nome */}
              <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl ${
                  selectedDriver.is_approved ? 'bg-green-100' : 'bg-orange-100'
                }`}>
                  {vehicleEmoji(selectedDriver.vehicle_type)}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{selectedDriver.profile_name}</p>
                  <p className="text-sm text-gray-500 capitalize">{selectedDriver.vehicle_type}</p>
                  <div className="flex gap-1.5 mt-1">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      selectedDriver.is_approved ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {selectedDriver.is_approved ? '✅ Aprovado' : '⏳ Pendente'}
                    </span>
                    {selectedDriver.is_available && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">🟢 Online</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <Star className="h-4 w-4 text-yellow-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">{Number(selectedDriver.rating).toFixed(1)}</p>
                  <p className="text-[10px] text-gray-400">Avaliação</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <Package className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">{selectedDriver.total_deliveries}</p>
                  <p className="text-[10px] text-gray-400">Entregas</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <Clock className="h-4 w-4 text-gray-400 mx-auto mb-1" />
                  <p className="text-sm font-bold text-gray-900">
                    {new Date(selectedDriver.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                  </p>
                  <p className="text-[10px] text-gray-400">Cadastro</p>
                </div>
              </div>

              {/* Dados */}
              <div className="bg-gray-50 rounded-2xl divide-y divide-gray-100 overflow-hidden">
                {selectedDriver.profile_phone && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Telefone</p>
                      <p className="text-sm font-semibold text-gray-900">{selectedDriver.profile_phone}</p>
                    </div>
                  </div>
                )}
                {selectedDriver.license_plate && (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="text-gray-400 text-base">🚘</span>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider">Placa</p>
                      <p className="text-sm font-semibold text-gray-900 uppercase">{selectedDriver.license_plate}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Ações */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => approveMutation.mutate({ id: selectedDriver.id, value: !selectedDriver.is_approved })}
                  disabled={approveMutation.isPending}
                  className={`w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${
                    selectedDriver.is_approved
                      ? 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : selectedDriver.is_approved ? (
                    <><UserX className="h-4 w-4" />Desaprovar entregador</>
                  ) : (
                    <><UserCheck className="h-4 w-4" />Aprovar entregador</>
                  )}
                </button>

                <button
                  onClick={() => setDeleteTarget(selectedDriver)}
                  className="w-full h-11 rounded-xl text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 flex items-center justify-center gap-2 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir entregador
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
            <AlertDialogTitle>Excluir "{deleteTarget?.profile_name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Não é possível excluir entregadores com entregas ativas.
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
