import { useState, useEffect } from 'react';
import { DriverSidebar } from '@/components/DriverSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import NotificationBell from '@/components/NotificationBell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Bell, Shield, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from '@/hooks/use-toast';

export default function DriverSettings() {
  const [loading, setLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [vehicleType, setVehicleType] = useState<'bicycle' | 'car' | 'motorcycle'>('motorcycle');
  const [licensePlate, setLicensePlate] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchDriverSettings();
    }
  }, [user]);

  const fetchDriverSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setIsAvailable(data.is_available);
        setVehicleType(data.vehicle_type);
        setLicensePlate(data.license_plate || '');
      }
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
    }
  };

  const handleUpdateAvailability = async (checked: boolean) => {
    try {
      setIsAvailable(checked);
      const { error } = await supabase
        .from('drivers')
        .update({ is_available: checked })
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({
        title: checked ? 'Você está disponível!' : 'Você está indisponível',
        description: checked 
          ? 'Agora você pode receber novas entregas'
          : 'Você não receberá novas entregas',
      });
    } catch (error) {
      console.error('Erro ao atualizar disponibilidade:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar sua disponibilidade',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('drivers')
        .update({ 
          vehicle_type: vehicleType,
          license_plate: licensePlate || null
        })
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({
        title: 'Sucesso!',
        description: 'Dados do veículo atualizados',
      });
    } catch (error) {
      console.error('Erro ao atualizar veículo:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar os dados do veículo',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DriverSidebar />
        <main className="flex-1 overflow-y-auto">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold">Configurações</h1>
            <div className="ml-auto">
              <NotificationBell />
            </div>
          </header>

          <div className="p-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Disponibilidade
                </CardTitle>
                <CardDescription>
                  Gerencie sua disponibilidade para receber entregas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Disponível para entregas</p>
                    <p className="text-sm text-muted-foreground">
                      Ative para receber novas entregas
                    </p>
                  </div>
                  <Switch
                    checked={isAvailable}
                    onCheckedChange={handleUpdateAvailability}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Dados do Veículo
                </CardTitle>
                <CardDescription>
                  Atualize as informações do seu veículo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateVehicle} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="vehicleType">Tipo de Veículo</Label>
                    <Select 
                      value={vehicleType} 
                      onValueChange={(value) => setVehicleType(value as 'bicycle' | 'car' | 'motorcycle')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="motorcycle">Moto</SelectItem>
                        <SelectItem value="car">Carro</SelectItem>
                        <SelectItem value="bicycle">Bicicleta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="licensePlate">Placa do Veículo (Opcional)</Label>
                    <Input
                      id="licensePlate"
                      value={licensePlate}
                      onChange={(e) => setLicensePlate(e.target.value)}
                      placeholder="ABC-1234"
                      disabled={loading}
                    />
                  </div>

                  <Button type="submit" disabled={loading}>
                    Salvar Alterações
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Privacidade e Segurança
                </CardTitle>
                <CardDescription>
                  Configurações de privacidade e segurança da conta
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" className="w-full" onClick={() => alert('Em desenvolvimento')}>
                  Alterar Senha
                </Button>
                <Button variant="outline" className="w-full" onClick={() => alert('Em desenvolvimento')}>
                  Gerenciar Privacidade
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
