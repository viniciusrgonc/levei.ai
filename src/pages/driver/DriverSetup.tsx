import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Bike } from 'lucide-react';

export default function DriverSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vehicleType, setVehicleType] = useState<'motorcycle' | 'bicycle' | 'car'>('motorcycle');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const licensePlate = formData.get('licensePlate') as string || null;

    const { error } = await supabase
      .from('drivers')
      .insert([{
        user_id: user.id,
        vehicle_type: vehicleType,
        license_plate: licensePlate,
        is_available: false,
        is_approved: true // Auto-approve for MVP
      }]);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar',
        description: error.message
      });
    } else {
      toast({
        title: 'Cadastro concluído!',
        description: 'Seu perfil de motorista foi cadastrado com sucesso'
      });
      navigate('/driver/dashboard');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="max-w-2xl mx-auto pt-20">
        <Card>
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Bike className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Cadastro de Motorista</CardTitle>
            <CardDescription>
              Complete as informações do seu veículo para começar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="vehicleType">Tipo de Veículo *</Label>
                <Select value={vehicleType} onValueChange={(value) => setVehicleType(value as 'motorcycle' | 'bicycle' | 'car')} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de veículo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="motorcycle">Moto</SelectItem>
                    <SelectItem value="bicycle">Bicicleta</SelectItem>
                    <SelectItem value="car">Carro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="licensePlate">Placa do Veículo (Opcional)</Label>
                <Input
                  id="licensePlate"
                  name="licensePlate"
                  type="text"
                  placeholder="ABC-1234 (opcional)"
                  disabled={loading}
                />
              </div>

              <p className="text-sm text-muted-foreground">
                💡 Você poderá ativar/desativar sua disponibilidade no dashboard
              </p>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Salvando...' : 'Concluir Cadastro'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
