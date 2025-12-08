import { useState, useEffect } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, subDays, startOfDay, endOfDay, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, eachMonthOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DollarSign, TrendingUp, TrendingDown, Wallet, RefreshCw, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface DailyRevenue {
  date: string;
  receita: number;
  taxaPlataforma: number;
  pagamentoEntregadores: number;
}

interface MonthlyRevenue {
  month: string;
  receita: number;
  taxaPlataforma: number;
  pagamentoEntregadores: number;
}

interface FinancialStats {
  totalReceita: number;
  totalTaxaPlataforma: number;
  totalPagamentoEntregadores: number;
  totalEntregas: number;
  ticketMedio: number;
  crescimentoReceita: number;
}

const CHART_COLORS = {
  receita: 'hsl(var(--primary))',
  taxaPlataforma: 'hsl(142, 76%, 36%)',
  pagamentoEntregadores: 'hsl(38, 92%, 50%)',
};

const PIE_COLORS = ['hsl(var(--primary))', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)'];

export default function AdminFinancialReports() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '12m'>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailyData, setDailyData] = useState<DailyRevenue[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyRevenue[]>([]);
  const [stats, setStats] = useState<FinancialStats>({
    totalReceita: 0,
    totalTaxaPlataforma: 0,
    totalPagamentoEntregadores: 0,
    totalEntregas: 0,
    ticketMedio: 0,
    crescimentoReceita: 0,
  });

  const fetchFinancialData = async () => {
    setLoading(true);
    setError(null);

    try {
      let startDate: Date;
      let endDate = new Date();
      let useMonthly = false;

      switch (period) {
        case '7d':
          startDate = subDays(endDate, 7);
          break;
        case '30d':
          startDate = subDays(endDate, 30);
          break;
        case '90d':
          startDate = subDays(endDate, 90);
          break;
        case '12m':
          startDate = subMonths(endDate, 12);
          useMonthly = true;
          break;
        default:
          startDate = subDays(endDate, 30);
      }

      // Buscar entregas finalizadas no período
      const { data: deliveries, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('id, price_adjusted, delivered_at, created_at')
        .eq('status', 'delivered')
        .gte('delivered_at', startDate.toISOString())
        .lte('delivered_at', endDate.toISOString())
        .order('delivered_at', { ascending: true });

      if (deliveriesError) throw deliveriesError;

      // Buscar entregas do período anterior para calcular crescimento
      const previousStartDate = useMonthly ? subMonths(startDate, 12) : subDays(startDate, period === '7d' ? 7 : period === '30d' ? 30 : 90);
      const { data: previousDeliveries, error: previousError } = await supabase
        .from('deliveries')
        .select('price_adjusted')
        .eq('status', 'delivered')
        .gte('delivered_at', previousStartDate.toISOString())
        .lt('delivered_at', startDate.toISOString());

      if (previousError) throw previousError;

      // Calcular estatísticas gerais
      const totalReceita = deliveries?.reduce((sum, d) => sum + (d.price_adjusted || 0), 0) || 0;
      const totalTaxaPlataforma = totalReceita * 0.20;
      const totalPagamentoEntregadores = totalReceita * 0.80;
      const totalEntregas = deliveries?.length || 0;
      const ticketMedio = totalEntregas > 0 ? totalReceita / totalEntregas : 0;

      const previousTotalReceita = previousDeliveries?.reduce((sum, d) => sum + (d.price_adjusted || 0), 0) || 0;
      const crescimentoReceita = previousTotalReceita > 0 
        ? ((totalReceita - previousTotalReceita) / previousTotalReceita) * 100 
        : 0;

      setStats({
        totalReceita,
        totalTaxaPlataforma,
        totalPagamentoEntregadores,
        totalEntregas,
        ticketMedio,
        crescimentoReceita,
      });

      // Preparar dados para gráficos
      if (useMonthly) {
        const months = eachMonthOfInterval({ start: startDate, end: endDate });
        const monthlyRevenue: MonthlyRevenue[] = months.map(month => {
          const monthStart = startOfMonth(month);
          const monthEnd = endOfMonth(month);
          const monthDeliveries = deliveries?.filter(d => {
            const deliveredAt = new Date(d.delivered_at!);
            return deliveredAt >= monthStart && deliveredAt <= monthEnd;
          }) || [];
          
          const receita = monthDeliveries.reduce((sum, d) => sum + (d.price_adjusted || 0), 0);
          return {
            month: format(month, 'MMM yyyy', { locale: ptBR }),
            receita,
            taxaPlataforma: receita * 0.20,
            pagamentoEntregadores: receita * 0.80,
          };
        });
        setMonthlyData(monthlyRevenue);
        setDailyData([]);
      } else {
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        const dailyRevenue: DailyRevenue[] = days.map(day => {
          const dayStart = startOfDay(day);
          const dayEnd = endOfDay(day);
          const dayDeliveries = deliveries?.filter(d => {
            const deliveredAt = new Date(d.delivered_at!);
            return deliveredAt >= dayStart && deliveredAt <= dayEnd;
          }) || [];
          
          const receita = dayDeliveries.reduce((sum, d) => sum + (d.price_adjusted || 0), 0);
          return {
            date: format(day, 'dd/MM', { locale: ptBR }),
            receita,
            taxaPlataforma: receita * 0.20,
            pagamentoEntregadores: receita * 0.80,
          };
        });
        setDailyData(dailyRevenue);
        setMonthlyData([]);
      }
    } catch (err) {
      console.error('Erro ao carregar dados financeiros:', err);
      setError('Erro ao carregar dados financeiros');
      toast.error('Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancialData();
  }, [period]);

  const chartData = period === '12m' ? monthlyData : dailyData;
  const xAxisKey = period === '12m' ? 'month' : 'date';

  const pieData = [
    { name: 'Taxa Plataforma (20%)', value: stats.totalTaxaPlataforma },
    { name: 'Pagamento Entregadores (80%)', value: stats.totalPagamentoEntregadores },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Relatórios Financeiros</h1>
                <p className="text-muted-foreground">Análise detalhada de receitas e transações</p>
              </div>
              <div className="flex items-center gap-3">
                <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
                  <SelectTrigger className="w-[150px]">
                    <Calendar className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Últimos 7 dias</SelectItem>
                    <SelectItem value="30d">Últimos 30 dias</SelectItem>
                    <SelectItem value="90d">Últimos 90 dias</SelectItem>
                    <SelectItem value="12m">Últimos 12 meses</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={fetchFinancialData} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {error ? (
              <Card className="border-destructive">
                <CardContent className="p-6 text-center">
                  <p className="text-destructive mb-4">{error}</p>
                  <Button onClick={fetchFinancialData}>Tentar novamente</Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      {loading ? (
                        <Skeleton className="h-20 w-full" />
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Receita Total</p>
                            <p className="text-2xl font-bold text-foreground">{formatCurrency(stats.totalReceita)}</p>
                            <div className={`flex items-center gap-1 text-sm ${stats.crescimentoReceita >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                              {stats.crescimentoReceita >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {Math.abs(stats.crescimentoReceita).toFixed(1)}% vs período anterior
                            </div>
                          </div>
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <DollarSign className="h-6 w-6 text-primary" />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      {loading ? (
                        <Skeleton className="h-20 w-full" />
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Taxa Plataforma (20%)</p>
                            <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalTaxaPlataforma)}</p>
                            <p className="text-sm text-muted-foreground">{stats.totalEntregas} entregas</p>
                          </div>
                          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                            <Wallet className="h-6 w-6 text-green-600" />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      {loading ? (
                        <Skeleton className="h-20 w-full" />
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Pago a Entregadores (80%)</p>
                            <p className="text-2xl font-bold text-amber-600">{formatCurrency(stats.totalPagamentoEntregadores)}</p>
                            <p className="text-sm text-muted-foreground">Ticket médio: {formatCurrency(stats.ticketMedio)}</p>
                          </div>
                          <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                            <TrendingUp className="h-6 w-6 text-amber-600" />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      {loading ? (
                        <Skeleton className="h-20 w-full" />
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Total de Entregas</p>
                            <p className="text-2xl font-bold text-foreground">{stats.totalEntregas}</p>
                            <p className="text-sm text-muted-foreground">
                              Ticket médio: {formatCurrency(stats.ticketMedio)}
                            </p>
                          </div>
                          <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
                            <Calendar className="h-6 w-6 text-foreground" />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Area Chart - Receita ao longo do tempo */}
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Receita por Período</CardTitle>
                      <CardDescription>Evolução da receita {period === '12m' ? 'mensal' : 'diária'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <Skeleton className="h-[300px] w-full" />
                      ) : (
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                              <defs>
                                <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={CHART_COLORS.receita} stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor={CHART_COLORS.receita} stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                              <XAxis 
                                dataKey={xAxisKey} 
                                tick={{ fontSize: 12 }} 
                                tickLine={false}
                                axisLine={false}
                              />
                              <YAxis 
                                tickFormatter={(value) => `R$${value}`}
                                tick={{ fontSize: 12 }}
                                tickLine={false}
                                axisLine={false}
                              />
                              <Tooltip content={<CustomTooltip />} />
                              <Area
                                type="monotone"
                                dataKey="receita"
                                name="Receita"
                                stroke={CHART_COLORS.receita}
                                fillOpacity={1}
                                fill="url(#colorReceita)"
                                strokeWidth={2}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Pie Chart - Distribuição */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Distribuição de Receita</CardTitle>
                      <CardDescription>Taxa plataforma vs pagamento entregadores</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <Skeleton className="h-[300px] w-full" />
                      ) : (
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={90}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {pieData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value: number) => formatCurrency(value)} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Bar Chart - Comparativo */}
                <Card>
                  <CardHeader>
                    <CardTitle>Comparativo de Valores</CardTitle>
                    <CardDescription>Taxa da plataforma vs pagamento a entregadores por período</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <Skeleton className="h-[300px] w-full" />
                    ) : (
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis 
                              dataKey={xAxisKey} 
                              tick={{ fontSize: 12 }}
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis 
                              tickFormatter={(value) => `R$${value}`}
                              tick={{ fontSize: 12 }}
                              tickLine={false}
                              axisLine={false}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar dataKey="taxaPlataforma" name="Taxa Plataforma" fill={CHART_COLORS.taxaPlataforma} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="pagamentoEntregadores" name="Pagamento Entregadores" fill={CHART_COLORS.pagamentoEntregadores} radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
