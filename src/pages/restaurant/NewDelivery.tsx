import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, MapPin, Package } from 'lucide-react';

type Restaurant = {
  id: string;
  address: string;
  latitude: number;
  longitude: number;
};

export default function NewDelivery() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);
  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null);

  useEffect(() => {
    fetchRestaurant();
  }, [user]);

  const fetchRestaurant = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('restaurants')
      .select('id, address, latitude, longitude')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar dados do restaurante'
      });
      navigate('/restaurant/dashboard');
      return;
    }

    setRestaurant(data);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleCalculate = () => {
    if (!restaurant) return;

    const deliveryLatInput = document.getElementById('deliveryLatitude') as HTMLInputElement;
    const deliveryLonInput = document.getElementById('deliveryLongitude') as HTMLInputElement;

    const deliveryLat = parseFloat(deliveryLatInput.value);
    const deliveryLon = parseFloat(deliveryLonInput.value);

    if (isNaN(deliveryLat) || isNaN(deliveryLon)) {
      toast({
        variant: 'destructive',
        title: 'Coordenadas inválidas',
        description: 'Por favor, insira coordenadas válidas'
      });
      return;
    }

    const distance = calculateDistance(
      restaurant.latitude,
      restaurant.longitude,
      deliveryLat,
      deliveryLon
    );

    setCalculatedDistance(distance);

    // Simple price calculation: R$ 5.00 base + R$ 2.00 per km
    const price = 5.00 + (distance * 2.00);
    setSuggestedPrice(price);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !restaurant || !calculatedDistance || !suggestedPrice) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Por favor, calcule a distância primeiro'
      });
      return;
    }

    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const deliveryAddress = formData.get('deliveryAddress') as string;
    const deliveryLatitude = parseFloat(formData.get('deliveryLatitude') as string);
    const deliveryLongitude = parseFloat(formData.get('deliveryLongitude') as string);
    const description = formData.get('description') as string;
    const price = parseFloat(formData.get('price') as string);

    const { data, error } = await supabase
      .from('deliveries')
      .insert({
        restaurant_id: restaurant.id,
        pickup_address: restaurant.address,
        pickup_latitude: restaurant.latitude,
        pickup_longitude: restaurant.longitude,
        delivery_address: deliveryAddress,
        delivery_latitude: deliveryLatitude,
        delivery_longitude: deliveryLongitude,
        description: description || null,
        distance_km: calculatedDistance,
        price: price,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar entrega',
        description: error.message
      });
    } else {
      toast({
        title: 'Entrega criada!',
        description: 'Motoboys disponíveis serão notificados'
      });
      navigate(`/restaurant/delivery/${data.id}`);
    }

    setLoading(false);
  };

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate('/restaurant/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Nova Entrega</CardTitle>
            <CardDescription>
              Preencha os dados da entrega
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Pickup Address (Read-only) */}
              <div className="space-y-2">
                <Label>Endereço de Coleta</Label>
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm">{restaurant.address}</p>
                </div>
              </div>

              {/* Delivery Address */}
              <div className="space-y-2">
                <Label htmlFor="deliveryAddress">Endereço de Entrega *</Label>
                <Textarea
                  id="deliveryAddress"
                  name="deliveryAddress"
                  placeholder="Rua Exemplo, 456 - Bairro - Cidade/UF"
                  required
                  disabled={loading}
                  rows={3}
                />
              </div>

              {/* Coordinates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deliveryLatitude">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Latitude *
                  </Label>
                  <Input
                    id="deliveryLatitude"
                    name="deliveryLatitude"
                    type="number"
                    step="0.000001"
                    placeholder="-23.550520"
                    required
                    disabled={loading}
                    onChange={() => {
                      setCalculatedDistance(null);
                      setSuggestedPrice(null);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deliveryLongitude">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Longitude *
                  </Label>
                  <Input
                    id="deliveryLongitude"
                    name="deliveryLongitude"
                    type="number"
                    step="0.000001"
                    placeholder="-46.633308"
                    required
                    disabled={loading}
                    onChange={() => {
                      setCalculatedDistance(null);
                      setSuggestedPrice(null);
                    }}
                  />
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleCalculate}
                disabled={loading}
              >
                Calcular Distância e Preço
              </Button>

              {calculatedDistance && suggestedPrice && (
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg space-y-2">
                  <p className="text-sm">
                    <strong>Distância:</strong> {calculatedDistance.toFixed(2)} km
                  </p>
                  <p className="text-sm">
                    <strong>Preço Sugerido:</strong> R$ {suggestedPrice.toFixed(2)}
                  </p>
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Descrição / Instruções (opcional)</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Ex: Buscar pedido #123, entregar para João"
                  disabled={loading}
                  rows={3}
                />
              </div>

              {/* Price */}
              <div className="space-y-2">
                <Label htmlFor="price">Valor a Pagar (R$) *</Label>
                <Input
                  id="price"
                  name="price"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  required
                  disabled={loading || !suggestedPrice}
                  defaultValue={suggestedPrice?.toFixed(2) || ''}
                />
                <p className="text-xs text-muted-foreground">
                  Você pode ajustar o valor sugerido
                </p>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !calculatedDistance}
              >
                {loading ? 'Criando...' : 'Criar Entrega'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}