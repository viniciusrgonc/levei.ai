import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Store } from 'lucide-react';
import LocationPicker from '@/components/LocationPicker';

export default function RestaurantSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [address, setAddress] = useState('');

  const handleLocationSelect = (lat: number, lng: number, addr: string) => {
    setLatitude(lat);
    setLongitude(lng);
    setAddress(addr);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !latitude || !longitude) {
      toast({
        variant: 'destructive',
        title: 'Localização necessária',
        description: 'Por favor, selecione a localização no mapa'
      });
      return;
    }

    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const businessName = formData.get('businessName') as string;
    const cnpj = formData.get('cnpj') as string;
    const manualAddress = formData.get('address') as string;

    const { error } = await supabase
      .from('restaurants')
      .insert({
        user_id: user.id,
        business_name: businessName,
        cnpj: cnpj || null,
        address: manualAddress || address,
        latitude,
        longitude,
        is_approved: true // Auto-approve for MVP
      });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar',
        description: error.message
      });
    } else {
      toast({
        title: 'Cadastro concluído!',
        description: 'Seu estabelecimento foi cadastrado com sucesso'
      });
      navigate('/restaurant/dashboard');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="max-w-2xl mx-auto pt-20">
        <Card>
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Store className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Cadastro do Estabelecimento</CardTitle>
            <CardDescription>
              Complete as informações do seu estabelecimento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="businessName">Nome do Estabelecimento *</Label>
                <Input
                  id="businessName"
                  name="businessName"
                  type="text"
                  placeholder="Minha Empresa"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ (opcional)</Label>
                <Input
                  id="cnpj"
                  name="cnpj"
                  type="text"
                  placeholder="00.000.000/0000-00"
                  disabled={loading}
                />
              </div>

              <div className="space-y-4">
                <Label>Localização no Mapa *</Label>
                <LocationPicker 
                  onLocationSelect={handleLocationSelect}
                  initialLat={latitude || undefined}
                  initialLng={longitude || undefined}
                  initialAddress={address}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Endereço Completo (opcional - será preenchido automaticamente)</Label>
                <Textarea
                  id="address"
                  name="address"
                  placeholder="Ou digite manualmente se preferir..."
                  disabled={loading}
                  rows={3}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

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