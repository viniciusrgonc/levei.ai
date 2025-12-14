import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, MapPin, Navigation, Package, Check, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import LocationPicker from '@/components/LocationPicker';
import VehicleCategorySelector, { DeliveryCategory } from '@/components/VehicleCategorySelector';
import { SidebarProvider } from '@/components/ui/sidebar';
import { RestaurantSidebar } from '@/components/RestaurantSidebar';
import { Skeleton } from '@/components/ui/skeleton';

const PRODUCT_TYPES = [
  { id: 'documento', label: 'Documento', icon: '📄' },
  { id: 'encomenda', label: 'Encomenda', icon: '📦' },
  { id: 'alimento', label: 'Alimento', icon: '🍔' },
  { id: 'fragil', label: 'Produto Frágil', icon: '⚠️' },
  { id: 'eletronico', label: 'Eletrônico', icon: '📱' },
  { id: 'outro', label: 'Outro', icon: '📋' },
];

const categoryToVehicleType: Record<string, string> = {
  'Moto': 'motorcycle',
  'Motocicleta': 'motorcycle',
  'Carro': 'car',
  'Van': 'van',
  'Caminhão': 'truck',
  'Serviço por Hora': 'hourly_service',
};

type Restaurant = {
  id: string;
  business_name: string;
  address: string;
  latitude: number;
  longitude: number;
  wallet_balance: number;
};

