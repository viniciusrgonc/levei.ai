import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, MapPin, Navigation, Package, Check, ChevronRight, Loader2, AlertCircle, Layers } from 'lucide-react';
import LocationPicker from '@/components/LocationPicker';
import VehicleCategorySelector, { DeliveryCategory } from '@/components/VehicleCategorySelector';
import { SidebarProvider } from '@/components/ui/sidebar';
import { RestaurantSidebar } from '@/components/RestaurantSidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

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
  blocked_balance: number;
};

interface ParentDeliveryInfo {
  id: string;
  driver_id: string;
  base_price: number;
  price_per_km: number;
  vehicle_type: string;
}

export default function NewDelivery() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parentDeliveryId = searchParams.get('parent');
  
  // Wizard step
  const [step, setStep] = useState(1);
  const totalSteps = 5;
  
  // Data
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Parent delivery info for batch
  const [parentDelivery, setParentDelivery] = useState<ParentDeliveryInfo | null>(null);
  const [isAdditionalDelivery, setIsAdditionalDelivery] = useState(false);
  
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

  // Fetch parent delivery info if this is an additional delivery
  useEffect(() => {
    if (parentDeliveryId && restaurant) {
      fetchParentDelivery();
    }
  }, [parentDeliveryId, restaurant]);

  useEffect(() => {
    if (pickupLat && pickupLng && deliveryLat && deliveryLng) {
      const dist = calculateDistance(pickupLat, pickupLng, deliveryLat, deliveryLng);
      setDistance(dist);
    }
  }, [pickupLat, pickupLng, deliveryLat, deliveryLng]);

  useEffect(() => {
    if (distance > 0) {
      let price: number;
      
      if (isAdditionalDelivery && parentDelivery) {
        // Use special pricing for additional deliveries
        price = parentDelivery.base_price + (distance * parentDelivery.price_per_km);
      } else if (selectedCategory) {
        price = selectedCategory.base_price + (distance * selectedCategory.price_per_km);
      } else {
        return;
      }
      
      // Apply product type surcharge
      if (productType && productSettings[productType]) {
        price = price * (1 + productSettings[productType] / 100);
      }
      
      setEstimatedPrice(price);
    }
  }, [distance, selectedCategory, productType, productSettings, isAdditionalDelivery, parentDelivery]);

  const fetchRestaurant = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('restaurants')
      .select('id, business_name, address, latitude, longitude, wallet_balance, blocked_balance')
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

  const fetchParentDelivery = async () => {
    if (!parentDeliveryId || !restaurant) return;

    const { data: deliveryData, error } = await supabase
      .from('deliveries')
      .select('id, driver_id, vehicle_category, accepted_at')
      .eq('id', parentDeliveryId)
      .eq('restaurant_id', restaurant.id)
      .in('status', ['accepted', 'picking_up'])
      .maybeSingle();

    if (error || !deliveryData || !deliveryData.driver_id) {
      toast({
        variant: 'destructive',
        title: 'Entregador não disponível',
        description: 'A janela de tempo para adicionar entregas expirou ou a entrega já saiu para coleta.'
      });
      navigate('/restaurant/dashboard');
      return;
    }

    // Check batch availability via RPC
    const { data: batchResult, error: batchError } = await supabase
      .rpc('check_driver_available_for_batch', {
        p_driver_id: deliveryData.driver_id,
        p_restaurant_id: restaurant.id
      });

    if (batchError || !batchResult) {
      toast({
        variant: 'destructive',
        title: 'Erro ao verificar disponibilidade',
        description: 'Tente novamente em alguns instantes.'
      });
      navigate('/restaurant/dashboard');
      return;
    }

    const batchInfo = batchResult as unknown as {
      available: boolean;
      reason?: string;
      time_remaining_minutes?: number;
      base_price?: number;
      price_per_km?: number;
    };

    if (!batchInfo.available) {
      toast({
        variant: 'destructive',
        title: 'Não é possível adicionar entrega',
        description: batchInfo.reason || 'A janela de tempo expirou ou o limite de entregas foi atingido.'
      });
      navigate('/restaurant/dashboard');
      return;
    }

    // Get batch settings for this vehicle type
    const { data: settings } = await supabase
      .from('batch_delivery_settings')
      .select('additional_delivery_base_price, additional_delivery_price_per_km')
      .eq('vehicle_type', deliveryData.vehicle_category)
      .eq('is_active', true)
      .single();

    if (settings) {
      setParentDelivery({
        id: deliveryData.id,
        driver_id: deliveryData.driver_id,
        base_price: Number(settings.additional_delivery_base_price),
        price_per_km: Number(settings.additional_delivery_price_per_km),
        vehicle_type: deliveryData.vehicle_category || 'motorcycle'
      });
      setIsAdditionalDelivery(true);
      // Skip to step 2 (delivery location) since pickup is fixed
      setStep(2);
      
      // Show info toast about time remaining
      if (batchInfo.time_remaining_minutes) {
        toast({
          title: '⏱️ Entrega adicional',
          description: `Você tem ${Math.ceil(batchInfo.time_remaining_minutes)} minutos para finalizar.`
        });
      }
    }
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
        // Skip vehicle selection for additional deliveries
        return isAdditionalDelivery || selectedCategory !== null;
      case 4:
        return productType !== '';
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleNextStep = () => {
    let nextStep = step + 1;
    
    // Skip step 3 (vehicle selection) for additional deliveries
    if (isAdditionalDelivery && nextStep === 3) {
      nextStep = 4;
    }
    
    setStep(nextStep);
  };

  const handlePrevStep = () => {
    let prevStep = step - 1;
    
    // Skip step 3 (vehicle selection) for additional deliveries
    if (isAdditionalDelivery && prevStep === 3) {
      prevStep = 2;
    }
    
    // Skip step 1 for additional deliveries (pickup is fixed)
    if (isAdditionalDelivery && prevStep === 1) {
      navigate('/restaurant/dashboard');
      return;
    }
    
    if (prevStep < 1) {
      navigate('/restaurant/dashboard');
    } else {
      setStep(prevStep);
    }
  };

  const handleSubmit = async () => {
    if (!restaurant || !pickupLat || !pickupLng || !deliveryLat || !deliveryLng) {
      return;
    }

    // For regular deliveries, require selected category
    if (!isAdditionalDelivery && !selectedCategory) {
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
      const vehicleType = isAdditionalDelivery 
        ? parentDelivery?.vehicle_type 
        : (categoryToVehicleType[selectedCategory!.name] || 'motorcycle');

      const basePrice = isAdditionalDelivery 
        ? parentDelivery!.base_price + (distance * parentDelivery!.price_per_km)
        : selectedCategory!.base_price + (distance * selectedCategory!.price_per_km);

      // Create delivery
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
          price: basePrice,
          price_adjusted: estimatedPrice,
          vehicle_category: vehicleType as any,
          product_type: productType,
          status: isAdditionalDelivery ? 'accepted' : 'pending',
          driver_id: isAdditionalDelivery ? parentDelivery?.driver_id : null,
          is_additional_delivery: isAdditionalDelivery,
          parent_delivery_id: isAdditionalDelivery ? parentDelivery?.id : null,
          accepted_at: isAdditionalDelivery ? new Date().toISOString() : null
        }])
        .select()
        .single();

      if (error) throw error;

      // Block funds in escrow
      const { data: blockResult, error: blockError } = await supabase
        .rpc('block_delivery_funds', {
          p_restaurant_id: restaurant.id,
          p_delivery_id: data.id,
          p_amount: estimatedPrice
        });

      const result = blockResult as { success: boolean; error?: string } | null;

      if (blockError || !result?.success) {
        // Rollback delivery creation
        await supabase.from('deliveries').delete().eq('id', data.id);
        throw new Error(result?.error || 'Erro ao bloquear fundos');
      }

      toast({
        title: isAdditionalDelivery ? '✅ Entrega adicionada à rota!' : '✅ Entrega criada!',
        description: isAdditionalDelivery 
          ? `R$ ${estimatedPrice.toFixed(2)} bloqueado. Entrega adicionada ao entregador ativo.`
          : `R$ ${estimatedPrice.toFixed(2)} bloqueado. Aguardando entregador aceitar.`
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
      <div className="flex w-full bg-background layout-mobile-safe no-overflow-x">
        <RestaurantSidebar />
        <div className="flex-1 flex flex-col min-w-0 max-w-full">
          {/* Header */}
          <header className="sticky top-0 z-10 h-12 sm:h-14 border-b bg-background flex items-center px-3 sm:px-4 gap-2 sm:gap-4 safe-top flex-shrink-0">
            <Button 
              variant="ghost" 
              size="icon"
              className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
              onClick={handlePrevStep}
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold flex items-center gap-2 text-sm sm:text-base truncate">
                {isAdditionalDelivery && (
                  <Badge variant="secondary" className="bg-success/10 text-success text-xs flex-shrink-0">
                    <Layers className="w-3 h-3 mr-1" />
                    Adicional
                  </Badge>
                )}
                <span className="truncate">Nova Entrega</span>
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Etapa {step} de {totalSteps}</p>
            </div>
            {/* Progress */}
            <div className="flex gap-0.5 sm:gap-1 flex-shrink-0">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 sm:h-1.5 w-4 sm:w-6 rounded-full transition-colors ${
                    i < step ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </header>

          <main className="flex-1 overflow-auto content-scroll-safe pb-20 sm:pb-24">
            {/* Step 1: Pickup Location - Skip for additional deliveries */}
            {step === 1 && !isAdditionalDelivery && (
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

            {/* Step 3: Vehicle Category - Skip for additional deliveries */}
            {step === 3 && !isAdditionalDelivery && (
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
                          <p className="font-medium">
                            {isAdditionalDelivery ? parentDelivery?.vehicle_type : selectedCategory?.name}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Tipo</p>
                          <div className="flex items-center gap-1">
                            <p className="font-medium">{PRODUCT_TYPES.find(p => p.id === productType)?.label}</p>
                            {isAdditionalDelivery && (
                              <Badge variant="secondary" className="text-xs">Adicional</Badge>
                            )}
                          </div>
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
          <div className="footer-button-safe flex-shrink-0">
            {step < totalSteps ? (
              <Button
                size="lg"
                className="w-full h-12 sm:h-14 text-sm sm:text-base"
                onClick={handleNextStep}
                disabled={!canProceed()}
              >
                Continuar
                <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 ml-2" />
              </Button>
            ) : (
              <Button
                size="lg"
                className="w-full h-12 sm:h-14 text-sm sm:text-base"
                onClick={handleSubmit}
                disabled={submitting || (restaurant ? restaurant.wallet_balance < estimatedPrice : true)}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin mr-2" />
                    Criando...
                  </>
                ) : (
                  <>
                    Solicitar • R$ {estimatedPrice.toFixed(2)}
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
