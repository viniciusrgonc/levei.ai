import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Users, PackageCheck, TrendingUp, AlertCircle, Check, X,
  DollarSign, Clock, RefreshCw, Eye, Truck, Building2,
  Phone, MapPin, Wallet, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import leveiLogo from '@/assets/levei-logo.png';

interface Stats {
  totalDrivers: number; approvedDrivers: number; pendingDrivers: number;
  totalRestaurants: number; approvedRestaurants: number; pendingRestaurants: number;
  totalDeliveries: number; activeDeliveries: number; completedToday: number; totalRevenue: number;
}
interface FinancialStats { platformFees: number; driverEarnings: number; totalVolume: number; }
interface PendingDriver {
  id: string; user_id: string; vehicle_type: string; license_plate: string;
  created_at: string; profile_name: string; profile_phone: string;
}
interface PendingRestaurant {
  id: string; user_id: string; business_name: string; cnpj: string;
  address: string; created_at: string; profile_phone: string;
}

const vehicleLabel: Record<string, string> = {
  motorcycle: 'Moto', bicycle: 'Bicicleta', car: 'Carro',
  van: 'Van', truck: 'Caminhão', hourly_service: 'Por hora',
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalDrivers: 0, approvedDrivers: 0, pendingDrivers: 0,
    totalRestaurants: 0, approvedRestaurants: 0, pendingRestaurants: 0,
    totalDeliveries: 0, activeDeliveries: 0, completedToday: 0, totalRevenue: 0,
  });
  const [financialStats, setFinancialStats] = useState<FinancialStats>({
    platformFees: 0, driverEarnings: 0, totalVolume: 0,
  });
  const [pendingDrivers, setPendingDrivers] = useState<PendingDriver[]>([]);
  const [pendingRestaurants, setPendingRestaurants] = useState<PendingRestaurant[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [dialogType, setDialogType] = useState<'driver' | 'restaurant' | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [platformFeePercent, setPlatformFeePercent] = useState(20);
  const [driverCommissionPercent, setDriverCommissionPercent] = useState(80);

  useEffect(() => {
    if (!user) return;
    supabase.from('platform_settings').select('key, value').then(({ data }) => {
      if (data) {
        const fee = data.find(s => s.key === 'platform_fee_percentage');
        const comm = data.find(s => s.key === 'driver_commission_percentage');
        if (fee) setPlatformFeePercent(parseFloat(fee.value));
        if (comm) setDriverCommissionPercent(parseFloat(comm.value));
      }
    });
    loadData();
    const channel = supabase.channel('admin-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, loadData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [driversRes, restaurantsRes, deliveriesRes, transactionsRes] = await Promise.all([
        supabase.from('drivers').select('*'),
        supabase.from('restaurants').select('*'),
        supabase.from('deliveries').select('*'),
        supabase.from('transactions').select('*'),
      ]);
      const drivers = driversRes.data || [];
      const restaurants = restaurantsRes.data || [];
      const deliveries = deliveriesRes.data || [];
      const transactions = transactionsRes.data || [];

      const totalRevenue = deliveries.filter(d => d.status === 'delivered')
        .reduce((s, d) => s + Number(d.price_adjusted || d.price || 0), 0);
      const platformFees = transactions.filter(t => t.type === 'platform_fee')
        .reduce((s, t) => s + Number(t.platform_fee || t.amount || 0), 0);
      const driverEarnings = transactions.filter(t => t.driver_id && t.driver_earnings)
        .reduce((s, t) => s + Number(t.driver_earnings || 0), 0);

      setStats({
        totalDrivers: drivers.length,
        approvedDrivers: drivers.filter(d => d.is_approved).length,
        pendingDrivers: drivers.filter(d => !d.is_approved).length,
        totalRestaurants: restaurants.length,
        approvedRestaurants: restaurants.filter(r => r.is_approved).length,
        pendingRestaurants: restaurants.filter(r => !r.is_approved).length,
        totalDeliveries: deliveries.length,
        activeDeliveries: deliveries.filter(d => ['pending', 'accepted', 'picked_up'].includes(d.status)).length,
        completedToday: deliveries.filter(d => d.status === 'delivered' && new Date(d.delivered_at || d.created_at) >= today).length,
        totalRevenue,
      });
      setFinancialStats({ platformFees, driverEarnings, totalVolume: totalRevenue });

      const pendingDriversList = drivers.filter(d => !d.is_approved);
      const pendingRestsList = restaurants.filter(r => !r.is_approved);

      const driversWithProfiles = await Promise.all(pendingDriversList.map(async (driver) => {
        const { data: p } = await supabase.from('profiles').select('full_name, phone').eq('id', driver.user_id).maybeSingle();
        return { id: driver.id, user_id: driver.user_id, vehicle_type: driver.vehicle_type,
          license_plate: driver.license_plate || '', created_at: driver.created_at,
          profile_name: p?.full_name || 'Sem nome', profile_phone: p?.phone || '' };
      }));
      const restaurantsWithProfiles = await Promise.all(pendingRestsList.map(async (r) => {
        const { data: p } = await supabase.from('profiles').select('full_name, phone').eq('id', r.user_id).maybeSingle();
        return { id: r.id, user_id: r.user_id, business_name: r.business_name, cnpj: r.cnpj || '',
          address: r.address, created_at: r.created_at, profile_phone: p?.phone || '' };
      }));

      setPendingDrivers(driversWithProfiles);
      setPendingRestaurants(restaurantsWithProfiles);
      setLastUpdate(new Date());
    } catch (err: any) {
      toast.error('Erro ao carregar dados do sistema');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string, type: 'driver' | 'restaurant') => {
    const table = type === 'driver' ? 'drivers' : 'restaurants';
    const { error } = await supabase.from(table).update({ is_approved: true }).eq('id', id);
    if (error) { toast.error('Erro ao aprovar cadastro'); return; }
    toast.success(`${type === 'driver' ? 'Entregador' : 'Solicitante'} aprovado!`);
    setDialogType(null); setSelectedItem(null); loadData();
  };

  const handleReject = async (id: string, type: 'driver' | 'restaurant') => {
    const { data: active } = await supabase.from('deliveries').select('id')
      .eq(type === 'driver' ? 'driver_id' : 'restaurant_id', id)
      .in('status', ['pending', 'accepted', 'picked_up']);
    if (active && active.length > 0) { toast.error(`Existem ${active.length} entregas ativas.`); return; }
    const table = type === 'driver' ? 'drivers' : 'restaurants';
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) { toast.error('Erro ao rejeitar cadastro'); return; }
    toast.success(`${type === 'driver' ? 'Entregador' : 'Solicitante'} rejeitado`);
    setDialogType(null); setSelectedItem(null); loadData();
  };

  const kpiCards = [
    {
      label: 'Entregadores', value: stats.totalDrivers, icon: Truck,
      accent: 'bg-blue-50 text-blue-600',
      sub: `${stats.approvedDrivers} ativos${stats.pendingDrivers > 0 ? ` · ${stats.pendingDrivers} pendentes` : ''}`,
      pendingAlert: stats.pendingDrivers > 0,
    },
    {
      label: 'Solicitantes', value: stats.totalRestaurants, icon: Building2,
      accent: 'bg-purple-50 text-purple-600',
      sub: `${stats.approvedRestaurants} ativos${stats.pendingRestaurants > 0 ? ` · ${stats.pendingRestaurants} pendentes` : ''}`,
      pendingAlert: stats.pendingRestaurants > 0,
    },
    {
      label: 'Entregas', value: stats.totalDeliveries, icon: PackageCheck,
      accent: 'bg-green-50 text-green-600',
      sub: `${stats.activeDeliveries} ativas · ${stats.completedToday} hoje`,
      pendingAlert: false,
    },
    {
      label: 'Volume total', value: `R$ ${stats.totalRevenue.toFixed(2)}`, icon: DollarSign,
      accent: 'bg-amber-50 text-amber-600',
      sub: 'Entregas concluídas',
      pendingAlert: false,
    },
  ];

  const pendingTotal = pendingDrivers.length + pendingRestaurants.length;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AdminSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="sticky top-0 z-10 bg-primary border-b border-primary/20">
            <div className="flex h-16 items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-primary-foreground hover:bg-white/10" />
                <div className="flex items-center gap-3">
                  <img src={leveiLogo} alt="Levei" className="h-8 w-8 rounded-lg object-cover" />
                  <div>
                    <p className="text-sm font-bold text-white leading-none">Painel Admin</p>
                    <p className="text-[10px] text-white/50 mt-0.5">
                      Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">

              {/* KPI Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {kpiCards.map((card) => (
                  <div key={card.label} className="bg-white rounded-2xl shadow-sm p-5 flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${card.accent}`}>
                      <card.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 font-medium">{card.label}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-0.5">{loading ? '—' : card.value}</p>
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        {loading ? <Skeleton className="h-3 w-24" /> : card.sub}
                      </p>
                    </div>
                    {card.pendingAlert && !loading && (
                      <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 mt-1" />
                    )}
                  </div>
                ))}
              </div>

              {/* Financial */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-green-600" />
                  <h2 className="font-semibold text-gray-900">Financeiro da plataforma</h2>
                </div>
                <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-50">
                  {[
                    { label: `Taxa plataforma (${platformFeePercent}%)`, value: financialStats.platformFees, color: 'text-green-600' },
                    { label: `Pago entregadores (${driverCommissionPercent}%)`, value: financialStats.driverEarnings, color: 'text-blue-600' },
                    { label: 'Volume total movimentado', value: financialStats.totalVolume, color: 'text-gray-900' },
                  ].map((item) => (
                    <div key={item.label} className="px-6 py-5">
                      <p className="text-xs text-gray-400">{item.label}</p>
                      <p className={`text-2xl font-bold mt-1 ${item.color}`}>
                        {loading ? '—' : `R$ ${item.value.toFixed(2)}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pending approvals */}
              {loading ? (
                <div className="bg-white rounded-2xl shadow-sm p-6 space-y-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
              ) : pendingTotal > 0 ? (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center">
                      <AlertCircle className="h-3 w-3 text-amber-600" />
                    </div>
                    <h2 className="font-semibold text-gray-900">
                      Aprovações pendentes
                    </h2>
                    <Badge className="bg-amber-100 text-amber-700 border-none ml-1">{pendingTotal}</Badge>
                  </div>

                  <div className="p-6">
                    <Tabs defaultValue="drivers">
                      <TabsList className="bg-gray-100 rounded-xl p-1 h-auto">
                        <TabsTrigger value="drivers" className="rounded-lg text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                          Entregadores ({pendingDrivers.length})
                        </TabsTrigger>
                        <TabsTrigger value="restaurants" className="rounded-lg text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
                          Solicitantes ({pendingRestaurants.length})
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="drivers" className="mt-4 space-y-2">
                        {pendingDrivers.length === 0 ? (
                          <p className="text-center py-6 text-sm text-gray-400">Nenhum entregador pendente</p>
                        ) : pendingDrivers.map((driver) => (
                          <div key={driver.id} className="flex items-center justify-between gap-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-700 font-bold text-sm">
                                {driver.profile_name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{driver.profile_name}</p>
                                <p className="text-xs text-gray-400">
                                  {vehicleLabel[driver.vehicle_type] || driver.vehicle_type}
                                  {driver.license_plate ? ` · ${driver.license_plate}` : ''}
                                  {driver.profile_phone ? ` · ${driver.profile_phone}` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={() => { setSelectedItem(driver); setDialogType('driver'); }}
                                className="h-8 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-white transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleApprove(driver.id, 'driver')}
                                className="h-8 px-3 rounded-lg bg-green-100 text-green-700 text-xs font-medium hover:bg-green-200 transition-colors flex items-center gap-1"
                              >
                                <Check className="h-3.5 w-3.5" /> Aprovar
                              </button>
                              <button
                                onClick={() => handleReject(driver.id, 'driver')}
                                className="h-8 px-3 rounded-lg bg-red-100 text-red-600 text-xs font-medium hover:bg-red-200 transition-colors flex items-center gap-1"
                              >
                                <X className="h-3.5 w-3.5" /> Rejeitar
                              </button>
                            </div>
                          </div>
                        ))}
                      </TabsContent>

                      <TabsContent value="restaurants" className="mt-4 space-y-2">
                        {pendingRestaurants.length === 0 ? (
                          <p className="text-center py-6 text-sm text-gray-400">Nenhum solicitante pendente</p>
                        ) : pendingRestaurants.map((r) => (
                          <div key={r.id} className="flex items-center justify-between gap-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 text-purple-700 font-bold text-sm">
                                {r.business_name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{r.business_name}</p>
                                <p className="text-xs text-gray-400">
                                  {r.cnpj || 'Sem CNPJ'}
                                  {r.profile_phone ? ` · ${r.profile_phone}` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={() => { setSelectedItem(r); setDialogType('restaurant'); }}
                                className="h-8 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-white transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleApprove(r.id, 'restaurant')}
                                className="h-8 px-3 rounded-lg bg-green-100 text-green-700 text-xs font-medium hover:bg-green-200 transition-colors flex items-center gap-1"
                              >
                                <Check className="h-3.5 w-3.5" /> Aprovar
                              </button>
                              <button
                                onClick={() => handleReject(r.id, 'restaurant')}
                                className="h-8 px-3 rounded-lg bg-red-100 text-red-600 text-xs font-medium hover:bg-red-200 transition-colors flex items-center gap-1"
                              >
                                <X className="h-3.5 w-3.5" /> Rejeitar
                              </button>
                            </div>
                          </div>
                        ))}
                      </TabsContent>
                    </Tabs>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-100 mx-auto mb-3 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">Todas as aprovações estão em dia</p>
                  <p className="text-xs text-gray-400 mt-1">Nenhum cadastro aguardando revisão</p>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={dialogType !== null} onOpenChange={(open) => !open && setDialogType(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogType === 'driver' ? 'Detalhes do entregador' : 'Detalhes do solicitante'}
            </DialogTitle>
            <DialogDescription>Informações completas do cadastro</DialogDescription>
          </DialogHeader>

          {selectedItem && dialogType === 'driver' && (
            <div className="grid grid-cols-2 gap-4 py-2">
              {[
                { label: 'Nome', value: selectedItem.profile_name },
                { label: 'Telefone', value: selectedItem.profile_phone || '—' },
                { label: 'Veículo', value: vehicleLabel[selectedItem.vehicle_type] || selectedItem.vehicle_type },
                { label: 'Placa', value: selectedItem.license_plate || '—' },
                { label: 'Cadastrado em', value: new Date(selectedItem.created_at).toLocaleDateString('pt-BR') },
              ].map((f) => (
                <div key={f.label}>
                  <p className="text-xs text-gray-400">{f.label}</p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">{f.value}</p>
                </div>
              ))}
            </div>
          )}

          {selectedItem && dialogType === 'restaurant' && (
            <div className="grid grid-cols-2 gap-4 py-2">
              {[
                { label: 'Nome do negócio', value: selectedItem.business_name },
                { label: 'CNPJ', value: selectedItem.cnpj || '—' },
                { label: 'Telefone', value: selectedItem.profile_phone || '—' },
                { label: 'Cadastrado em', value: new Date(selectedItem.created_at).toLocaleDateString('pt-BR') },
                { label: 'Endereço', value: selectedItem.address, full: true },
              ].map((f) => (
                <div key={f.label} className={f.full ? 'col-span-2' : ''}>
                  <p className="text-xs text-gray-400">{f.label}</p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">{f.value}</p>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="gap-2 pt-2">
            <button
              onClick={() => setDialogType(null)}
              className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Fechar
            </button>
            {selectedItem && (
              <>
                <button
                  onClick={() => handleApprove(selectedItem.id, dialogType!)}
                  className="flex-1 h-10 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="h-4 w-4" /> Aprovar
                </button>
                <button
                  onClick={() => handleReject(selectedItem.id, dialogType!)}
                  className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                >
                  <X className="h-4 w-4" /> Rejeitar
                </button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
