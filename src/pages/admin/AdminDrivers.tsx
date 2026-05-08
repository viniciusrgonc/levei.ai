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
  FileText, Car, ImageOff, ShieldX, ShieldCheck,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type DriverStatus = 'pending' | 'approved' | 'rejected' | 'blocked';

interface Driver {
  id: string;
  user_id: string;
  vehicle_type: string;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_year: number | null;
  license_plate: string;
  is_available: boolean;
  is_approved: boolean;
  driver_status: DriverStatus;
  rating: number;
  total_deliveries: number;
  created_at: string;
  profile_name: string;
  profile_phone: string;
  cpf: string | null;
  address_city: string | null;
  address_state: string | null;
  accepted_product_types: string[];
  drivers_license_url: string | null;
  cnh_back_url: string | null;
  selfie_url: string | null;
  vehicle_photo_url: string | null;
  rejection_reason: string | null;
}

// ── Query function ────────────────────────────────────────────────────────────
async function fetchDrivers(): Promise<Driver[]> {
  const { data, error } = await supabase
    .from('drivers')
    .select('id,user_id,vehicle_type,vehicle_model,vehicle_color,vehicle_year,license_plate,is_available,is_approved,driver_status,rating,total_deliveries,created_at,cpf,phone,address_city,address_state,accepted_product_types,drivers_license_url,cnh_back_url,selfie_url,vehicle_photo_url,rejection_reason')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const results = await Promise.all(
    (data || []).map(async (driver) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', driver.user_id)
        .maybeSingle();
      const status: DriverStatus = (driver.driver_status as DriverStatus) ??
        (driver.is_approved ? 'approved' : driver.rejection_reason ? 'rejected' : 'pending');
      return {
        id: driver.id,
        user_id: driver.user_id,
        vehicle_type: driver.vehicle_type,
        vehicle_model: driver.vehicle_model || null,
        vehicle_color: driver.vehicle_color || null,
        vehicle_year: driver.vehicle_year || null,
        license_plate: driver.license_plate || '',
        is_available: driver.is_available,
        is_approved: driver.is_approved,
        driver_status: status,
        rating: driver.rating || 0,
        total_deliveries: driver.total_deliveries || 0,
        created_at: driver.created_at,
        profile_name: profile?.full_name || 'Sem nome',
        profile_phone: profile?.phone || driver.phone || '',
        cpf: driver.cpf || null,
        address_city: driver.address_city || null,
        address_state: driver.address_state || null,
        accepted_product_types: driver.accepted_product_types || [],
        drivers_license_url: driver.drivers_license_url || null,
        cnh_back_url: driver.cnh_back_url || null,
        selfie_url: driver.selfie_url || null,
        vehicle_photo_url: driver.vehicle_photo_url || null,
        rejection_reason: driver.rejection_reason || null,
      };
    })
  );
  return results;
}

