import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminSidebar } from '@/components/AdminSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { MapPin, Bike, Car, Truck } from 'lucide-react';

interface RadiusSetting {
  id: string;
  vehicle_type: string;
  max_radius_km: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const vehicleLabels: Record<string, { label: string; icon: typeof Bike }> = {
  motorcycle: { label: 'Moto', icon: Bike },
  bicycle: { label: 'Bicicleta', icon: Bike },
  car: { label: 'Carro', icon: Car },
  van: { label: 'Van', icon: Truck },
  truck: { label: 'Caminhão', icon: Truck },
  hourly_service: { label: 'Serviço por hora', icon: Car },
};

export default function AdminRadiusSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['radius-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_radius_settings')
        .select('*')
        .order('vehicle_type');
      
      if (error) throw error;
      return data as RadiusSetting[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, max_radius_km, is_active }: { id: string; max_radius_km?: number; is_active?: boolean }) => {
      const updateData: { max_radius_km?: number; is_active?: boolean } = {};
      if (max_radius_km !== undefined) updateData.max_radius_km = max_radius_km;
      if (is_active !== undefined) updateData.is_active = is_active;

      const { error } = await supabase
        .from('delivery_radius_settings')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-settings'] });
      toast({ title: 'Configuração atualizada!' });
    },
    onError: (error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  const handleRadiusChange = (id: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      updateMutation.mutate({ id, max_radius_km: numValue });
    }
  };

  const handleActiveChange = (id: string, is_active: boolean) => {
    updateMutation.mutate({ id, is_active });
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <main className="flex-1 p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            <div>
              <h1 className="text-3xl font-bold">Raio de Entregas</h1>
              <p className="text-muted-foreground">Configure o raio máximo de visualização de entregas por tipo de veículo</p>
            </div>

            {/* Info card */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Como funciona</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Entregadores só visualizam entregas dentro do raio configurado para seu tipo de veículo. 
                      Isso garante que recebam ofertas compatíveis com sua capacidade de deslocamento.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configurações por Veículo</CardTitle>
                <CardDescription>Defina o raio máximo em quilômetros para cada tipo de veículo</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-center py-8 text-muted-foreground">Carregando configurações...</p>
                ) : settings && settings.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo de Veículo</TableHead>
                        <TableHead>Raio Máximo (km)</TableHead>
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
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  step="0.5"
                                  min="1"
                                  max="100"
                                  defaultValue={setting.max_radius_km}
                                  onBlur={(e) => handleRadiusChange(setting.id, e.target.value)}
                                  className="w-24"
                                />
                                <span className="text-sm text-muted-foreground">km</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={setting.is_active ? 'default' : 'secondary'}>
                                {setting.is_active ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Switch
                                checked={setting.is_active}
                                onCheckedChange={(checked) => handleActiveChange(setting.id, checked)}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center py-8 text-muted-foreground">Nenhuma configuração encontrada</p>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}