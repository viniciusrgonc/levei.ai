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
import { ArrowLeft, Package, MapPin, DollarSign, Calculator, User, Phone } from 'lucide-react';
import LocationPicker from '@/components/LocationPicker';
import { z } from 'zod';
import { SidebarProvider } from '@/components/ui/sidebar';
import { RestaurantSidebar } from '@/components/RestaurantSidebar';
import NotificationBell from '@/components/NotificationBell';
import { Separator } from '@/components/ui/separator';

// Validation schema
const deliverySchema = z.object({
  recipientName: z.string().trim().min(1, 'Nome do destinatário é obrigatório').max(100),
  recipientPhone: z.string().trim().regex(/^\d{10,11}$/, 'Telefone inválido (apenas números, 10-11 dígitos)'),
  deliveryAddress: z.string().trim().min(5, 'Endereço muito curto').max(500),
  description: z.string().trim().max(500, 'Descrição muito longa').optional(),
  price: z.number().min(5, 'Valor mínimo: R$ 5,00').max(500, 'Valor máximo: R$ 500,00'),
});

type Restaurant = {
  id: string;
  business_name: string;
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
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [description, setDescription] = useState('');
  const [customPrice, setCustomPrice] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchRestaurant();
  }, [user]);

  // Update price when suggested price changes
  useEffect(() => {
    if (suggestedPrice && !customPrice) {
      setCustomPrice(suggestedPrice.toFixed(2));
    }
  }, [suggestedPrice]);

  const fetchRestaurant = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('restaurants')
      .select('id, business_name, address, latitude, longitude')
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
    setErrors(prev => ({ ...prev, location: '' }));
    
    if (restaurant) {
      const distance = calculateDistance(
        restaurant.latitude,
        restaurant.longitude,
        lat,
        lng
      );
      
      setCalculatedDistance(distance);
      // Base price R$ 5 + R$ 2 per km
      const price = 5.00 + (distance * 2.00);
      setSuggestedPrice(price);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!recipientName.trim()) {
      newErrors.recipientName = 'Nome do destinatário é obrigatório';
    }

    const phoneDigits = recipientPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      newErrors.recipientPhone = 'Telefone inválido (10-11 dígitos)';
    }

    if (!deliveryAddress.trim() || deliveryAddress.length < 5) {
      newErrors.deliveryAddress = 'Endereço de entrega é obrigatório';
    }

    if (!deliveryLat || !deliveryLng) {
      newErrors.location = 'Selecione a localização no mapa';
    }

    const price = parseFloat(customPrice);
    if (isNaN(price) || price < 5 || price > 500) {
      newErrors.price = 'Valor inválido (R$ 5,00 - R$ 500,00)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !user || !restaurant || !deliveryLat || !deliveryLng) {
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('deliveries')
        .insert({
          restaurant_id: restaurant.id,
          pickup_address: restaurant.address,
          pickup_latitude: restaurant.latitude,
          pickup_longitude: restaurant.longitude,
          delivery_address: deliveryAddress,
          delivery_latitude: deliveryLat,
          delivery_longitude: deliveryLng,
          description: `Destinatário: ${recipientName} | Tel: ${recipientPhone}${description ? ` | ${description}` : ''}`,
          distance_km: calculatedDistance!,
          price: parseFloat(customPrice),
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: '✅ Entrega criada!',
        description: 'Motoristas disponíveis serão notificados em breve'
      });
      
      navigate(`/restaurant/delivery/${data.id}`);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar entrega',
        description: error.message || 'Tente novamente'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <RestaurantSidebar />
        <div className="flex-1">
          <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => navigate('/restaurant/dashboard')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
                <h1 className="text-xl font-semibold">Nova Entrega</h1>
              </div>
              <NotificationBell />
            </div>
          </header>

          <main className="p-6">
            <div className="max-w-3xl mx-auto">
              <Card className="border-2">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <Package className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl">Solicitar Nova Entrega</CardTitle>
                      <CardDescription className="mt-2">
                        Preencha os dados abaixo para solicitar uma entrega
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Pickup Section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">Local de Coleta</h3>
                      </div>
                      <div className="p-4 bg-muted/50 rounded-lg border">
                        <p className="text-sm font-medium text-muted-foreground mb-1">
                          {restaurant.business_name}
                        </p>
                        <p className="text-sm">{restaurant.address}</p>
                      </div>
                    </div>

                    <Separator />

                    {/* Delivery Location */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-destructive" />
                        <h3 className="font-semibold text-lg">Local de Entrega</h3>
                      </div>
                      
                      <LocationPicker 
                        onLocationSelect={handleLocationSelect}
                        initialLat={deliveryLat || undefined}
                        initialLng={deliveryLng || undefined}
                        initialAddress={deliveryAddress}
                      />
                      {errors.location && (
                        <p className="text-sm text-destructive">{errors.location}</p>
                      )}
                      
                      <div className="space-y-2">
                        <Label htmlFor="deliveryAddress">
                          Endereço Completo de Entrega *
                        </Label>
                        <Textarea
                          id="deliveryAddress"
                          placeholder="Rua, número, complemento, bairro..."
                          value={deliveryAddress}
                          onChange={(e) => {
                            setDeliveryAddress(e.target.value);
                            setErrors(prev => ({ ...prev, deliveryAddress: '' }));
                          }}
                          rows={3}
                          disabled={loading}
                          className={errors.deliveryAddress ? 'border-destructive' : ''}
                        />
                        {errors.deliveryAddress && (
                          <p className="text-sm text-destructive">{errors.deliveryAddress}</p>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Recipient Info */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-lg">Dados do Destinatário</h3>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="recipientName">Nome Completo *</Label>
                          <Input
                            id="recipientName"
                            placeholder="Ex: João Silva"
                            value={recipientName}
                            onChange={(e) => {
                              setRecipientName(e.target.value);
                              setErrors(prev => ({ ...prev, recipientName: '' }));
                            }}
                            disabled={loading}
                            className={errors.recipientName ? 'border-destructive' : ''}
                          />
                          {errors.recipientName && (
                            <p className="text-sm text-destructive">{errors.recipientName}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="recipientPhone">Telefone *</Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="recipientPhone"
                              placeholder="11999999999"
                              value={recipientPhone}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '');
                                setRecipientPhone(value);
                                setErrors(prev => ({ ...prev, recipientPhone: '' }));
                              }}
                              maxLength={11}
                              disabled={loading}
                              className={`pl-10 ${errors.recipientPhone ? 'border-destructive' : ''}`}
                            />
                          </div>
                          {errors.recipientPhone && (
                            <p className="text-sm text-destructive">{errors.recipientPhone}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Additional Info */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="description">Observações / Instruções (Opcional)</Label>
                        <Textarea
                          id="description"
                          placeholder="Ex: Tocar campainha 3 vezes, apartamento 201"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          disabled={loading}
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground">
                          Instruções especiais para o motorista
                        </p>
                      </div>
                    </div>

                    {/* Price Calculation */}
                    {calculatedDistance && suggestedPrice && (
                      <div className="p-5 bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20 rounded-lg space-y-3">
                        <div className="flex items-center gap-2 mb-3">
                          <Calculator className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold text-lg">Cálculo da Entrega</h3>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="p-3 bg-background/50 rounded-md">
                            <p className="text-muted-foreground mb-1">Distância</p>
                            <p className="text-lg font-bold">{calculatedDistance.toFixed(2)} km</p>
                          </div>
                          <div className="p-3 bg-background/50 rounded-md">
                            <p className="text-muted-foreground mb-1">Preço Sugerido</p>
                            <p className="text-lg font-bold text-primary">R$ {suggestedPrice.toFixed(2)}</p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="price">Valor a Pagar (R$) *</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="price"
                              type="number"
                              step="0.01"
                              min="5"
                              max="500"
                              placeholder="0.00"
                              value={customPrice}
                              onChange={(e) => {
                                setCustomPrice(e.target.value);
                                setErrors(prev => ({ ...prev, price: '' }));
                              }}
                              disabled={loading}
                              className={`pl-10 text-lg font-semibold ${errors.price ? 'border-destructive' : ''}`}
                            />
                          </div>
                          {errors.price && (
                            <p className="text-sm text-destructive">{errors.price}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            💡 Você pode ajustar o valor sugerido (mín: R$ 5,00 | máx: R$ 500,00)
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Submit Button */}
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full"
                      disabled={loading || !calculatedDistance}
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-background mr-2" />
                          Criando Entrega...
                        </>
                      ) : (
                        <>
                          <Package className="mr-2 h-4 w-4" />
                          Criar Entrega - R$ {customPrice || '0.00'}
                        </>
                      )}
                    </Button>

                    {!calculatedDistance && (
                      <p className="text-sm text-center text-muted-foreground">
                        ⚠️ Selecione o local de entrega no mapa para continuar
                      </p>
                    )}
                  </form>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