function StatusBadge({ status }: { status: DriverStatus }) {
  const map: Record<DriverStatus, { label: string; cls: string }> = {
    approved: { label: '✅ Aprovado',  cls: 'bg-green-100 text-green-700' },
    pending:  { label: '⏳ Pendente',  cls: 'bg-orange-100 text-orange-700' },
    rejected: { label: '⚠️ Reprovado', cls: 'bg-red-100 text-red-700' },
    blocked:  { label: '🔒 Bloqueado', cls: 'bg-gray-200 text-gray-700' },
  };
  const { label, cls } = map[status] ?? map.pending;
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
      </div>
    </div>
  );
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
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending' | 'blocked' | 'available'>('all');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data: drivers = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-drivers'],
    queryFn: fetchDrivers,
    staleTime: 60 * 1000,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const approveMutation = useMutation({
    mutationFn: async ({ id, approve, userId }: { id: string; approve: boolean; userId: string }) => {
      const payload: Record<string, any> = {
        is_approved: approve,
        driver_status: approve ? 'approved' : 'rejected',
        is_available: approve ? undefined : false,
      };
      if (!approve) payload.rejection_reason = rejectionReason.trim() || null;
      else payload.rejection_reason = null;
      const { error } = await supabase.from('drivers').update(payload).eq('id', id);
      if (error) throw error;

      if (approve) {
        supabase.rpc('create_notification', { p_user_id: userId, p_title: '✅ Cadastro aprovado!', p_message: 'Seu cadastro foi aprovado. Você já pode começar a trabalhar!', p_type: 'system' }).catch(() => {});
        supabase.functions.invoke('send-push', { body: { user_id: userId, title: '✅ Cadastro aprovado!', message: 'Bem-vindo à Levei.ai! Abra o app para começar.', url: '/driver/dashboard' } }).catch(() => {});
      } else {
        supabase.rpc('create_notification', { p_user_id: userId, p_title: 'Cadastro não aprovado', p_message: `Motivo: ${rejectionReason.trim() || 'Verifique seus documentos'}. Corrija e aguarde nova análise.`, p_type: 'system' }).catch(() => {});
        supabase.functions.invoke('send-push', { body: { user_id: userId, title: 'Cadastro não aprovado', message: 'Verifique o aplicativo para entender o que corrigir.', url: '/driver/pending-approval' } }).catch(() => {});
      }
    },
    onSuccess: (_, { approve }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-drivers'] });
      setRejectionReason('');
      toast({ title: approve ? '✅ Entregador aprovado!' : '❌ Entregador reprovado.' });
      setSelectedDriver(null);
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const blockMutation = useMutation({
    mutationFn: async ({ id, userId, block }: { id: string; userId: string; block: boolean }) => {
      const payload: Record<string, any> = block
        ? { driver_status: 'blocked', is_approved: false, is_available: false, rejection_reason: rejectionReason.trim() || 'Conta bloqueada pelo administrador' }
        : { driver_status: 'pending', is_approved: false, rejection_reason: null };
      const { error } = await supabase.from('drivers').update(payload).eq('id', id);
      if (error) throw error;
      if (block) {
        supabase.rpc('create_notification', { p_user_id: userId, p_title: 'Conta bloqueada', p_message: rejectionReason.trim() || 'Sua conta foi bloqueada. Entre em contato com o suporte.', p_type: 'system' }).catch(() => {});
        supabase.functions.invoke('send-push', { body: { user_id: userId, title: 'Conta bloqueada', message: 'Entre em contato com o suporte para mais informações.' } }).catch(() => {});
      }
    },
    onSuccess: (_, { block }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-drivers'] });
      setRejectionReason('');
      toast({ title: block ? '🔒 Entregador bloqueado.' : '🔓 Bloqueio removido.' });
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
    if (filter === 'approved')  list = list.filter(d => d.driver_status === 'approved');
    if (filter === 'pending')   list = list.filter(d => d.driver_status === 'pending' || d.driver_status === 'rejected');
    if (filter === 'blocked')   list = list.filter(d => d.driver_status === 'blocked');
    if (filter === 'available') list = list.filter(d => d.is_available);
    return list;
  }, [drivers, search, filter]);

  const approvedCount = drivers.filter(d => d.driver_status === 'approved').length;
  const pendingCount  = drivers.filter(d => d.driver_status === 'pending' || d.driver_status === 'rejected').length;
  const blockedCount  = drivers.filter(d => d.driver_status === 'blocked').length;

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
            <div className="grid grid-cols-4 gap-2">
              {[
                { icon: Users,        color: 'text-gray-400',  val: drivers.length, label: 'Total'    },
                { icon: CheckCircle2, color: 'text-green-500', val: approvedCount,  label: 'Aprovados' },
                { icon: Clock,        color: 'text-orange-400',val: pendingCount,   label: 'Pendentes' },
                { icon: ShieldX,      color: 'text-red-400',   val: blockedCount,   label: 'Bloqueados'},
              ].map(({ icon: Icon, color, val, label }) => (
                <div key={label} className="bg-white rounded-2xl shadow-sm p-3 text-center">
                  <Icon className={`h-4 w-4 ${color} mx-auto mb-1`} />
                  <p className="text-xl font-bold text-gray-900">{val}</p>
                  <p className="text-[10px] text-gray-400">{label}</p>
                </div>
              ))}
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
                  { key: 'all',       label: 'Todos'        },
                  { key: 'pending',   label: '⏳ Pendentes'  },
                  { key: 'approved',  label: '✅ Aprovados'  },
                  { key: 'blocked',   label: '🔒 Bloqueados' },
                  { key: 'available', label: '🟢 Online'     },
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
                        <StatusBadge status={driver.driver_status} />
                        {driver.is_available && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">🟢 Online</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
                        <span className="capitalize">{vehicleEmoji(driver.vehicle_type)} {driver.vehicle_type}</span>
                        {driver.license_plate && <span>· {driver.license_plate}</span>}
                        {driver.address_city && <span>· {driver.address_city}/{driver.address_state}</span>}
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
            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">

              {/* Header */}
              <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
                  {vehicleEmoji(selectedDriver.vehicle_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900">{selectedDriver.profile_name}</p>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    <StatusBadge status={selectedDriver.driver_status} />
                    {selectedDriver.is_available && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">🟢 Online</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-gray-900">⭐ {Number(selectedDriver.rating).toFixed(1)}</p>
                  <p className="text-[10px] text-gray-400">{selectedDriver.total_deliveries} entregas</p>
                </div>
              </div>

              {/* Dados pessoais */}
              <div className="bg-gray-50 rounded-2xl divide-y divide-gray-100 overflow-hidden text-sm">
                {selectedDriver.profile_phone && <InfoRow icon={<Phone className="h-3.5 w-3.5 text-gray-400" />} label="Telefone" value={selectedDriver.profile_phone} />}
                {selectedDriver.cpf && <InfoRow icon={<FileText className="h-3.5 w-3.5 text-gray-400" />} label="CPF" value={selectedDriver.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')} />}
                {selectedDriver.address_city && <InfoRow icon={<span className="text-gray-400 text-sm">📍</span>} label="Cidade" value={`${selectedDriver.address_city} / ${selectedDriver.address_state}`} />}
                {selectedDriver.license_plate && <InfoRow icon={<Car className="h-3.5 w-3.5 text-gray-400" />} label="Veículo" value={[vehicleEmoji(selectedDriver.vehicle_type), selectedDriver.vehicle_model, selectedDriver.vehicle_color, selectedDriver.license_plate].filter(Boolean).join(' · ')} />}
                <InfoRow icon={<Clock className="h-3.5 w-3.5 text-gray-400" />} label="Cadastro" value={new Date(selectedDriver.created_at).toLocaleDateString('pt-BR')} />
              </div>

              {/* Categorias */}
              {selectedDriver.accepted_product_types.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Categorias aceitas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDriver.accepted_product_types.map((c) => (
                      <span key={c} className="text-xs bg-primary/10 text-primary font-semibold px-2.5 py-1 rounded-full">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Documentos — grid 2x2 */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Documentos</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'CNH Frente', url: selectedDriver.drivers_license_url },
                    { label: 'CNH Verso',  url: selectedDriver.cnh_back_url },
                    { label: 'Selfie',     url: selectedDriver.selfie_url },
                    { label: 'Veículo',    url: selectedDriver.vehicle_photo_url },
                  ].map(({ label, url }) => (
                    <div key={label} className="space-y-1">
                      <p className="text-[10px] text-gray-400 font-semibold">{label}</p>
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt={label} className="w-full h-20 object-cover rounded-xl border border-gray-100 hover:opacity-90 transition-opacity" />
                        </a>
                      ) : (
                        <div className="w-full h-20 rounded-xl bg-gray-100 flex flex-col items-center justify-center gap-1 text-gray-300">
                          <ImageOff className="h-4 w-4" />
                          <span className="text-[9px]">Não enviado</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Motivo anterior */}
              {selectedDriver.rejection_reason && (
                <div className="bg-orange-50 border border-orange-100 rounded-xl px-3 py-2">
                  <p className="text-xs font-semibold text-orange-700">Motivo anterior:</p>
                  <p className="text-xs text-orange-600 mt-0.5">{selectedDriver.rejection_reason}</p>
                </div>
              )}

              {/* Campo motivo */}
              {selectedDriver.driver_status !== 'blocked' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500">Motivo (reprovação / bloqueio)</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Ex: CNH ilegível, documentos incorretos..."
                    rows={2}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              )}

              {/* Ações */}
              <div className="space-y-2 pb-1">
                {selectedDriver.driver_status !== 'approved' && (
                  <button
                    onClick={() => approveMutation.mutate({ id: selectedDriver.id, approve: true, userId: selectedDriver.user_id })}
                    disabled={approveMutation.isPending}
                    className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-60"
                  >
                    {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserCheck className="h-4 w-4" />Aprovar entregador</>}
                  </button>
                )}

                {selectedDriver.driver_status === 'approved' && (
                  <button
                    onClick={() => approveMutation.mutate({ id: selectedDriver.id, approve: false, userId: selectedDriver.user_id })}
                    disabled={approveMutation.isPending}
                    className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 transition-colors disabled:opacity-60"
                  >
                    {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserX className="h-4 w-4" />Reprovar entregador</>}
                  </button>
                )}

                {selectedDriver.driver_status !== 'blocked' ? (
                  <button
                    onClick={() => blockMutation.mutate({ id: selectedDriver.id, userId: selectedDriver.user_id, block: true })}
                    disabled={blockMutation.isPending}
                    className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-60"
                  >
                    {blockMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldX className="h-4 w-4" />Bloquear conta</>}
                  </button>
                ) : (
                  <button
                    onClick={() => blockMutation.mutate({ id: selectedDriver.id, userId: selectedDriver.user_id, block: false })}
                    disabled={blockMutation.isPending}
                    className="w-full h-11 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-60"
                  >
                    {blockMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldCheck className="h-4 w-4" />Remover bloqueio</>}
                  </button>
                )}

                <button
                  onClick={() => setDeleteTarget(selectedDriver)}
                  className="w-full h-10 rounded-xl text-xs font-semibold text-gray-400 hover:text-red-500 border border-gray-100 hover:border-red-100 flex items-center justify-center gap-2 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir cadastro
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
