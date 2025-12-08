import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, UserCheck, UserX, MapPin, Phone, Star, Package, RefreshCw, AlertCircle, Wallet } from 'lucide-react';
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

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4 border-b">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-8 w-20 ml-auto" />
        </div>
      ))}
    </div>
  );
}

export default function AdminRestaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadRestaurants();
  }, []);

  useEffect(() => {
    filterRestaurants();
  }, [searchTerm, statusFilter, restaurants]);

  const loadRestaurants = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get profiles separately
      const restaurantsWithProfiles = await Promise.all(
        (data || []).map(async (restaurant) => {
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
            is_approved: restaurant.is_approved,
            rating: restaurant.rating || 0,
            total_deliveries: restaurant.total_deliveries || 0,
            wallet_balance: restaurant.wallet_balance || 0,
            created_at: restaurant.created_at,
            profile_name: profile?.full_name || 'Sem nome',
            profile_phone: profile?.phone || '',
          };
        })
      );

      setRestaurants(restaurantsWithProfiles);
    } catch (error: any) {
      console.error('Erro ao carregar solicitantes:', error);
      setError(error.message || 'Erro ao carregar solicitantes');
      toast.error('Erro ao carregar solicitantes');
    } finally {
      setLoading(false);
    }
  };

  const filterRestaurants = () => {
    let filtered = [...restaurants];

    if (searchTerm) {
      filtered = filtered.filter(restaurant =>
        restaurant.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        restaurant.profile_phone.includes(searchTerm) ||
        restaurant.cnpj.includes(searchTerm)
      );
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'approved') {
        filtered = filtered.filter(r => r.is_approved);
      } else if (statusFilter === 'pending') {
        filtered = filtered.filter(r => !r.is_approved);
      }
    }

    setFilteredRestaurants(filtered);
  };

  const toggleApproval = async (restaurantId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({ is_approved: !currentStatus })
        .eq('id', restaurantId);

      if (error) throw error;

      toast.success(`Solicitante ${!currentStatus ? 'aprovado' : 'desaprovado'} com sucesso!`);
      loadRestaurants();
      setDialogOpen(false);
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status do solicitante');
    }
  };

  const deleteRestaurant = async (restaurantId: string) => {
    try {
      // Check for active deliveries
      const { data: activeDeliveries } = await supabase
        .from('deliveries')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .in('status', ['pending', 'accepted', 'picked_up']);

      if (activeDeliveries && activeDeliveries.length > 0) {
        toast.error('Não é possível excluir: existem entregas ativas');
        return;
      }

      const { error } = await supabase
        .from('restaurants')
        .delete()
        .eq('id', restaurantId);

      if (error) throw error;

      toast.success('Solicitante excluído com sucesso!');
      loadRestaurants();
      setDialogOpen(false);
    } catch (error) {
      console.error('Erro ao excluir solicitante:', error);
      toast.error('Erro ao excluir solicitante');
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
                <Button onClick={loadRestaurants} className="w-full">
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
                <h1 className="text-xl font-bold text-primary-foreground">Gerenciar Solicitantes</h1>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={loadRestaurants}
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
                  <CardTitle>Solicitantes Cadastrados</CardTitle>
                  <CardDescription>Gerencie todos os solicitantes do sistema</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por nome, telefone ou CNPJ..."
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
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {filteredRestaurants.length} solicitante(s) encontrado(s)
                  </div>

                  {loading ? (
                    <TableSkeleton />
                  ) : (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome do Negócio</TableHead>
                            <TableHead>CNPJ</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead>Saldo</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Entregas</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRestaurants.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                Nenhum solicitante encontrado
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredRestaurants.map((restaurant) => (
                              <TableRow key={restaurant.id}>
                                <TableCell className="font-medium">
                                  {restaurant.business_name}
                                </TableCell>
                                <TableCell>{restaurant.cnpj || 'N/A'}</TableCell>
                                <TableCell>{restaurant.profile_phone || 'N/A'}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1 text-green-600">
                                    <Wallet className="h-4 w-4" />
                                    R$ {Number(restaurant.wallet_balance).toFixed(2)}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={restaurant.is_approved ? "default" : "secondary"}>
                                    {restaurant.is_approved ? 'Aprovado' : 'Pendente'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                    <span>{restaurant.total_deliveries}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedRestaurant(restaurant);
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

      {/* Restaurant Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Solicitante</DialogTitle>
            <DialogDescription>
              Informações completas e ações disponíveis
            </DialogDescription>
          </DialogHeader>

          {selectedRestaurant && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Nome do Negócio</label>
                  <p className="text-foreground">{selectedRestaurant.business_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Responsável</label>
                  <p className="text-foreground">{selectedRestaurant.profile_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Telefone</label>
                  <p className="text-foreground flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {selectedRestaurant.profile_phone || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">CNPJ</label>
                  <p className="text-foreground">{selectedRestaurant.cnpj || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Endereço</label>
                  <p className="text-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {selectedRestaurant.address}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Total de Entregas</label>
                  <p className="text-foreground">{selectedRestaurant.total_deliveries}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Saldo na Carteira</label>
                  <p className="text-foreground flex items-center gap-1 text-green-600">
                    <Wallet className="h-4 w-4" />
                    R$ {Number(selectedRestaurant.wallet_balance).toFixed(2)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Avaliação</label>
                  <p className="text-foreground flex items-center gap-1">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    {Number(selectedRestaurant.rating).toFixed(1)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Cadastrado em</label>
                  <p className="text-foreground">
                    {new Date(selectedRestaurant.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Badge variant={selectedRestaurant.is_approved ? "default" : "secondary"}>
                  {selectedRestaurant.is_approved ? 'Aprovado' : 'Pendente'}
                </Badge>
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
            {selectedRestaurant && (
              <>
                <Button
                  variant={selectedRestaurant.is_approved ? "secondary" : "default"}
                  onClick={() => toggleApproval(selectedRestaurant.id, selectedRestaurant.is_approved)}
                >
                  {selectedRestaurant.is_approved ? (
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
                    if (confirm('Tem certeza que deseja excluir este solicitante?')) {
                      deleteRestaurant(selectedRestaurant.id);
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
