import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { Users, PackageCheck, TrendingUp, AlertCircle, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Stats {
  totalDrivers: number;
  totalRestaurants: number;
  totalDeliveries: number;
  pendingApprovals: number;
}

interface PendingUser {
  id: string;
  name: string;
  type: 'driver' | 'restaurant';
  createdAt: string;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalDrivers: 0,
    totalRestaurants: 0,
    totalDeliveries: 0,
    pendingApprovals: 0,
  });
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  const checkAdminAccess = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleData?.role !== 'admin') {
      toast.error('Acesso negado');
      navigate('/');
      return;
    }

    loadData();
  };

  const loadData = async () => {
    try {
      // Buscar estatísticas
      const [driversRes, restaurantsRes, deliveriesRes] = await Promise.all([
        supabase.from('drivers').select('id, is_approved'),
        supabase.from('restaurants').select('id, is_approved'),
        supabase.from('deliveries').select('id'),
      ]);

      const pendingDrivers = driversRes.data?.filter(d => !d.is_approved).length || 0;
      const pendingRestaurants = restaurantsRes.data?.filter(r => !r.is_approved).length || 0;

      setStats({
        totalDrivers: driversRes.data?.length || 0,
        totalRestaurants: restaurantsRes.data?.length || 0,
        totalDeliveries: deliveriesRes.data?.length || 0,
        pendingApprovals: pendingDrivers + pendingRestaurants,
      });

      // Buscar usuários pendentes
      const pending: PendingUser[] = [];

      if (driversRes.data) {
        for (const driver of driversRes.data.filter(d => !d.is_approved)) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', driver.id)
            .maybeSingle();
          
          pending.push({
            id: driver.id,
            name: profile?.full_name || 'Motorista',
            type: 'driver',
            createdAt: new Date().toISOString(),
          });
        }
      }

      if (restaurantsRes.data) {
        for (const restaurant of restaurantsRes.data.filter(r => !r.is_approved)) {
          const { data } = await supabase
            .from('restaurants')
            .select('business_name, user_id')
            .eq('id', restaurant.id)
            .maybeSingle();
          
          pending.push({
            id: restaurant.id,
            name: data?.business_name || 'Restaurante',
            type: 'restaurant',
            createdAt: new Date().toISOString(),
          });
        }
      }

      setPendingUsers(pending);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
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
        .eq(type === 'driver' ? 'id' : 'id', id);

      if (error) throw error;

      toast.success(`${type === 'driver' ? 'Motorista' : 'Restaurante'} aprovado!`);
      loadData();
    } catch (error) {
      console.error('Erro ao aprovar:', error);
      toast.error('Erro ao aprovar');
    }
  };

  const handleReject = async (id: string, type: 'driver' | 'restaurant') => {
    try {
      const table = type === 'driver' ? 'drivers' : 'restaurants';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success(`${type === 'driver' ? 'Motorista' : 'Restaurante'} rejeitado`);
      loadData();
    } catch (error) {
      console.error('Erro ao rejeitar:', error);
      toast.error('Erro ao rejeitar');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b bg-primary flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
              <h1 className="text-xl font-bold text-primary-foreground">Movvi Admin</h1>
            </div>
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
          </header>

          <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-7xl mx-auto space-y-6">
              <div>
                <h2 className="text-3xl font-bold text-foreground">Dashboard Admin</h2>
                <p className="text-muted-foreground">Gerencie motoristas, restaurantes e entregas</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Motoristas</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalDrivers}</div>
                    <p className="text-xs text-muted-foreground">Total cadastrados</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Restaurantes</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalRestaurants}</div>
                    <p className="text-xs text-muted-foreground">Total cadastrados</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Entregas</CardTitle>
                    <PackageCheck className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalDeliveries}</div>
                    <p className="text-xs text-muted-foreground">Total realizadas</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.pendingApprovals}</div>
                    <p className="text-xs text-muted-foreground">Aguardando aprovação</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Aprovações Pendentes</CardTitle>
                  <CardDescription>
                    Motoristas e restaurantes aguardando aprovação
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingUsers.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Nenhuma aprovação pendente
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.name}</TableCell>
                            <TableCell>
                              <Badge variant={user.type === 'driver' ? 'default' : 'secondary'}>
                                {user.type === 'driver' ? 'Motorista' : 'Restaurante'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                size="sm"
                                onClick={() => handleApprove(user.id, user.type)}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Aprovar
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(user.id, user.type)}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Rejeitar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
