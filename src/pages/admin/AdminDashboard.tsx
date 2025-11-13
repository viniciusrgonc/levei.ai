import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
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
  UserCheck
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

interface PendingDriver {
  id: string;
  user_id: string;
  vehicle_type: string;
  license_plate: string;
  created_at: string;
  profiles: {
    full_name: string;
    phone: string;
  };
}

interface PendingRestaurant {
  id: string;
  user_id: string;
  business_name: string;
  cnpj: string;
  address: string;
  created_at: string;
  profiles: {
    phone: string;
  };
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
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
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch all data in parallel
      const [driversRes, restaurantsRes, deliveriesRes] = await Promise.all([
        supabase
          .from('drivers')
          .select(`
            *,
            profiles!drivers_user_id_fkey (
              full_name,
              phone
            )
          `),
        supabase
          .from('restaurants')
          .select(`
            *,
            profiles!restaurants_user_id_fkey (
              phone
            )
          `),
        supabase.from('deliveries').select('*'),
      ]);

      if (driversRes.error) throw driversRes.error;
      if (restaurantsRes.error) throw restaurantsRes.error;
      if (deliveriesRes.error) throw deliveriesRes.error;

      const drivers = driversRes.data || [];
      const restaurants = restaurantsRes.data || [];
      const deliveries = deliveriesRes.data || [];

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
        .reduce((sum, d) => sum + Number(d.price), 0);

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

      // Set pending users
      setPendingDrivers(drivers.filter(d => !d.is_approved) as any);
      setPendingRestaurants(restaurants.filter(r => !r.is_approved) as any);
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
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
                  <h1 className="text-xl font-bold text-primary-foreground">Movvi Admin</h1>
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
                >
                  <RefreshCw className="h-3 w-3 mr-2" />
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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-2 hover:border-primary/50 transition-colors">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Entregadores</CardTitle>
                    <Users className="h-4 w-4 text-primary" />
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
                    <Users className="h-4 w-4 text-primary" />
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
                    <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
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

              {/* Pending Approvals */}
              {(pendingDrivers.length > 0 || pendingRestaurants.length > 0) && (
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
                                    {driver.profiles.full_name}
                                  </TableCell>
                                  <TableCell className="capitalize">
                                    {driver.vehicle_type}
                                  </TableCell>
                                  <TableCell>{driver.license_plate}</TableCell>
                                  <TableCell>{driver.profiles.phone}</TableCell>
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
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Details Dialog */}
      <Dialog open={!!dialogType} onOpenChange={() => setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Detalhes do {dialogType === 'driver' ? 'Entregador' : 'Solicitante'}
            </DialogTitle>
            <DialogDescription>
              Revise as informações antes de aprovar
            </DialogDescription>
          </DialogHeader>

          {selectedItem && dialogType === 'driver' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">Nome Completo</p>
                <p className="text-sm text-muted-foreground">{selectedItem.profiles.full_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Telefone</p>
                <p className="text-sm text-muted-foreground">{selectedItem.profiles.phone}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Tipo de Veículo</p>
                <p className="text-sm text-muted-foreground capitalize">{selectedItem.vehicle_type}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Placa</p>
                <p className="text-sm text-muted-foreground">{selectedItem.license_plate}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Data de Cadastro</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedItem.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          )}

          {selectedItem && dialogType === 'restaurant' && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">Nome do Negócio</p>
                <p className="text-sm text-muted-foreground">{selectedItem.business_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium">CNPJ</p>
                <p className="text-sm text-muted-foreground">{selectedItem.cnpj || 'Não informado'}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Endereço</p>
                <p className="text-sm text-muted-foreground">{selectedItem.address}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Telefone</p>
                <p className="text-sm text-muted-foreground">{selectedItem.profiles?.phone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Data de Cadastro</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedItem.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogType(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedItem && dialogType) {
                  handleReject(selectedItem.id, dialogType);
                }
              }}
            >
              <X className="h-4 w-4 mr-2" />
              Rejeitar
            </Button>
            <Button
              onClick={() => {
                if (selectedItem && dialogType) {
                  handleApprove(selectedItem.id, dialogType);
                }
              }}
            >
              <Check className="h-4 w-4 mr-2" />
              Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
