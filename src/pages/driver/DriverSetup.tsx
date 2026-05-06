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
import { Bike, Gift } from 'lucide-react';

export default function DriverSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vehicleType, setVehicleType] = useState<string>('motorcycle');
  const [referralCode, setReferralCode] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const licensePlate = formData.get('licensePlate') as string || null;

    // 1. Create driver record
    const { data: newDriver, error } = await supabase
      .from('drivers')
      .insert([{
        user_id: user.id,
        vehicle_type: vehicleType as any,
        license_plate: licensePlate,
        is_available: false,
        is_approved: true,
      }])
      .select('id')
      .single();

    if (error || !newDriver) {
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar',
        description: error?.message,
      });
      setLoading(false);
      return;
    }

    // 2. Register referral (non-blocking, fire-and-forget)
    const trimmedCode = referralCode.trim().toUpperCase();
    if (trimmedCode) {
      supabase
        .rpc('register_referral', {
          p_referred_driver_id: newDriver.id,
          p_referral_code: trimmedCode,
        })
        .then(({ data: result }) => {
          if (result === 'ok') {
            toast({ title: '🎉 Código de indicação válido! Bom trabalho.' });
          }
          // silently ignore 'code_not_found' — don't block user
        });
    }

    toast({
      title: 'Cadastro concluído!',
      description: 'Seu perfil de entregador foi cadastrado com sucesso',
    });
    navigate('/driver/dashboard');
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
            <CardTitle>Cadastro de Entregador</CardTitle>
            <CardDescription>
              Complete as informações do seu veículo para começar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="vehicleType">Tipo de Veículo *</Label>
                <Select value={vehicleType} onValueChange={(value) => setVehicleType(value)} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de veículo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="motorcycle">Motocicleta</SelectItem>
                    <SelectItem value="bicycle">Bicicleta</SelectItem>
                    <SelectItem value="car">Carro</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                    <SelectItem value="truck">Caminhão</SelectItem>
                    <SelectItem value="hourly_service">Serviço por Hora</SelectItem>
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

              {/* Referral code */}
              <div className="space-y-2">
                <Label htmlFor="referralCode" className="flex items-center gap-1.5">
                  <Gift className="h-3.5 w-3.5 text-blue-500" />
                  Quem te indicou? (Opcional)
                </Label>
                <Input
                  id="referralCode"
                  type="text"
                  placeholder="Ex: VINI123"
                  value={referralCode}
                  onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                  disabled={loading}
                  className="uppercase tracking-widest font-mono"
                  maxLength={12}
                />
                <p className="text-xs text-muted-foreground">
                  Quem te indicou ganha pontos quando você completar 5 entregas
                </p>
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
