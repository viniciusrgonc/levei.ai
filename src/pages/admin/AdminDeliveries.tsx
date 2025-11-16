import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { Search, MapPin, DollarSign, Calendar, User, Bike } from 'lucide-react';
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

interface Delivery {
  id: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  price: number;
  distance_km: number;
  created_at: string;
  vehicle_category: string;
  driver_name?: string;
  product_type?: string | null;
  product_note?: string | null;
  restaurants: {
    business_name: string;
  };
}

const statusColors: Record<string, string> = {
  pending: 'secondary',
  accepted: 'default',
  picked_up: 'default',
  delivered: 'default',
  cancelled: 'destructive'
};

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  accepted: 'Aceita',
  picked_up: 'Coletada',
  delivered: 'Entregue',
  cancelled: 'Cancelada'
};

export default function AdminDeliveries() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [filteredDeliveries, setFilteredDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadDeliveries();
  }, []);

  useEffect(() => {
    filterDeliveries();
  }, [searchTerm, statusFilter, deliveries]);

  const loadDeliveries = async () => {
    try {
      const { data: deliveriesData, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          restaurants (
            business_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get driver names separately
      const deliveriesWithDrivers = await Promise.all(
        (deliveriesData || []).map(async (delivery) => {
          if (delivery.driver_id) {
            const { data: driverData } = await supabase
              .from('drivers')
              .select('profiles!drivers_user_id_fkey(full_name)')
              .eq('id', delivery.driver_id)
              .single();
            
            return {
              ...delivery,
              driver_name: (driverData?.profiles as any)?.full_name || 'Não disponível'
            };
          }
          return delivery;
        })
      );

      setDeliveries(deliveriesWithDrivers);
    } catch (error) {
      console.error('Erro ao carregar entregas:', error);
      toast.error('Erro ao carregar entregas');
    } finally {
      setLoading(false);
    }
  };

  const filterDeliveries = () => {
    let filtered = [...deliveries];

    if (searchTerm) {
      filtered = filtered.filter(delivery =>
        delivery.pickup_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        delivery.delivery_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        delivery.restaurants.business_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(d => d.status === statusFilter);
    }

    setFilteredDeliveries(filtered);
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
                <h1 className="text-xl font-bold text-primary-foreground">Gerenciar Entregas</h1>
              </div>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-7xl mx-auto space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Todas as Entregas</CardTitle>
                  <CardDescription>Visualize e gerencie todas as entregas do sistema</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por endereço ou solicitante..."
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
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="accepted">Aceita</SelectItem>
                        <SelectItem value="picked_up">Coletada</SelectItem>
                        <SelectItem value="delivered">Entregue</SelectItem>
                        <SelectItem value="cancelled">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {filteredDeliveries.length} entrega(s) encontrada(s)
                  </div>

                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Solicitante</TableHead>
                          <TableHead>Entregador</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Origem</TableHead>
                          <TableHead>Destino</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDeliveries.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                              Nenhuma entrega encontrada
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredDeliveries.map((delivery) => (
                            <TableRow key={delivery.id}>
                              <TableCell className="font-medium">
                                {delivery.restaurants.business_name}
                              </TableCell>
                              <TableCell>
                                {delivery.driver_name || 'Não atribuído'}
                              </TableCell>
                              <TableCell>
                                <Badge variant={statusColors[delivery.status] as any}>
                                  {statusLabels[delivery.status]}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-xs truncate">
                                {delivery.pickup_address}
                              </TableCell>
                              <TableCell className="max-w-xs truncate">
                                {delivery.delivery_address}
                              </TableCell>
                              <TableCell>R$ {Number(delivery.price).toFixed(2)}</TableCell>
                              <TableCell>
                                {new Date(delivery.created_at).toLocaleDateString('pt-BR')}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedDelivery(delivery);
                                    setDialogOpen(true);
                                  }}
                                >
                                  Ver
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>

      {/* Delivery Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Entrega</DialogTitle>
            <DialogDescription>
              Informações completas da entrega
            </DialogDescription>
          </DialogHeader>

          {selectedDelivery && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Solicitante
                  </label>
                  <p className="text-foreground">{selectedDelivery.restaurants.business_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Bike className="h-4 w-4" />
                    Entregador
                  </label>
                  <p className="text-foreground">
                    {selectedDelivery.driver_name || 'Não atribuído'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    <Badge variant={statusColors[selectedDelivery.status] as any}>
                      {statusLabels[selectedDelivery.status]}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Veículo</label>
                  <p className="text-foreground capitalize">
                    {selectedDelivery.vehicle_category || 'Não especificado'}
                  </p>
                </div>
                {selectedDelivery.product_type && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Tipo de Produto</label>
                      <p className="text-foreground">{selectedDelivery.product_type}</p>
                    </div>
                    {selectedDelivery.product_note && (
                      <div className="col-span-2">
                        <label className="text-sm font-medium text-muted-foreground">Observações do Produto</label>
                        <p className="text-foreground text-sm">{selectedDelivery.product_note}</p>
                      </div>
                    )}
                  </>
                )}
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Endereço de Coleta
                  </label>
                  <p className="text-foreground">{selectedDelivery.pickup_address}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Endereço de Entrega
                  </label>
                  <p className="text-foreground">{selectedDelivery.delivery_address}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Valor
                  </label>
                  <p className="text-foreground text-lg font-semibold">
                    R$ {Number(selectedDelivery.price).toFixed(2)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Distância</label>
                  <p className="text-foreground">{Number(selectedDelivery.distance_km).toFixed(1)} km</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Data de Criação
                  </label>
                  <p className="text-foreground">
                    {new Date(selectedDelivery.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
