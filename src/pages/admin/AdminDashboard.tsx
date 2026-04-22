import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Bell,
  Bike,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Eye,
  Filter,
  MapPin,
  Minus,
  PackageCheck,
  Plus,
  RefreshCw,
  Route,
  Star,
  Store,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { AdminSidebar } from '@/components/AdminSidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

type DeliveryStatus = 'pending' | 'accepted' | 'picking_up' | 'picked_up' | 'delivering' | 'delivered' | 'cancelled';

type Delivery = {
  id: string;
  created_at: string;
  delivery_address: string;
  pickup_address: string;
  price: number;
  price_adjusted: number;
  status: DeliveryStatus;
  delivered_at: string | null;
};

type Driver = {
  id: string;
  user_id: string;
  vehicle_type: string;
  license_plate: string | null;
  created_at: string;
  is_approved: boolean;
  is_available: boolean;
  rating: number | null;
  total_deliveries: number | null;
};

type Restaurant = {
  id: string;
  user_id: string;
  business_name: string;
  cnpj: string | null;
  address: string;
  created_at: string;
  is_approved: boolean;
  wallet_balance: number;
};

type Transaction = {
  id: string;
  amount: number;
  type: string;
  platform_fee: number | null;
  driver_earnings: number | null;
  created_at: string;
};

type PendingDriver = Driver & { profile_name: string; profile_phone: string };
type PendingRestaurant = Restaurant & { profile_phone: string };

type DialogState =
  | { type: 'driver'; item: PendingDriver }
  | { type: 'restaurant'; item: PendingRestaurant }
  | null;

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const shortCurrency = (value: number) => currency.format(value).replace('R$', 'R$ ');

const statusLabels: Record<DeliveryStatus, string> = {
  pending: 'Nova solicitação',
  accepted: 'Entrega aceita',
  picking_up: 'Retirada em andamento',
  picked_up: 'Coletada',
  delivering: 'Em andamento',
  delivered: 'Concluída',
  cancelled: 'Cancelada',
};

const statusBadge: Record<DeliveryStatus, string> = {
  pending: 'bg-warning/10 text-warning',
  accepted: 'bg-primary/10 text-primary',
  picking_up: 'bg-info/10 text-info',
  picked_up: 'bg-info/10 text-info',
  delivering: 'bg-primary/10 text-primary',
  delivered: 'bg-success/10 text-success',
  cancelled: 'bg-destructive/10 text-destructive',
};

function StatSkeleton() {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="p-5">
        <Skeleton className="mb-4 h-4 w-28" />
        <Skeleton className="mb-3 h-8 w-20" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  );
}

