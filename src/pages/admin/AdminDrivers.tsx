import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, UserCheck, UserX, Phone, Star, Package, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4 border-b">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-8 w-20 ml-auto" />
        </div>
      ))}
    </div>
  );
}

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadDrivers();
  }, []);

  useEffect(() => {
    filterDrivers();
  }, [searchTerm, statusFilter, drivers]);

  const loadDrivers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get profiles separately
      const driversWithProfiles = await Promise.all(
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

      setDrivers(driversWithProfiles);
    } catch (error: any) {
      console.error('Erro ao carregar entregadores:', error);
      setError(error.message || 'Erro ao carregar entregadores');
      toast.error('Erro ao carregar entregadores');
    } finally {
      setLoading(false);
    }
  };

  const filterDrivers = () => {
    let filtered = [...drivers];

    if (searchTerm) {
      filtered = filtered.filter(driver =>
        driver.profile_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        driver.profile_phone.includes(searchTerm) ||
        driver.license_plate.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'approved') {
        filtered = filtered.filter(d => d.is_approved);
      } else if (statusFilter === 'pending') {
        filtered = filtered.filter(d => !d.is_approved);
      } else if (statusFilter === 'available') {
        filtered = filtered.filter(d => d.is_available);
      }
    }

    setFilteredDrivers(filtered);
  };

  const toggleApproval = async (driverId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ is_approved: !currentStatus })
        .eq('id', driverId);

      if (error) throw error;

      toast.success(`Entregador ${!currentStatus ? 'aprovado' : 'desaprovado'} com sucesso!`);
      loadDrivers();
      setDialogOpen(false);
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status do entregador');
    }
  };

  const deleteDriver = async (driverId: string) => {
    try {
      // Check for active deliveries
      const { data: activeDeliveries } = await supabase
        .from('deliveries')
        .select('id')
        .eq('driver_id', driverId)
        .in('status', ['pending', 'accepted', 'picked_up']);

      if (activeDeliveries && activeDeliveries.length > 0) {
        toast.error('Não é possível excluir: existem entregas ativas');
        return;
      }

      const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('id', driverId);

      if (error) throw error;

      toast.success('Entregador excluído com sucesso!');
      loadDrivers();
      setDialogOpen(false);
    } catch (error) {
      console.error('Erro ao excluir entregador:', error);
      toast.error('Erro ao excluir entregador');
    }
  };

  // Error state
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
                <Button onClick={loadDrivers} className="w-full">
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
                <h1 className="text-xl font-bold text-primary-foreground">Gerenciar Entregadores</h1>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={loadDrivers}
                disabled={loading}
              >
                <RefreshCw className={`h-3 w-3 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-7xl mx-auto space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Entregadores Cadastrados</CardTitle>
                  <CardDescription>Gerencie todos os entregadores do sistema</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nome, telefone ou placa..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full md:w-48">
                        <SelectValue placeholder="Filtrar por status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="approved">Aprovados</SelectItem>
                        <SelectItem value="pending">Pendentes</SelectItem>
                        <SelectItem value="available">Disponíveis</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {filteredDrivers.length} entregador(es) encontrado(s)
                  </div>

                  {loading ? (
                    <TableSkeleton />
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Veículo</TableHead>
                            <TableHead>Placa</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Avaliação</TableHead>
                            <TableHead>Entregas</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredDrivers.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                Nenhum entregador encontrado
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredDrivers.map((driver) => (
                              <TableRow key={driver.id}>
                                <TableCell className="font-medium">
                                  {driver.profile_name}
                                </TableCell>
                                <TableCell className="capitalize">{driver.vehicle_type}</TableCell>
                                <TableCell>{driver.license_plate || 'N/A'}</TableCell>
                                <TableCell>
                                  <div className="flex flex-col gap-1">
                                    <Badge variant={driver.is_approved ? "default" : "secondary"}>
                                      {driver.is_approved ? 'Aprovado' : 'Pendente'}
                                    </Badge>
                                    {driver.is_available && (
                                      <Badge variant="outline" className="text-green-600">
                                        Disponível
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                    <span>{Number(driver.rating).toFixed(1)}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                    <span>{driver.total_deliveries}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedDriver(driver);
                                      setDialogOpen(true);
                                    }}
                                  >
                                    Detalhes
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>

      {/* Driver Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Entregador</DialogTitle>
            <DialogDescription>
              Informações completas e ações disponíveis
            </DialogDescription>
          </DialogHeader>

          {selectedDriver && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Nome</label>
                  <p className="text-foreground">{selectedDriver.profile_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Telefone</label>
                  <p className="text-foreground flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {selectedDriver.profile_phone || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Veículo</label>
                  <p className="text-foreground capitalize">{selectedDriver.vehicle_type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Placa</label>
                  <p className="text-foreground">{selectedDriver.license_plate || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Total de Entregas</label>
                  <p className="text-foreground">{selectedDriver.total_deliveries}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Avaliação</label>
                  <p className="text-foreground flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    {Number(selectedDriver.rating).toFixed(1)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Cadastrado em</label>
                  <p className="text-foreground">
                    {new Date(selectedDriver.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Badge variant={selectedDriver.is_approved ? "default" : "secondary"}>
                  {selectedDriver.is_approved ? 'Aprovado' : 'Pendente'}
                </Badge>
                {selectedDriver.is_available && (
                  <Badge variant="outline" className="text-green-600">
                    Disponível
                  </Badge>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Fechar
            </Button>
            {selectedDriver && (
              <>
                <Button
                  variant={selectedDriver.is_approved ? "secondary" : "default"}
                  onClick={() => toggleApproval(selectedDriver.id, selectedDriver.is_approved)}
                >
                  {selectedDriver.is_approved ? (
                    <>
                      <UserX className="h-4 w-4 mr-2" />
                      Desaprovar
                    </>
                  ) : (
                    <>
                      <UserCheck className="h-4 w-4 mr-2" />
                      Aprovar
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm('Tem certeza que deseja excluir este entregador?')) {
                      deleteDriver(selectedDriver.id);
                    }
                  }}
                >
                  Excluir
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
