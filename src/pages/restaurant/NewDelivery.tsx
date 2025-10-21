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
import { ArrowLeft, Package } from 'lucide-react';
import LocationPicker from '@/components/LocationPicker';

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
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');

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

  const handleLocationSelect = (lat: number, lng: number, addr: string) => {
    setDeliveryLat(lat);
    setDeliveryLng(lng);
    setDeliveryAddress(addr);
    
    if (restaurant) {
      const distance = calculateDistance(
        restaurant.latitude,
        restaurant.longitude,
        lat,
        lng
      );
      
      setCalculatedDistance(distance);
      const price = 5.00 + (distance * 2.00);
      setSuggestedPrice(price);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !restaurant || !deliveryLat || !deliveryLng) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Por favor, selecione a localização de entrega no mapa'
      });
      return;
    }

    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const manualAddress = formData.get('deliveryAddress') as string;
    const description = formData.get('description') as string;
    const price = parseFloat(formData.get('price') as string);

    const { data, error } = await supabase
      .from('deliveries')
      .insert({
        restaurant_id: restaurant.id,
        pickup_address: restaurant.address,
        pickup_latitude: restaurant.latitude,
        pickup_longitude: restaurant.longitude,
        delivery_address: manualAddress || deliveryAddress,
        delivery_latitude: deliveryLat,
        delivery_longitude: deliveryLng,
        description: description || null,
        distance_km: calculatedDistance!,
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

              <div className="space-y-4">
                <Label>Localização de Entrega *</Label>
                <LocationPicker 
                  onLocationSelect={handleLocationSelect}
                  initialLat={deliveryLat || undefined}
                  initialLng={deliveryLng || undefined}
                  initialAddress={deliveryAddress}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deliveryAddress">Endereço de Entrega (opcional - será preenchido automaticamente)</Label>
                <Textarea
                  id="deliveryAddress"
                  name="deliveryAddress"
                  placeholder="Ou digite manualmente se preferir..."
                  disabled={loading}
                  rows={3}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                />
              </div>

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