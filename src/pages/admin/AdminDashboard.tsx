import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  PackageCheck, 
  TrendingUp, 
  AlertCircle, 
  Check, 
  X, 
  DollarSign,
  Clock,
  Star,
  Phone,
  MapPin,
  RefreshCw,
  Eye,
  UserCheck,
  Wallet,
  Truck,
  Building2
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Stats {
  totalDrivers: number;
  approvedDrivers: number;
  pendingDrivers: number;
  totalRestaurants: number;
  approvedRestaurants: number;
  pendingRestaurants: number;
  totalDeliveries: number;
  activeDeliveries: number;
  completedToday: number;
  totalRevenue: number;
}

interface FinancialStats {
  platformFees: number;
  driverEarnings: number;
  totalVolume: number;
}

interface PendingDriver {
  id: string;
  user_id: string;
  vehicle_type: string;
  license_plate: string;
  created_at: string;
  profile_name: string;
  profile_phone: string;
}

interface PendingRestaurant {
  id: string;
  user_id: string;
  business_name: string;
  cnpj: string;
  address: string;
  created_at: string;
  profile_phone: string;
}

// Skeleton components for loading state
function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-2" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalDrivers: 0,
    approvedDrivers: 0,
    pendingDrivers: 0,
    totalRestaurants: 0,
    approvedRestaurants: 0,
    pendingRestaurants: 0,
    totalDeliveries: 0,
    activeDeliveries: 0,
    completedToday: 0,
    totalRevenue: 0,
  });
  const [financialStats, setFinancialStats] = useState<FinancialStats>({
    platformFees: 0,
    driverEarnings: 0,
    totalVolume: 0,
  });
  const [pendingDrivers, setPendingDrivers] = useState<PendingDriver[]>([]);
  const [pendingRestaurants, setPendingRestaurants] = useState<PendingRestaurant[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [dialogType, setDialogType] = useState<'driver' | 'restaurant' | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch all data in parallel - simplified queries without complex joins
      const [driversRes, restaurantsRes, deliveriesRes, transactionsRes] = await Promise.all([
        supabase.from('drivers').select('*'),
        supabase.from('restaurants').select('*'),
        supabase.from('deliveries').select('*'),
        supabase.from('transactions').select('*'),
      ]);

      if (driversRes.error) {
        console.error('Erro drivers:', driversRes.error);
        throw driversRes.error;
      }
      if (restaurantsRes.error) {
        console.error('Erro restaurants:', restaurantsRes.error);
        throw restaurantsRes.error;
      }
      if (deliveriesRes.error) {
        console.error('Erro deliveries:', deliveriesRes.error);
        throw deliveriesRes.error;
      }

      const drivers = driversRes.data || [];
      const restaurants = restaurantsRes.data || [];
      const deliveries = deliveriesRes.data || [];
      const transactions = transactionsRes.data || [];

      // Calculate stats
      const approvedDrivers = drivers.filter(d => d.is_approved).length;
      const pendingDriversCount = drivers.filter(d => !d.is_approved).length;
      const approvedRestaurants = restaurants.filter(r => r.is_approved).length;
      const pendingRestaurantsCount = restaurants.filter(r => !r.is_approved).length;
      
      const activeDeliveries = deliveries.filter(d => 
        ['pending', 'accepted', 'picked_up'].includes(d.status)
      ).length;
      
      const completedToday = deliveries.filter(d => 
        d.status === 'delivered' && new Date(d.delivered_at || d.created_at) >= today
      ).length;

      const totalRevenue = deliveries
        .filter(d => d.status === 'delivered')
        .reduce((sum, d) => sum + Number(d.price_adjusted || d.price || 0), 0);

      // Calculate financial stats from transactions
      const platformFees = transactions
        .filter(t => t.type === 'platform_fee')
        .reduce((sum, t) => sum + Number(t.platform_fee || t.amount || 0), 0);

      const driverEarnings = transactions
        .filter(t => t.driver_id && t.driver_earnings)
        .reduce((sum, t) => sum + Number(t.driver_earnings || 0), 0);

      const totalVolume = deliveries
        .filter(d => d.status === 'delivered')
        .reduce((sum, d) => sum + Number(d.price_adjusted || d.price || 0), 0);

      setStats({
        totalDrivers: drivers.length,
        approvedDrivers,
        pendingDrivers: pendingDriversCount,
        totalRestaurants: restaurants.length,
        approvedRestaurants,
        pendingRestaurants: pendingRestaurantsCount,
        totalDeliveries: deliveries.length,
        activeDeliveries,
        completedToday,
        totalRevenue,
      });

      setFinancialStats({
        platformFees,
        driverEarnings,
        totalVolume,
      });

      // Fetch profiles for pending users
      const pendingDriversList = drivers.filter(d => !d.is_approved);
      const pendingRestaurantsList = restaurants.filter(r => !r.is_approved);

      // Get profiles for pending drivers
      const driversWithProfiles = await Promise.all(
        pendingDriversList.map(async (driver) => {
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
            created_at: driver.created_at,
            profile_name: profile?.full_name || 'Sem nome',
            profile_phone: profile?.phone || '',
          };
        })
      );

      // Get profiles for pending restaurants  
      const restaurantsWithProfiles = await Promise.all(
        pendingRestaurantsList.map(async (restaurant) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('id', restaurant.user_id)
            .maybeSingle();
          
          return {
            id: restaurant.id,
            user_id: restaurant.user_id,
            business_name: restaurant.business_name,
            cnpj: restaurant.cnpj || '',
            address: restaurant.address,
            created_at: restaurant.created_at,
            profile_phone: profile?.phone || '',
          };
        })
      );

      setPendingDrivers(driversWithProfiles);
      setPendingRestaurants(restaurantsWithProfiles);
      
      setLastUpdate(new Date());
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      setError(error.message || 'Erro ao carregar dados do sistema');
      toast.error('Erro ao carregar dados do sistema');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string, type: 'driver' | 'restaurant') => {
    try {
      const table = type === 'driver' ? 'drivers' : 'restaurants';
      const { error } = await supabase
        .from(table)
        .update({ is_approved: true })
        .eq('id', id);

      if (error) throw error;

      toast.success(`✅ ${type === 'driver' ? 'Entregador' : 'Solicitante'} aprovado com sucesso!`);
      setDialogType(null);
      setSelectedItem(null);
      loadData();
    } catch (error) {
      console.error('Erro ao aprovar:', error);
      toast.error('Erro ao aprovar cadastro');
    }
  };

  const handleReject = async (id: string, type: 'driver' | 'restaurant') => {
    try {
      // Check for active deliveries before deletion
      const { data: activeDeliveries } = await supabase
        .from('deliveries')
        .select('id')
        .eq(type === 'driver' ? 'driver_id' : 'restaurant_id', id)
        .in('status', ['pending', 'accepted', 'picked_up']);

      if (activeDeliveries && activeDeliveries.length > 0) {
        toast.error(`Não é possível rejeitar: existem ${activeDeliveries.length} entregas ativas. Aguarde a conclusão ou cancelamento.`);
        return;
      }

      const table = type === 'driver' ? 'drivers' : 'restaurants';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success(`❌ ${type === 'driver' ? 'Entregador' : 'Solicitante'} rejeitado`);
      setDialogType(null);
      setSelectedItem(null);
      loadData();
    } catch (error) {
      console.error('Erro ao rejeitar:', error);
      toast.error('Erro ao rejeitar cadastro');
    }
  };

  const openDetailsDialog = (item: any, type: 'driver' | 'restaurant') => {
    setSelectedItem(item);
    setDialogType(type);
  };

  // Error state with retry button
  if (error && !loading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AdminSidebar />
          <div className="flex-1 flex items-center justify-center">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  Erro ao carregar dados
                </CardTitle>
                <CardDescription>{error}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={loadData} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar novamente
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 h-16 border-b bg-primary backdrop-blur supports-[backdrop-filter]:bg-primary/95">
            <div className="flex h-full items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
                <div>
                  <h1 className="text-xl font-bold text-primary-foreground">Levei Admin</h1>
                  <p className="text-xs text-primary-foreground/60">
                    Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={loadData}
                  disabled={loading}
                >
                  <RefreshCw className={`h-3 w-3 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    supabase.auth.signOut();
                    navigate('/auth');
                  }}
                  className="text-primary-foreground hover:bg-primary-foreground/10"
                >
                  Sair
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-7xl mx-auto space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-foreground">Dashboard Administrativo</h2>
                <p className="text-muted-foreground">Visão geral e gerenciamento do sistema</p>
              </div>

              {/* Stats Grid */}
              {loading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => (
                    <StatCardSkeleton key={i} />
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card className="border-2 hover:border-primary/50 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Entregadores</CardTitle>
                      <Truck className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.totalDrivers}</div>
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <span className="text-green-600 flex items-center gap-1">
                          <UserCheck className="h-3 w-3" />
                          {stats.approvedDrivers} ativos
                        </span>
                        {stats.pendingDrivers > 0 && (
                          <span className="text-orange-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {stats.pendingDrivers} pendentes
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-2 hover:border-primary/50 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Solicitantes</CardTitle>
                      <Building2 className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.totalRestaurants}</div>
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <span className="text-green-600 flex items-center gap-1">
                          <UserCheck className="h-3 w-3" />
                          {stats.approvedRestaurants} ativos
                        </span>
                        {stats.pendingRestaurants > 0 && (
                          <span className="text-orange-600 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {stats.pendingRestaurants} pendentes
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Entregas</CardTitle>
                      <PackageCheck className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.totalDeliveries}</div>
                      <div className="flex items-center gap-4 mt-2 text-xs">
                        <span className="text-blue-600 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {stats.activeDeliveries} ativas
                        </span>
                        <span className="text-green-600">
                          {stats.completedToday} hoje
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Volume Total</CardTitle>
                      <DollarSign className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">R$ {stats.totalRevenue.toFixed(2)}</div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Entregas concluídas
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Financial Card */}
              {loading ? (
                <StatCardSkeleton />
              ) : (
                <Card className="border-2 border-green-500/20 bg-green-500/5">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Wallet className="h-5 w-5 text-green-600" />
                          Financeiro da Plataforma
                        </CardTitle>
                        <CardDescription className="mt-2">
                          Resumo financeiro das operações
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="p-4 bg-background rounded-lg border">
                        <p className="text-sm text-muted-foreground mb-1">Taxa da Plataforma (20%)</p>
                        <p className="text-2xl font-bold text-green-600">
                          R$ {financialStats.platformFees.toFixed(2)}
                        </p>
                      </div>
                      <div className="p-4 bg-background rounded-lg border">
                        <p className="text-sm text-muted-foreground mb-1">Pago aos Entregadores (80%)</p>
                        <p className="text-2xl font-bold text-blue-600">
                          R$ {financialStats.driverEarnings.toFixed(2)}
                        </p>
                      </div>
                      <div className="p-4 bg-background rounded-lg border">
                        <p className="text-sm text-muted-foreground mb-1">Volume Total Movimentado</p>
                        <p className="text-2xl font-bold text-foreground">
                          R$ {financialStats.totalVolume.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Pending Approvals */}
              {loading ? (
                <Card>
                  <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-64 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <TableSkeleton />
                  </CardContent>
                </Card>
              ) : (pendingDrivers.length > 0 || pendingRestaurants.length > 0) ? (
                <Card className="border-2 border-orange-500/20 bg-orange-500/5">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-orange-500" />
                          Aprovações Pendentes ({pendingDrivers.length + pendingRestaurants.length})
                        </CardTitle>
                        <CardDescription className="mt-2">
                          Cadastros aguardando aprovação
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="drivers">
                      <TabsList>
                        <TabsTrigger value="drivers">
                          Entregadores ({pendingDrivers.length})
                        </TabsTrigger>
                        <TabsTrigger value="restaurants">
                          Solicitantes ({pendingRestaurants.length})
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="drivers" className="mt-4">
                        {pendingDrivers.length === 0 ? (
                          <p className="text-center py-8 text-muted-foreground">
                            Nenhum entregador pendente
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Veículo</TableHead>
                                <TableHead>Placa</TableHead>
                                <TableHead>Telefone</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pendingDrivers.map((driver) => (
                                <TableRow key={driver.id}>
                                  <TableCell className="font-medium">
                                    {driver.profile_name}
                                  </TableCell>
                                  <TableCell className="capitalize">
                                    {driver.vehicle_type}
                                  </TableCell>
                                  <TableCell>{driver.license_plate}</TableCell>
                                  <TableCell>{driver.profile_phone}</TableCell>
                                  <TableCell className="text-right space-x-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openDetailsDialog(driver, 'driver')}
                                    >
                                      <Eye className="h-3 w-3 mr-1" />
                                      Ver
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => handleApprove(driver.id, 'driver')}
                                    >
                                      <Check className="h-3 w-3 mr-1" />
                                      Aprovar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleReject(driver.id, 'driver')}
                                    >
                                      <X className="h-3 w-3 mr-1" />
                                      Rejeitar
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </TabsContent>

                      <TabsContent value="restaurants" className="mt-4">
                        {pendingRestaurants.length === 0 ? (
                          <p className="text-center py-8 text-muted-foreground">
                            Nenhum solicitante pendente
                          </p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nome do Negócio</TableHead>
                                <TableHead>CNPJ</TableHead>
                                <TableHead>Endereço</TableHead>
                                <TableHead>Telefone</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pendingRestaurants.map((restaurant) => (
                                <TableRow key={restaurant.id}>
                                  <TableCell className="font-medium">
                                    {restaurant.business_name}
                                  </TableCell>
                                  <TableCell>{restaurant.cnpj || 'N/A'}</TableCell>
                                  <TableCell className="max-w-xs truncate">
                                    {restaurant.address}
                                  </TableCell>
                                  <TableCell>{restaurant.profile_phone}</TableCell>
                                  <TableCell className="text-right space-x-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openDetailsDialog(restaurant, 'restaurant')}
                                    >
                                      <Eye className="h-3 w-3 mr-1" />
                                      Ver
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => handleApprove(restaurant.id, 'restaurant')}
                                    >
                                      <Check className="h-3 w-3 mr-1" />
                                      Aprovar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleReject(restaurant.id, 'restaurant')}
                                    >
                                      <X className="h-3 w-3 mr-1" />
                                      Rejeitar
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8">
                    <p className="text-center text-muted-foreground flex items-center justify-center gap-2">
                      <Check className="h-5 w-5 text-green-500" />
                      Todas as aprovações estão em dia
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Details Dialog */}
      <Dialog open={dialogType !== null} onOpenChange={(open) => !open && setDialogType(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialogType === 'driver' ? 'Detalhes do Entregador' : 'Detalhes do Solicitante'}
            </DialogTitle>
            <DialogDescription>
              Informações completas do cadastro
            </DialogDescription>
          </DialogHeader>

          {selectedItem && dialogType === 'driver' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Nome</label>
                  <p className="text-foreground">{selectedItem.profile_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Telefone</label>
                  <p className="text-foreground flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {selectedItem.profile_phone}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Tipo de Veículo</label>
                  <p className="text-foreground capitalize">{selectedItem.vehicle_type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Placa</label>
                  <p className="text-foreground">{selectedItem.license_plate || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Cadastrado em</label>
                  <p className="text-foreground">
                    {new Date(selectedItem.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedItem && dialogType === 'restaurant' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Nome do Negócio</label>
                  <p className="text-foreground">{selectedItem.business_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">CNPJ</label>
                  <p className="text-foreground">{selectedItem.cnpj || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Telefone</label>
                  <p className="text-foreground flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {selectedItem.profile_phone}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Cadastrado em</label>
                  <p className="text-foreground">
                    {new Date(selectedItem.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Endereço</label>
                  <p className="text-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {selectedItem.address}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogType(null)}
            >
              Fechar
            </Button>
            {selectedItem && (
              <>
                <Button
                  onClick={() => handleApprove(selectedItem.id, dialogType!)}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Aprovar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleReject(selectedItem.id, dialogType!)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Rejeitar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