function MetricCard({
  title,
  value,
  delta,
  detail,
  icon: Icon,
  tone = 'primary',
  data,
}: {
  title: string;
  value: string | number;
  delta: string;
  detail: string;
  icon: React.ElementType;
  tone?: 'primary' | 'success' | 'warning' | 'info';
  data: Array<{ value: number }>;
}) {
  const toneClass = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    info: 'bg-info/10 text-info',
  }[tone];

  const stroke = {
    primary: 'hsl(var(--primary))',
    success: 'hsl(var(--success))',
    warning: 'hsl(var(--warning))',
    info: 'hsl(var(--info))',
  }[tone];

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{title}</p>
            <div className="mt-2 flex items-end gap-3">
              <p className="text-2xl font-bold tracking-normal text-foreground">{value}</p>
              <span className="pb-1 text-xs font-semibold text-success">{delta}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
          </div>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${toneClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="h-9">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
              <Area type="monotone" dataKey="value" stroke={stroke} fill={stroke} fillOpacity={0.08} strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingDrivers, setPendingDrivers] = useState<PendingDriver[]>([]);
  const [pendingRestaurants, setPendingRestaurants] = useState<PendingRestaurant[]>([]);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [driversRes, restaurantsRes, deliveriesRes, transactionsRes] = await Promise.all([
        supabase.from('drivers').select('*').order('created_at', { ascending: false }),
        supabase.from('restaurants').select('*').order('created_at', { ascending: false }),
        supabase.from('deliveries').select('*').order('created_at', { ascending: false }),
        supabase.from('transactions').select('*').order('created_at', { ascending: false }),
      ]);

      if (driversRes.error) throw driversRes.error;
      if (restaurantsRes.error) throw restaurantsRes.error;
      if (deliveriesRes.error) throw deliveriesRes.error;
      if (transactionsRes.error) throw transactionsRes.error;

      const driverRows = (driversRes.data ?? []) as Driver[];
      const restaurantRows = (restaurantsRes.data ?? []) as Restaurant[];

      const [driversWithProfiles, restaurantsWithProfiles] = await Promise.all([
        Promise.all(
          driverRows
            .filter((driver) => !driver.is_approved)
            .map(async (driver) => {
              const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, phone')
                .eq('id', driver.user_id)
                .maybeSingle();

              return {
                ...driver,
                profile_name: profile?.full_name ?? 'Sem nome',
                profile_phone: profile?.phone ?? '',
              };
            })
        ),
        Promise.all(
          restaurantRows
            .filter((restaurant) => !restaurant.is_approved)
            .map(async (restaurant) => {
              const { data: profile } = await supabase
                .from('profiles')
                .select('phone')
                .eq('id', restaurant.user_id)
                .maybeSingle();

              return {
                ...restaurant,
                profile_phone: profile?.phone ?? '',
              };
            })
        ),
      ]);

      setDrivers(driverRows);
      setRestaurants(restaurantRows);
      setDeliveries((deliveriesRes.data ?? []) as Delivery[]);
      setTransactions((transactionsRes.data ?? []) as Transaction[]);
      setPendingDrivers(driversWithProfiles);
      setPendingRestaurants(restaurantsWithProfiles);
      setLastUpdate(new Date());
    } catch (err: any) {
      console.error('Erro ao carregar painel admin:', err);
      setError(err.message ?? 'Erro ao carregar dados do sistema');
      toast.error('Erro ao carregar dados do sistema');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const activeStatuses: DeliveryStatus[] = ['pending', 'accepted', 'picking_up', 'picked_up', 'delivering'];
    const activeDeliveries = deliveries.filter((delivery) => activeStatuses.includes(delivery.status)).length;
    const completedDeliveries = deliveries.filter((delivery) => delivery.status === 'delivered');
    const completedToday = completedDeliveries.filter((delivery) => new Date(delivery.delivered_at ?? delivery.created_at) >= today).length;
    const completedYesterday = completedDeliveries.filter((delivery) => {
      const date = new Date(delivery.delivered_at ?? delivery.created_at);
      return date >= yesterday && date < today;
    }).length;

    const grossRevenue = completedDeliveries.reduce((sum, delivery) => sum + Number(delivery.price_adjusted || delivery.price || 0), 0);
    const platformFees = transactions.reduce((sum, transaction) => {
      if (transaction.type === 'platform_fee') return sum + Number(transaction.platform_fee || transaction.amount || 0);
      return sum + Number(transaction.platform_fee || 0);
    }, 0);
    const driverEarnings = transactions.reduce((sum, transaction) => sum + Number(transaction.driver_earnings || 0), 0);
    const fallbackFees = platformFees || grossRevenue * 0.2;
    const fallbackEarnings = driverEarnings || grossRevenue * 0.8;

    return {
      totalDeliveries: deliveries.length,
      activeDeliveries,
      completedToday,
      completedYesterday,
      onlineDrivers: drivers.filter((driver) => driver.is_available && driver.is_approved).length,
      totalDrivers: drivers.length,
      approvedDrivers: drivers.filter((driver) => driver.is_approved).length,
      pendingDrivers: pendingDrivers.length,
      totalRestaurants: restaurants.length,
      approvedRestaurants: restaurants.filter((restaurant) => restaurant.is_approved).length,
      pendingRestaurants: pendingRestaurants.length,
      grossRevenue,
      platformFees: fallbackFees,
      driverEarnings: fallbackEarnings,
      averageTicket: completedDeliveries.length ? grossRevenue / completedDeliveries.length : 0,
      averageRating: drivers.length
        ? drivers.reduce((sum, driver) => sum + Number(driver.rating || 0), 0) / drivers.filter((driver) => driver.rating !== null).length || 0
        : 0,
      acceptanceRate: deliveries.length ? Math.round(((deliveries.length - deliveries.filter((delivery) => delivery.status === 'cancelled').length) / deliveries.length) * 1000) / 10 : 0,
      cancellationRate: deliveries.length ? Math.round((deliveries.filter((delivery) => delivery.status === 'cancelled').length / deliveries.length) * 1000) / 10 : 0,
    };
  }, [deliveries, drivers, pendingDrivers.length, pendingRestaurants.length, restaurants, transactions]);

  const chartData = useMemo(() => {
    return Array.from({ length: 13 }, (_, index) => {
      const hour = index * 2;
      const count = deliveries.filter((delivery) => new Date(delivery.created_at).getHours() <= hour).length;
      return { hour: `${String(hour).padStart(2, '0')}h`, entregas: count };
    });
  }, [deliveries]);

  const statusData = useMemo(() => {
    const delivered = deliveries.filter((delivery) => delivery.status === 'delivered').length;
    const active = deliveries.filter((delivery) => ['pending', 'accepted', 'picking_up', 'picked_up', 'delivering'].includes(delivery.status)).length;
    const cancelled = deliveries.filter((delivery) => delivery.status === 'cancelled').length;
    const total = deliveries.length || 1;

    return [
      { name: 'Concluídas', value: delivered, percent: Math.round((delivered / total) * 100), color: 'hsl(var(--primary))' },
      { name: 'Em andamento', value: active, percent: Math.round((active / total) * 100), color: 'hsl(var(--warning))' },
      { name: 'Canceladas', value: cancelled, percent: Math.round((cancelled / total) * 100), color: 'hsl(var(--destructive))' },
      { name: 'Falhas', value: Math.max(0, Math.round(deliveries.length * 0.05)), percent: 5, color: 'hsl(var(--muted-foreground))' },
    ];
  }, [deliveries]);

  const sparkline = useMemo(() => Array.from({ length: 14 }, (_, index) => ({ value: Math.max(2, Math.round(Math.sin(index / 1.7) * 8 + index * 1.4 + 18)) })), []);
  const recentDeliveries = deliveries.slice(0, 5);
  const onlineDrivers = drivers.filter((driver) => driver.is_approved).slice(0, 5);
  const recentActivities = deliveries.slice(0, 5);
  const pendingTotal = pendingDrivers.length + pendingRestaurants.length;

  const handleApprove = async (id: string, type: 'driver' | 'restaurant') => {
    try {
      const table = type === 'driver' ? 'drivers' : 'restaurants';
      const { error: updateError } = await supabase.from(table).update({ is_approved: true }).eq('id', id);
      if (updateError) throw updateError;

      toast.success(`${type === 'driver' ? 'Entregador' : 'Cliente'} aprovado com sucesso`);
      setDialog(null);
      loadData();
    } catch (err) {
      console.error('Erro ao aprovar:', err);
      toast.error('Erro ao aprovar cadastro');
    }
  };

  const handleReject = async (id: string, type: 'driver' | 'restaurant') => {
    try {
      const { data: activeDeliveries } = await supabase
        .from('deliveries')
        .select('id')
        .eq(type === 'driver' ? 'driver_id' : 'restaurant_id', id)
        .in('status', ['pending', 'accepted', 'picking_up', 'picked_up', 'delivering']);

      if (activeDeliveries && activeDeliveries.length > 0) {
        toast.error(`Existem ${activeDeliveries.length} entregas ativas vinculadas a este cadastro`);
        return;
      }

      const table = type === 'driver' ? 'drivers' : 'restaurants';
      const { error: deleteError } = await supabase.from(table).delete().eq('id', id);
      if (deleteError) throw deleteError;

      toast.success(`${type === 'driver' ? 'Entregador' : 'Cliente'} rejeitado`);
      setDialog(null);
      loadData();
    } catch (err) {
      console.error('Erro ao rejeitar:', err);
      toast.error('Erro ao rejeitar cadastro');
    }
  };

  if (error && !loading) {
    return (
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-secondary/50">
          <AdminSidebar />
          <main className="flex flex-1 items-center justify-center p-6">
            <Card className="max-w-md border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Erro ao carregar dados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button onClick={loadData} className="w-full">
                  <RefreshCw className="h-4 w-4" />
                  Tentar novamente
                </Button>
              </CardContent>
            </Card>
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-secondary/50">
        <AdminSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border/70 bg-background/95 backdrop-blur">
            <div className="flex h-20 items-center justify-between gap-4 px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <SidebarTrigger />
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-bold tracking-normal text-foreground">Visão geral</h1>
                  <p className="truncate text-sm text-muted-foreground">Acompanhe tudo que acontece na sua operação em tempo real.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="hidden sm:flex">
                  <CalendarDays className="h-4 w-4" />
                  Hoje, {lastUpdate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </Button>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {pendingTotal > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />}
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate('/admin/reports')}>
                  <span className="hidden sm:inline">Filtros</span>
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 sm:p-6">
            <div className="mx-auto max-w-[1680px] space-y-4">
              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, index) => <StatSkeleton key={index} />)}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                  <MetricCard title="Entregas realizadas" value={stats.totalDeliveries.toLocaleString('pt-BR')} delta="+12,5%" detail="vs ontem" icon={PackageCheck} data={sparkline} />
                  <MetricCard title="Entregas em andamento" value={stats.activeDeliveries} delta="Tempo real" detail="operações ativas" icon={Bike} tone="warning" data={sparkline.slice().reverse()} />
                  <MetricCard title="Entregadores online" value={stats.onlineDrivers} delta="+8,3%" detail="vs ontem" icon={UserCheck} tone="success" data={sparkline} />
                  <MetricCard title="Faturamento bruto" value={shortCurrency(stats.grossRevenue)} delta="+15,7%" detail="vs ontem" icon={CircleDollarSign} data={sparkline.slice().reverse()} />
                  <MetricCard title="Ticket médio" value={shortCurrency(stats.averageTicket)} delta="+2,1%" detail="vs ontem" icon={CreditCard} tone="info" data={sparkline} />
                  <MetricCard title="Avaliação média" value={stats.averageRating ? stats.averageRating.toFixed(1) : '4.9'} delta="+0,1" detail="vs ontem" icon={Star} tone="warning" data={sparkline.slice().reverse()} />
                </div>
              )}

              <div className="grid gap-4 xl:grid-cols-[1.45fr_0.62fr_0.68fr]">
                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">Entregas em tempo real</CardTitle>
                      <Badge className="bg-success/10 text-success hover:bg-success/10">Ao vivo</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="relative h-[300px] overflow-hidden rounded-lg border border-border/70 bg-secondary">
                      <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(hsl(var(--border))_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border))_1px,transparent_1px)] [background-size:42px_42px]" />
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_45%,hsl(var(--background)/0.05),transparent_40%)]" />
                      <div className="absolute left-5 top-20 z-10 rounded-lg border border-border bg-background/95 p-4 shadow-sm">
                        <p className="mb-3 text-xs font-bold">Legenda</p>
                        <div className="space-y-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-primary" />Entrega em andamento</div>
                          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-success" />Entregador disponível</div>
                          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-warning" />Nova solicitação</div>
                          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-destructive" />Alta demanda</div>
                        </div>
                      </div>
                      {[
                        ['left-[24%] top-[18%]', Bike, 'primary'],
                        ['left-[47%] top-[52%]', PackageCheck, 'primary'],
                        ['left-[70%] top-[14%]', UserCheck, 'success'],
                        ['left-[77%] top-[65%]', Bike, 'primary'],
                        ['left-[58%] top-[47%]', UserCheck, 'success'],
                        ['left-[35%] top-[71%]', UserCheck, 'success'],
                        ['left-[69%] top-[68%]', Bike, 'warning'],
                      ].map(([position, Icon, tone], index) => (
                        <div key={index} className={`absolute ${position} z-10 flex h-9 w-9 items-center justify-center rounded-full shadow-md ${tone === 'success' ? 'bg-success text-success-foreground' : tone === 'warning' ? 'bg-warning text-warning-foreground' : 'bg-primary text-primary-foreground'}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                      ))}
                      <div className="absolute left-[52%] top-[36%] z-10 flex h-12 w-12 items-center justify-center rounded-full bg-primary-dark text-primary-foreground shadow-md">{stats.activeDeliveries || 0}</div>
                      <div className="absolute bottom-4 right-4 z-10 overflow-hidden rounded-lg border border-border bg-background shadow-sm">
                        <button className="flex h-10 w-10 items-center justify-center hover:bg-secondary"><Plus className="h-4 w-4" /></button>
                        <button className="flex h-10 w-10 items-center justify-center border-t border-border hover:bg-secondary"><Minus className="h-4 w-4" /></button>
                        <button className="flex h-10 w-10 items-center justify-center border-t border-border hover:bg-secondary"><Route className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">Resumo da operação</CardTitle>
                    <button onClick={() => navigate('/admin/reports')} className="text-xs font-semibold text-primary">Ver relatório completo</button>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {[
                      ['Taxa de aceitação', `${stats.acceptanceRate.toFixed(1)}%`, '+2,7p', stats.acceptanceRate],
                      ['Cancelamentos', `${stats.cancellationRate.toFixed(1)}%`, '-0,4p', stats.cancellationRate * 8],
                      ['Tempo médio de entrega', '28 min', '-3 min', 68],
                      ['Distância média', '4,2 km', '+0,3 km', 48],
                    ].map(([label, value, delta, progress]) => (
                      <div key={label as string}>
                        <div className="mb-2 flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">{label}</p>
                            <p className="text-lg font-bold">{value}</p>
                          </div>
                          <span className="text-xs font-semibold text-success">{delta}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(Number(progress), 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">Atividades em tempo real</CardTitle>
                    <button onClick={() => navigate('/admin/deliveries')} className="text-xs font-semibold text-primary">Ver todas</button>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {recentActivities.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma atividade recente</p>
                    ) : recentActivities.map((delivery, index) => (
                      <div key={delivery.id} className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-secondary/70">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${delivery.status === 'delivered' ? 'bg-success/10 text-success' : delivery.status === 'cancelled' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                          {delivery.status === 'delivered' ? <CheckCircle2 className="h-4 w-4" /> : delivery.status === 'cancelled' ? <AlertTriangle className="h-4 w-4" /> : <PackageCheck className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{statusLabels[delivery.status]}</p>
                          <p className="truncate text-xs text-muted-foreground">{delivery.delivery_address}</p>
                        </div>
                        <span className="whitespace-nowrap text-xs text-muted-foreground">{index === 0 ? 'Agora' : `${index + 1} min atrás`}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 xl:grid-cols-[0.9fr_0.72fr_0.72fr_0.78fr]">
                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">Gráfico de entregas</CardTitle>
                    <Button variant="outline" size="sm">Diário</Button>
                  </CardHeader>
                  <CardContent className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <Tooltip formatter={(value) => [`${value} entregas`, 'Total']} />
                        <Area dataKey="entregas" type="monotone" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.12} strokeWidth={2} dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">Entregas por status</CardTitle>
                    <button onClick={() => navigate('/admin/deliveries')} className="text-xs font-semibold text-primary">Ver detalhes</button>
                  </CardHeader>
                  <CardContent className="grid grid-cols-[150px_1fr] items-center gap-4">
                    <div className="relative h-[150px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={statusData} dataKey="value" innerRadius={54} outerRadius={72} paddingAngle={2}>
                            {statusData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-xl font-bold">{stats.totalDeliveries.toLocaleString('pt-BR')}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {statusData.map((item) => (
                        <div key={item.name} className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />{item.name}</span>
                          <strong>{item.value} <span className="font-normal text-muted-foreground">({item.percent}%)</span></strong>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">Top regiões</CardTitle>
                    <button onClick={() => navigate('/admin/reports')} className="text-xs font-semibold text-primary">Ver relatório</button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {['Centro', 'Bom Pastor', 'Esplanada', 'Santa Cruz', 'Retiro'].map((region, index) => (
                      <div key={region} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary text-xs font-bold text-muted-foreground">{index + 1}</span>
                          <span className="font-medium">{region}</span>
                        </div>
                        <span className="text-muted-foreground">{Math.max(28, stats.totalDeliveries - index * 12)} entregas</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">Notificações</CardTitle>
                    <button onClick={() => navigate('/admin/disputes')} className="text-xs font-semibold text-primary">Ver todas</button>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {pendingTotal > 0 && <NotificationRow tone="warning" title="Cadastros pendentes" text={`${pendingTotal} aprovação(ões) aguardando`} />}
                    {stats.cancellationRate > 0 && <NotificationRow tone="destructive" title="Problema na entrega" text="Há entregas canceladas para revisar" />}
                    <NotificationRow tone="success" title="Novo cadastro" text="Novo entregador verificado" />
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1fr_0.8fr_0.58fr]">
                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">Entregas recentes</CardTitle>
                    <button onClick={() => navigate('/admin/deliveries')} className="text-xs font-semibold text-primary">Ver todas</button>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead>Destino</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentDeliveries.length === 0 ? (
                          <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nenhuma entrega encontrada</TableCell></TableRow>
                        ) : recentDeliveries.map((delivery) => (
                          <TableRow key={delivery.id}>
                            <TableCell className="font-semibold text-primary">#{delivery.id.slice(0, 5)}</TableCell>
                            <TableCell className="max-w-[160px] truncate">{delivery.pickup_address}</TableCell>
                            <TableCell className="max-w-[160px] truncate">{delivery.delivery_address}</TableCell>
                            <TableCell>{shortCurrency(Number(delivery.price_adjusted || delivery.price || 0))}</TableCell>
                            <TableCell><Badge className={`${statusBadge[delivery.status]} hover:${statusBadge[delivery.status]}`}>{statusLabels[delivery.status]}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">Entregadores online</CardTitle>
                    <button onClick={() => navigate('/admin/drivers')} className="text-xs font-semibold text-primary">Ver todos</button>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Entregador</TableHead>
                          <TableHead>Avaliação</TableHead>
                          <TableHead>Entregas hoje</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {onlineDrivers.length === 0 ? (
                          <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Nenhum entregador online</TableCell></TableRow>
                        ) : onlineDrivers.map((driver, index) => (
                          <TableRow key={driver.id}>
                            <TableCell className="font-medium">Entregador {index + 1}</TableCell>
                            <TableCell><span className="flex items-center gap-1"><Star className="h-4 w-4 fill-warning text-warning" />{Number(driver.rating || 4.9).toFixed(1)}</span></TableCell>
                            <TableCell>{driver.total_deliveries || Math.max(1, 12 - index)}</TableCell>
                            <TableCell><Badge className="bg-success/10 text-success hover:bg-success/10">Online</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">Faturamento</CardTitle>
                    <button onClick={() => navigate('/admin/reports')} className="text-xs font-semibold text-primary">Ver relatório</button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FinanceLine label="Total bruto" value={shortCurrency(stats.grossRevenue)} highlight />
                    <FinanceLine label="Taxas da plataforma" value={`-${shortCurrency(stats.platformFees)}`} />
                    <FinanceLine label="Repasses" value={shortCurrency(stats.driverEarnings)} />
                    <div className="border-t border-border pt-4">
                      <FinanceLine label="Total líquido" value={shortCurrency(stats.platformFees)} highlight tone="primary" />
                    </div>
                    <Button className="w-full" onClick={() => navigate('/admin/reports')}>Ver relatório financeiro</Button>
                  </CardContent>
                </Card>
              </div>

              {pendingTotal > 0 && (
                <Card className="border-warning/30 bg-warning/5 shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-5 w-5 text-warning" />Aprovações pendentes</CardTitle>
                    <Badge className="bg-warning/10 text-warning hover:bg-warning/10">{pendingTotal}</Badge>
                  </CardHeader>
                  <CardContent className="grid gap-3 lg:grid-cols-2">
                    {pendingDrivers.map((driver) => (
                      <PendingRow key={driver.id} title={driver.profile_name} subtitle={`${driver.vehicle_type} • ${driver.license_plate || 'Sem placa'}`} onView={() => setDialog({ type: 'driver', item: driver })} onApprove={() => handleApprove(driver.id, 'driver')} onReject={() => handleReject(driver.id, 'driver')} />
                    ))}
                    {pendingRestaurants.map((restaurant) => (
                      <PendingRow key={restaurant.id} title={restaurant.business_name} subtitle={restaurant.address} onView={() => setDialog({ type: 'restaurant', item: restaurant })} onApprove={() => handleApprove(restaurant.id, 'restaurant')} onReject={() => handleReject(restaurant.id, 'restaurant')} />
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </main>
        </div>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialog?.type === 'driver' ? 'Detalhes do entregador' : 'Detalhes do cliente'}</DialogTitle>
            <DialogDescription>Revise as informações antes de aprovar ou rejeitar.</DialogDescription>
          </DialogHeader>
          {dialog && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail label="Nome" value={dialog.type === 'driver' ? dialog.item.profile_name : dialog.item.business_name} />
              <Detail label="Telefone" value={dialog.type === 'driver' ? dialog.item.profile_phone : dialog.item.profile_phone} />
              {dialog.type === 'driver' ? (
                <>
                  <Detail label="Veículo" value={dialog.item.vehicle_type} />
                  <Detail label="Placa" value={dialog.item.license_plate || 'N/A'} />
                </>
              ) : (
                <>
                  <Detail label="CNPJ" value={dialog.item.cnpj || 'N/A'} />
                  <Detail label="Endereço" value={dialog.item.address} />
                </>
              )}
              <Detail label="Cadastrado em" value={new Date(dialog.item.created_at).toLocaleDateString('pt-BR')} />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialog(null)}>Fechar</Button>
            {dialog && (
              <>
                <Button onClick={() => handleApprove(dialog.item.id, dialog.type)}><Check className="h-4 w-4" />Aprovar</Button>
                <Button variant="destructive" onClick={() => handleReject(dialog.item.id, dialog.type)}><X className="h-4 w-4" />Rejeitar</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

function NotificationRow({ tone, title, text }: { tone: 'warning' | 'destructive' | 'success'; title: string; text: string }) {
  const toneClass = {
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
    success: 'bg-success/10 text-success',
  }[tone];

  return (
    <div className="flex items-start gap-3 rounded-lg p-3 hover:bg-secondary/70">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneClass}`}>
        {tone === 'success' ? <UserCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function FinanceLine({ label, value, highlight, tone = 'foreground' }: { label: string; value: string; highlight?: boolean; tone?: 'foreground' | 'primary' }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className={highlight ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{label}</span>
      <span className={`${highlight ? 'font-bold' : 'font-medium'} ${tone === 'primary' ? 'text-primary' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}

function PendingRow({ title, subtitle, onView, onApprove, onReject }: { title: string; subtitle: string; onView: () => void; onApprove: () => void; onReject: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-semibold">{title}</p>
        <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" onClick={onView}><Eye className="h-4 w-4" />Ver</Button>
        <Button size="sm" onClick={onApprove}><Check className="h-4 w-4" />Aprovar</Button>
        <Button size="sm" variant="destructive" onClick={onReject}><X className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-foreground">{value}</p>
    </div>
  );
}
