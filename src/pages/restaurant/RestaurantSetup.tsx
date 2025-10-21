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
import { Store, MapPin } from 'lucide-react';

export default function RestaurantSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const businessName = formData.get('businessName') as string;
    const cnpj = formData.get('cnpj') as string;
    const address = formData.get('address') as string;
    const latitude = parseFloat(formData.get('latitude') as string);
    const longitude = parseFloat(formData.get('longitude') as string);

    const { error } = await supabase
      .from('restaurants')
      .insert({
        user_id: user.id,
        business_name: businessName,
        cnpj: cnpj || null,
        address,
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
              Complete as informações do seu restaurante ou loja
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
                  placeholder="Restaurante XYZ"
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

              <div className="space-y-2">
                <Label htmlFor="address">Endereço Completo *</Label>
                <Textarea
                  id="address"
                  name="address"
                  placeholder="Rua Exemplo, 123 - Bairro - Cidade/UF"
                  required
                  disabled={loading}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="latitude">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Latitude *
                  </Label>
                  <Input
                    id="latitude"
                    name="latitude"
                    type="number"
                    step="0.000001"
                    placeholder="-23.550520"
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="longitude">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Longitude *
                  </Label>
                  <Input
                    id="longitude"
                    name="longitude"
                    type="number"
                    step="0.000001"
                    placeholder="-46.633308"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                💡 Dica: Use o Google Maps para obter as coordenadas exatas do seu estabelecimento
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