export default function NewDelivery() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Wizard step
  const [step, setStep] = useState(1);
  const totalSteps = 5;
  
  // Data
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Step 1: Pickup
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  
  // Step 2: Delivery
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  
  // Step 3: Vehicle
  const [selectedCategory, setSelectedCategory] = useState<DeliveryCategory | null>(null);
  
  // Step 4: Product
  const [productType, setProductType] = useState('');
  
  // Calculated
  const [distance, setDistance] = useState<number>(0);
  const [estimatedPrice, setEstimatedPrice] = useState<number>(0);
  const [productSettings, setProductSettings] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchRestaurant();
    fetchProductSettings();
  }, [user]);

  useEffect(() => {
    if (pickupLat && pickupLng && deliveryLat && deliveryLng) {
      const dist = calculateDistance(pickupLat, pickupLng, deliveryLat, deliveryLng);
      setDistance(dist);
    }
  }, [pickupLat, pickupLng, deliveryLat, deliveryLng]);

  useEffect(() => {
    if (distance > 0 && selectedCategory) {
      let price = selectedCategory.base_price + (distance * selectedCategory.price_per_km);
      
      // Apply product type surcharge
      if (productType && productSettings[productType]) {
        price = price * (1 + productSettings[productType] / 100);
      }
      
      setEstimatedPrice(price);
    }
  }, [distance, selectedCategory, productType, productSettings]);

  const fetchRestaurant = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('restaurants')
      .select('id, business_name, address, latitude, longitude, wallet_balance')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      navigate('/restaurant/dashboard');
      return;
    }

    setRestaurant(data);
    setPickupAddress(data.address);
    setPickupLat(data.latitude);
    setPickupLng(data.longitude);
    setLoading(false);
  };

  const fetchProductSettings = async () => {
    const { data } = await supabase
      .from('product_type_settings')
      .select('product_type, percentage_increase')
      .eq('is_active', true);

    if (data) {
      const settings: Record<string, number> = {};
      data.forEach(s => settings[s.product_type] = s.percentage_increase);
      setProductSettings(settings);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return pickupLat && pickupLng && pickupAddress;
      case 2:
        return deliveryLat && deliveryLng && deliveryAddress;
      case 3:
        return selectedCategory !== null;
      case 4:
        return productType !== '';
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    if (!restaurant || !pickupLat || !pickupLng || !deliveryLat || !deliveryLng || !selectedCategory) {
      return;
    }

    if (restaurant.wallet_balance < estimatedPrice) {
      toast({
        variant: 'destructive',
        title: 'Saldo insuficiente',
        description: `Você precisa de R$ ${estimatedPrice.toFixed(2)} mas tem apenas R$ ${restaurant.wallet_balance.toFixed(2)}.`
      });
      navigate('/restaurant/wallet');
      return;
    }

    setSubmitting(true);

    try {
      const vehicleType = categoryToVehicleType[selectedCategory.name] || 'motorcycle';

      const { data, error } = await supabase
        .from('deliveries')
        .insert([{
          restaurant_id: restaurant.id,
          pickup_address: pickupAddress,
          pickup_latitude: pickupLat,
          pickup_longitude: pickupLng,
          delivery_address: deliveryAddress,
          delivery_latitude: deliveryLat,
          delivery_longitude: deliveryLng,
          recipient_name: recipientName || null,
          recipient_phone: recipientPhone || null,
          distance_km: distance,
          price: selectedCategory.base_price + (distance * selectedCategory.price_per_km),
          price_adjusted: estimatedPrice,
          vehicle_category: vehicleType as any,
          product_type: productType,
          status: 'pending'
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: '✅ Entrega criada!',
        description: 'Aguardando entregador aceitar'
      });
      
      navigate(`/restaurant/delivery/${data.id}`);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <RestaurantSidebar />
          <div className="flex-1 p-6">
            <Skeleton className="h-12 w-full mb-6" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <RestaurantSidebar />
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="sticky top-0 z-10 h-16 border-b bg-background flex items-center px-4 gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => step > 1 ? setStep(step - 1) : navigate('/restaurant/dashboard')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="font-semibold">Nova Entrega</h1>
              <p className="text-xs text-muted-foreground">Etapa {step} de {totalSteps}</p>
            </div>
            {/* Progress */}
            <div className="flex gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-6 rounded-full transition-colors ${
                    i < step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            {/* Step 1: Pickup Location */}
            {step === 1 && (
              <div className="p-4 space-y-4">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-green-100 mx-auto mb-3 flex items-center justify-center">
                    <MapPin className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold">Local de Coleta</h2>
                  <p className="text-sm text-muted-foreground">De onde será coletado o pacote?</p>
                </div>

                <Card>
                  <CardContent className="p-4">
                    <div className="p-3 bg-muted/50 rounded-lg mb-4">
                      <p className="text-sm font-medium">{restaurant?.business_name}</p>
                      <p className="text-sm text-muted-foreground">{pickupAddress}</p>
                    </div>
                    
                    <LocationPicker
                      onLocationSelect={(lat, lng, addr) => {
                        setPickupLat(lat);
                        setPickupLng(lng);
                        setPickupAddress(addr);
                      }}
                      initialLat={pickupLat || undefined}
                      initialLng={pickupLng || undefined}
                      initialAddress={pickupAddress}
                    />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Step 2: Delivery Location */}
            {step === 2 && (
              <div className="p-4 space-y-4">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-red-100 mx-auto mb-3 flex items-center justify-center">
                    <Navigation className="h-8 w-8 text-red-600" />
                  </div>
                  <h2 className="text-xl font-bold">Local de Entrega</h2>
                  <p className="text-sm text-muted-foreground">Para onde será entregue?</p>
                </div>

                <Card>
                  <CardContent className="p-4 space-y-4">
                    <LocationPicker
                      onLocationSelect={(lat, lng, addr) => {
                        setDeliveryLat(lat);
                        setDeliveryLng(lng);
                        setDeliveryAddress(addr);
                      }}
                      initialLat={deliveryLat || undefined}
                      initialLng={deliveryLng || undefined}
                      initialAddress={deliveryAddress}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="recipientName">Nome do destinatário</Label>
                        <Input
                          id="recipientName"
                          placeholder="Nome (opcional)"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="recipientPhone">Telefone</Label>
                        <Input
                          id="recipientPhone"
                          placeholder="(00) 00000-0000"
                          value={recipientPhone}
                          onChange={(e) => setRecipientPhone(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {distance > 0 && (
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Distância estimada</p>
                    <p className="text-2xl font-bold">{distance.toFixed(1)} km</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Vehicle Category */}
            {step === 3 && (
              <div className="p-4 space-y-4">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-blue-100 mx-auto mb-3 flex items-center justify-center">
                    <span className="text-3xl">🚗</span>
                  </div>
                  <h2 className="text-xl font-bold">Tipo de Veículo</h2>
                  <p className="text-sm text-muted-foreground">Selecione o veículo adequado</p>
                </div>

                <VehicleCategorySelector
                  onSelect={(id, category) => setSelectedCategory(category)}
                  selectedCategoryId={selectedCategory?.id || null}
                />

                {selectedCategory && distance > 0 && (
                  <Card className="border-primary/50 bg-primary/5">
                    <CardContent className="p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-1">Preço estimado</p>
                      <p className="text-3xl font-bold text-primary">
                        R$ {(selectedCategory.base_price + (distance * selectedCategory.price_per_km)).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Base R$ {selectedCategory.base_price.toFixed(2)} + R$ {selectedCategory.price_per_km.toFixed(2)}/km
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Step 4: Product Type */}
            {step === 4 && (
              <div className="p-4 space-y-4">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-purple-100 mx-auto mb-3 flex items-center justify-center">
                    <Package className="h-8 w-8 text-purple-600" />
                  </div>
                  <h2 className="text-xl font-bold">O que será enviado?</h2>
                  <p className="text-sm text-muted-foreground">Isso ajuda no cuidado com sua entrega</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {PRODUCT_TYPES.map((type) => (
                    <Card
                      key={type.id}
                      className={`cursor-pointer transition-all ${
                        productType === type.id 
                          ? 'border-2 border-primary bg-primary/5' 
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => setProductType(type.id)}
                    >
                      <CardContent className="p-4 text-center">
                        <span className="text-3xl mb-2 block">{type.icon}</span>
                        <p className="font-medium text-sm">{type.label}</p>
                        {productType === type.id && (
                          <Check className="h-5 w-5 text-primary mx-auto mt-2" />
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5: Summary */}
            {step === 5 && (
              <div className="p-4 space-y-4">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-green-100 mx-auto mb-3 flex items-center justify-center">
                    <Check className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold">Confirmar Entrega</h2>
                  <p className="text-sm text-muted-foreground">Revise os dados antes de confirmar</p>
                </div>

                <Card>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Coleta</p>
                        <p className="text-sm font-medium">{pickupAddress}</p>
                      </div>
                    </div>

                    <div className="border-l-2 border-dashed border-muted ml-4 h-4" />

                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <Navigation className="h-4 w-4 text-red-600" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Entrega</p>
                        <p className="text-sm font-medium">{deliveryAddress}</p>
                        {recipientName && (
                          <p className="text-xs text-muted-foreground">Para: {recipientName}</p>
                        )}
                      </div>
                    </div>

                    <div className="border-t pt-4 mt-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Distância</p>
                          <p className="font-medium">{distance.toFixed(1)} km</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Veículo</p>
                          <p className="font-medium">{selectedCategory?.name}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Tipo</p>
                          <p className="font-medium">{PRODUCT_TYPES.find(p => p.id === productType)?.label}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Seu saldo</p>
                          <p className="font-medium">R$ {restaurant?.wallet_balance.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-primary bg-primary/5">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">Valor total</p>
                    <p className="text-4xl font-bold text-primary">
                      R$ {estimatedPrice.toFixed(2)}
                    </p>
                  </CardContent>
                </Card>

                {restaurant && restaurant.wallet_balance < estimatedPrice && (
                  <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent className="p-4 flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
                      <div>
                        <p className="font-medium text-destructive">Saldo insuficiente</p>
                        <p className="text-sm text-muted-foreground">
                          Adicione R$ {(estimatedPrice - restaurant.wallet_balance).toFixed(2)} ao seu saldo
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </main>

          {/* Footer Button */}
          <div className="sticky bottom-0 p-4 bg-background border-t safe-area-bottom">
            {step < totalSteps ? (
              <Button
                size="xl"
                className="w-full"
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
              >
                Continuar
                <ChevronRight className="h-5 w-5 ml-2" />
              </Button>
            ) : (
              <Button
                size="xl"
                className="w-full"
                onClick={handleSubmit}
                disabled={submitting || (restaurant ? restaurant.wallet_balance < estimatedPrice : true)}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Criando...
                  </>
                ) : (
                  <>
                    Solicitar Entrega • R$ {estimatedPrice.toFixed(2)}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
