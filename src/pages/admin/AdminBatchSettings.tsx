import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminSidebar } from '@/components/AdminSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Layers, Bike, Car, Truck, Clock, Package } from 'lucide-react';

interface BatchSetting {
  id: string;
  vehicle_type: string;
  max_deliveries: number;
  time_window_minutes: number;
  additional_delivery_base_price: number;
  additional_delivery_price_per_km: number;
  is_active: boolean;
}

const vehicleLabels: Record<string, { label: string; icon: typeof Bike }> = {
  motorcycle: { label: 'Moto', icon: Bike },
  bicycle: { label: 'Bicicleta', icon: Bike },
  car: { label: 'Carro', icon: Car },
  van: { label: 'Van', icon: Truck },
  truck: { label: 'Caminhão', icon: Truck },
  hourly_service: { label: 'Serviço por hora', icon: Car },
};

export default function AdminBatchSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['batch-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('batch_delivery_settings')
        .select('*')
        .order('vehicle_type');
      
      if (error) throw error;
      return data as BatchSetting[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (params: { id: string; field: string; value: number | boolean }) => {
      const { id, field, value } = params;
      const { error } = await supabase
        .from('batch_delivery_settings')
        .update({ [field]: value })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch-settings'] });
      toast({ title: 'Configuração atualizada!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  const handleUpdate = (id: string, field: string, value: string | boolean) => {
    if (typeof value === 'boolean') {
      updateMutation.mutate({ id, field, value });
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue >= 0) {
        updateMutation.mutate({ id, field, value: numValue });
      }
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminPageHeader title="Múltiplas Entregas" showBack showLogout />
          <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Info card */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Layers className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Como funciona</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Quando um entregador está em coleta, o restaurante pode adicionar novas entregas à rota dele 
                      dentro da janela de tempo configurada. Entregas adicionais usam preços diferenciados.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configurações por Veículo</CardTitle>
                <CardDescription>
                  Defina limite máximo de entregas, janela de tempo e preços para entregas adicionais
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-center py-8 text-muted-foreground">Carregando configurações...</p>
                ) : settings && settings.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Veículo</TableHead>
                          <TableHead>
                            <div className="flex items-center gap-1">
                              <Package className="w-4 h-4" />
                              Máx. Entregas
                            </div>
                          </TableHead>
                          <TableHead>
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              Janela (min)
                            </div>
                          </TableHead>
                          <TableHead>Base (R$)</TableHead>
                          <TableHead>Por km (R$)</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ativo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {settings.map((setting) => {
                          const vehicle = vehicleLabels[setting.vehicle_type] || { label: setting.vehicle_type, icon: Bike };
                          const IconComponent = vehicle.icon;
                          
                          return (
                            <TableRow key={setting.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                    <IconComponent className="w-4 h-4" />
                                  </div>
                                  <span className="font-medium">{vehicle.label}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="1"
                                  max="50"
                                  defaultValue={setting.max_deliveries}
                                  onBlur={(e) => handleUpdate(setting.id, 'max_deliveries', e.target.value)}
                                  className="w-20"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="5"
                                  max="120"
                                  defaultValue={setting.time_window_minutes}
                                  onBlur={(e) => handleUpdate(setting.id, 'time_window_minutes', e.target.value)}
                                  className="w-20"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.50"
                                  min="0"
                                  defaultValue={setting.additional_delivery_base_price}
                                  onBlur={(e) => handleUpdate(setting.id, 'additional_delivery_base_price', e.target.value)}
                                  className="w-24"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.10"
                                  min="0"
                                  defaultValue={setting.additional_delivery_price_per_km}
                                  onBlur={(e) => handleUpdate(setting.id, 'additional_delivery_price_per_km', e.target.value)}
                                  className="w-24"
                                />
                              </TableCell>
                              <TableCell>
                                <Badge variant={setting.is_active ? 'default' : 'secondary'}>
                                  {setting.is_active ? 'Ativo' : 'Inativo'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Switch
                                  checked={setting.is_active}
                                  onCheckedChange={(checked) => handleUpdate(setting.id, 'is_active', checked)}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center py-8 text-muted-foreground">Nenhuma configuração encontrada</p>
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
