import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Check,
  ChevronRight,
  Loader2,
  AlertCircle,
  Layers,
  Bike,
  Car,
  Truck,
  Package,
  Edit2,
} from 'lucide-react';
import LocationPicker from '@/components/LocationPicker';
import VehicleCategorySelector, { DeliveryCategory } from '@/components/VehicleCategorySelector';
import DeliveryMap from '@/components/DeliveryMap';
import { SidebarProvider } from '@/components/ui/sidebar';
import { RestaurantSidebar } from '@/components/RestaurantSidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatAddress } from '@/lib/utils';

const PRODUCT_TYPES = [
  { id: 'alimento',   label: 'Alimento',        icon: '🍔' },
  { id: 'encomenda',  label: 'Encomenda',        icon: '📦' },
  { id: 'documento',  label: 'Documento',        icon: '📄' },
  { id: 'fragil',     label: 'Produto Frágil',   icon: '⚠️' },
  { id: 'eletronico', label: 'Eletrônico',       icon: '📱' },
  { id: 'outro',      label: 'Outro',            icon: '🎁' },
];

const categoryToVehicleType: Record<string, string> = {
  Moto: 'motorcycle', Motocicleta: 'motorcycle',
  Carro: 'car', Van: 'van', Caminhão: 'truck',
  Utilitário: 'van', 'Serviço por Hora': 'hourly_service',
};

const vehicleIcon = (name: string) => {
  const n = name?.toLowerCase() || '';
  if (n.includes('moto')) return <Bike className="h-5 w-5" />;
  if (n.includes('carro')) return <Car className="h-5 w-5" />;
  return <Truck className="h-5 w-5" />;
};

type Restaurant = {
  id: string; business_name: string; address: string;
  latitude: number; longitude: number; wallet_balance: number; blocked_balance: number;
};

interface ParentDeliveryInfo {
  id: string; driver_id: string; base_price: number; price_per_km: number; vehicle_type: string;
}

export default function NewDelivery() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parentDeliveryId = searchParams.get('parent');

  const [step, setStep] = useState(1);
  const totalSteps = 5;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [parentDelivery, setParentDelivery] = useState<ParentDeliveryInfo | null>(null);
  const [isAdditionalDelivery, setIsAdditionalDelivery] = useState(false);

  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryLat, setDeliveryLat] = useState<number | null>(null);
  const [deliveryLng, setDeliveryLng] = useState<number | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [needsPickupHelp, setNeedsPickupHelp] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<DeliveryCategory | null>(null);
  const [productType, setProductType] = useState('');
  const [distance, setDistance] = useState<number>(0);
  const [estimatedPrice, setEstimatedPrice] = useState<number>(0);
  const [productSettings, setProductSettings] = useState<Record<string, number>>({});

  useEffect(() => { fetchRestaurant(); fetchProductSettings(); }, [user]);

  useEffect(() => {
    if (parentDeliveryId && restaurant) fetchParentDelivery();
  }, [parentDeliveryId, restaurant]);

  useEffect(() => {
    if (pickupLat && pickupLng && deliveryLat && deliveryLng) {
      setDistance(calculateDistance(pickupLat, pickupLng, deliveryLat, deliveryLng));
    }
  }, [pickupLat, pickupLng, deliveryLat, deliveryLng]);

  useEffect(() => {
    if (distance > 0) {
      let price = 0;
      if (isAdditionalDelivery && parentDelivery) {
        price = parentDelivery.base_price + distance * parentDelivery.price_per_km;
      } else if (selectedCategory) {
        price = selectedCategory.base_price + distance * selectedCategory.price_per_km;
      } else return;
      if (productType && productSettings[productType]) price *= (1 + productSettings[productType] / 100);
      setEstimatedPrice(price);
    }
  }, [distance, selectedCategory, productType, productSettings, isAdditionalDelivery, parentDelivery]);

  const fetchRestaurant = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, business_name, address, latitude, longitude, wallet_balance, blocked_balance')
      .eq('user_id', user.id).single();
    if (error || !data) { navigate('/restaurant/dashboard'); return; }
    setRestaurant(data);
    setPickupAddress(data.address);
    setPickupLat(data.latitude);
    setPickupLng(data.longitude);
    setLoading(false);
  };

  const fetchParentDelivery = async () => {
    if (!parentDeliveryId || !restaurant) return;
    const { data: deliveryData, error } = await supabase.from('deliveries')
      .select('id, driver_id, vehicle_category, accepted_at')
      .eq('id', parentDeliveryId).eq('restaurant_id', restaurant.id)
      .in('status', ['accepted', 'picking_up']).maybeSingle();
    if (error || !deliveryData?.driver_id) {
      toast({ variant: 'destructive', title: 'Entregador não disponível', description: 'A janela de tempo expirou.' });
      navigate('/restaurant/dashboard'); return;
    }
    const { data: batchResult, error: batchError } = await supabase.rpc('check_driver_available_for_batch', {
      p_driver_id: deliveryData.driver_id, p_restaurant_id: restaurant.id,
    });
    if (batchError || !batchResult) {
      toast({ variant: 'destructive', title: 'Erro ao verificar disponibilidade' });
      navigate('/restaurant/dashboard'); return;
    }
    const batchInfo = batchResult as unknown as { available: boolean; reason?: string; time_remaining_minutes?: number };
    if (!batchInfo.available) {
      toast({ variant: 'destructive', title: 'Não é possível adicionar entrega', description: batchInfo.reason });
      navigate('/restaurant/dashboard'); return;
    }
    const { data: settings } = await supabase.from('batch_delivery_settings')
      .select('additional_delivery_base_price, additional_delivery_price_per_km')
      .eq('vehicle_type', deliveryData.vehicle_category).eq('is_active', true).single();
    if (settings) {
      setParentDelivery({ id: deliveryData.id, driver_id: deliveryData.driver_id,
        base_price: Number(settings.additional_delivery_base_price),
        price_per_km: Number(settings.additional_delivery_price_per_km),
        vehicle_type: deliveryData.vehicle_category || 'motorcycle' });
      setIsAdditionalDelivery(true);
      setStep(2);
      if (batchInfo.time_remaining_minutes) {
        toast({ title: '🚀 Entrega adicional', description: `${Math.ceil(batchInfo.time_remaining_minutes)} min para adicionar à rota.` });
      }
    }
  };

  const fetchProductSettings = async () => {
    const { data } = await supabase.from('product_type_settings')
      .select('product_type, percentage_increase').eq('is_active', true);
    if (data) {
      const s: Record<string, number> = {};
      data.forEach(r => (s[r.product_type] = r.percentage_increase));
      setProductSettings(s);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371, dLat = ((lat2 - lat1) * Math.PI) / 180, dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const canProceed = () => {
    switch (step) {
      case 1: return !!(pickupLat && pickupLng && pickupAddress);
      case 2: return !!(deliveryLat && deliveryLng && deliveryAddress);
      case 3: return isAdditionalDelivery || selectedCategory !== null;
      case 4: return productType !== '';
      case 5: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    let next = step + 1;
    if (isAdditionalDelivery && next === 3) next = 4;
    setStep(next);
  };

  const handleBack = () => {
    let prev = step - 1;
    if (isAdditionalDelivery && prev === 3) prev = 2;
    if (isAdditionalDelivery && prev === 1) { navigate('/restaurant/dashboard'); return; }
    if (prev < 1) navigate('/restaurant/dashboard');
    else setStep(prev);
  };

  const handleSubmit = async () => {
    if (!restaurant || !pickupLat || !pickupLng || !deliveryLat || !deliveryLng) return;
    if (!isAdditionalDelivery && !selectedCategory) return;
    if (restaurant.wallet_balance < estimatedPrice) {
      toast({ variant: 'destructive', title: 'Saldo insuficiente',
        description: `Adicione R$ ${(estimatedPrice - restaurant.wallet_balance).toFixed(2)} à sua carteira.` });
      navigate('/restaurant/wallet'); return;
    }
    setSubmitting(true);
    try {
      const vehicleType = isAdditionalDelivery
        ? parentDelivery?.vehicle_type
        : categoryToVehicleType[selectedCategory!.name] || 'motorcycle';
      const basePrice = isAdditionalDelivery
        ? parentDelivery!.base_price + distance * parentDelivery!.price_per_km
        : selectedCategory!.base_price + distance * selectedCategory!.price_per_km;
      const { data, error } = await supabase.from('deliveries').insert([{
        restaurant_id: restaurant.id, pickup_address: pickupAddress, pickup_latitude: pickupLat,
        pickup_longitude: pickupLng, delivery_address: deliveryAddress, delivery_latitude: deliveryLat,
        delivery_longitude: deliveryLng, recipient_name: recipientName || null,
        recipient_phone: recipientPhone || null, distance_km: distance, price: basePrice,
        price_adjusted: estimatedPrice, vehicle_category: vehicleType as any, product_type: productType,
        status: isAdditionalDelivery ? 'accepted' : 'pending',
        driver_id: isAdditionalDelivery ? parentDelivery?.driver_id : null,
        is_additional_delivery: isAdditionalDelivery,
        parent_delivery_id: isAdditionalDelivery ? parentDelivery?.id : null,
        accepted_at: isAdditionalDelivery ? new Date().toISOString() : null,
      }]).select().single();
      if (error) throw error;
      const { data: blockResult, error: blockError } = await supabase.rpc('block_delivery_funds', {
        p_restaurant_id: restaurant.id, p_delivery_id: data.id, p_amount: estimatedPrice,
      });
      const result = blockResult as { success: boolean; error?: string } | null;
      if (blockError || !result?.success) {
        await supabase.from('deliveries').delete().eq('id', data.id);
        throw new Error(result?.error || 'Erro ao bloquear fundos');
      }
      toast({ title: isAdditionalDelivery ? '✅ Entrega adicionada!' : '✅ Entrega criada!',
        description: `R$ ${estimatedPrice.toFixed(2)} bloqueado.` });
      navigate(`/restaurant/delivery/${data.id}`);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-gray-50">
          <RestaurantSidebar />
          <div className="flex-1 p-6 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </SidebarProvider>
    );
  }

  // ── Step count for progress bar ──
  const displayStep = isAdditionalDelivery ? step - 1 : step;
  const displayTotal = isAdditionalDelivery ? totalSteps - 1 : totalSteps;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <RestaurantSidebar />
        <div className="flex-1 flex flex-col min-w-0">

          {/* ── HEADER ── */}
          <header className="sticky top-0 z-10 h-14 border-b bg-white flex items-center gap-3 px-4 shadow-sm">
            <button onClick={handleBack} className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-semibold text-gray-900 text-sm">Nova Entrega</h1>
                {isAdditionalDelivery && (
                  <Badge className="bg-green-100 text-green-700 border-none text-xs">
                    <Layers className="w-3 h-3 mr-1" />Adicional
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-400">Etapa {displayStep} de {displayTotal}</p>
            </div>
            {/* Progress dots */}
            <div className="flex gap-1">
              {Array.from({ length: displayTotal }).map((_, i) => (
                <div key={i} className={`h-1.5 w-5 rounded-full transition-colors ${i < displayStep ? 'bg-blue-600' : 'bg-gray-200'}`} />
              ))}
            </div>
          </header>

          <main className="flex-1 overflow-auto pb-24">

            {/* ── STEP 1: Coleta (pickup) ── */}
            {step === 1 && !isAdditionalDelivery && (
              <div className="p-4 space-y-4">
                <div className="text-center pt-4 pb-2">
                  <div className="w-14 h-14 rounded-full bg-green-100 mx-auto mb-3 flex items-center justify-center">
                    <MapPin className="h-7 w-7 text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Local de Coleta</h2>
                  <p className="text-sm text-gray-500 mt-1">De onde será coletado o pacote?</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm p-4">
                  <div className="flex items-start gap-3 mb-4 p-3 bg-green-50 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <MapPin className="h-4 w-4 text-green-700" />
                    </div>
                    <div>
                      <p className="text-xs text-green-700 font-medium">Endereço atual</p>
                      <p className="text-sm font-semibold text-gray-900">{restaurant?.business_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{pickupAddress}</p>
                    </div>
                  </div>
                  <LocationPicker
                    onLocationSelect={(lat, lng, addr) => { setPickupLat(lat); setPickupLng(lng); setPickupAddress(addr); }}
                    initialLat={pickupLat || undefined}
                    initialLng={pickupLng || undefined}
                    initialAddress={pickupAddress}
                  />
                </div>
              </div>
            )}

            {/* ── STEP 2: Destino ── */}
            {step === 2 && (
              <div className="p-4 space-y-4">
                <div className="text-center pt-4 pb-2">
                  <div className="w-14 h-14 rounded-full bg-red-100 mx-auto mb-3 flex items-center justify-center">
                    <Navigation className="h-7 w-7 text-red-500" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Local de Entrega</h2>
                  <p className="text-sm text-gray-500 mt-1">Para onde será entregue?</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
                  <LocationPicker
                    onLocationSelect={(lat, lng, addr) => { setDeliveryLat(lat); setDeliveryLng(lng); setDeliveryAddress(addr); }}
                    initialLat={deliveryLat || undefined}
                    initialLng={deliveryLng || undefined}
                    initialAddress={deliveryAddress}
                  />

                  {distance > 0 && (
                    <div className="flex items-center justify-center gap-2 py-2 bg-blue-50 rounded-xl">
                      <Navigation className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-semibold text-blue-700">{distance.toFixed(1)} km estimados</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 3: Veículo + Mapa ── */}
            {step === 3 && !isAdditionalDelivery && (
              <div className="flex flex-col">
                {/* Map */}
                {pickupLat && pickupLng && deliveryLat && deliveryLng && (
                  <div className="h-56 w-full">
                    <DeliveryMap
                      pickupLat={pickupLat} pickupLng={pickupLng}
                      deliveryLat={deliveryLat} deliveryLng={deliveryLng}
                    />
                  </div>
                )}

                <div className="p-4 space-y-4">
                  {distance > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Rota calculada</span>
                      <span className="font-semibold text-gray-900">{distance.toFixed(1)} km</span>
                    </div>
                  )}

                  <h2 className="text-lg font-bold text-gray-900">Escolha o veículo ideal</h2>

                  <VehicleCategorySelector
                    onSelect={(_id, cat) => setSelectedCategory(cat)}
                    selectedCategoryId={selectedCategory?.id || null}
                    distance={distance}
                  />
                </div>
              </div>
            )}

            {/* ── STEP 4: Detalhes (produto + destinatário) ── */}
            {step === 4 && (
              <div className="p-4 space-y-5">
                {/* Vehicle summary bar */}
                {(selectedCategory || isAdditionalDelivery) && (
                  <div className="bg-white rounded-2xl shadow-sm p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                      {vehicleIcon(isAdditionalDelivery ? (parentDelivery?.vehicle_type || '') : (selectedCategory?.name || ''))}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {isAdditionalDelivery ? parentDelivery?.vehicle_type : selectedCategory?.name}
                      </p>
                      {estimatedPrice > 0 && (
                        <p className="text-xs text-gray-500">R$ {estimatedPrice.toFixed(2)} · ~{Math.round(distance / 40 * 60)} min</p>
                      )}
                    </div>
                    {!isAdditionalDelivery && (
                      <button onClick={() => setStep(3)} className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                        <Edit2 className="h-3.5 w-3.5" />Alterar
                      </button>
                    )}
                  </div>
                )}

                {/* Product type */}
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">O que será enviado?</h2>
                  <p className="text-sm text-gray-500 mb-4">Isso ajuda no cuidado com sua entrega</p>
                  <div className="grid grid-cols-2 gap-3">
                    {PRODUCT_TYPES.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setProductType(type.id)}
                        className={`relative flex flex-col items-center justify-center gap-2 py-5 rounded-2xl border-2 transition-all ${
                          productType === type.id
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-100 bg-white hover:border-gray-200'
                        }`}
                      >
                        <span className="text-3xl">{type.icon}</span>
                        <span className="text-sm font-medium text-gray-800">{type.label}</span>
                        {productType === type.id && (
                          <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recipient */}
                <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Nome do destinatário <span className="text-gray-400 font-normal">(opcional)</span></Label>
                    <Input
                      placeholder="João da Silva"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="h-12 rounded-xl border-gray-200 bg-gray-50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Telefone do destinatário <span className="text-gray-400 font-normal">(opcional)</span></Label>
                    <Input
                      placeholder="(37) 99999-9999"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      className="h-12 rounded-xl border-gray-200 bg-gray-50"
                    />
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={needsPickupHelp}
                      onChange={(e) => setNeedsPickupHelp(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">Precisa de ajuda na coleta?</span>
                  </label>
                </div>
              </div>
            )}

            {/* ── STEP 5: Confirmação ── */}
            {step === 5 && (
              <div className="flex flex-col">
                {/* Map preview */}
                {pickupLat && pickupLng && deliveryLat && deliveryLng && (
                  <div className="h-48 w-full">
                    <DeliveryMap
                      pickupLat={pickupLat} pickupLng={pickupLng}
                      deliveryLat={deliveryLat} deliveryLng={deliveryLng}
                    />
                  </div>
                )}

                <div className="p-4 space-y-4">
                  {/* Route */}
                  <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 mb-0.5">Coleta</p>
                        <p className="text-sm font-medium text-gray-900 leading-snug">{formatAddress(pickupAddress)}</p>
                      </div>
                    </div>
                    <div className="ml-1.5 border-l-2 border-dashed border-gray-200 h-4" />
                    <div className="flex items-start gap-3">
                      <div className="mt-1 w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 mb-0.5">Entrega</p>
                        <p className="text-sm font-medium text-gray-900 leading-snug">{formatAddress(deliveryAddress)}</p>
                        {recipientName && <p className="text-xs text-gray-500 mt-0.5">Para: {recipientName}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="bg-white rounded-2xl shadow-sm p-4">
                    {[
                      { label: 'Veículo', value: isAdditionalDelivery ? parentDelivery?.vehicle_type : selectedCategory?.name },
                      { label: 'Tipo de envio', value: PRODUCT_TYPES.find(p => p.id === productType)?.label },
                      { label: 'Distância', value: `${distance.toFixed(1)} km` },
                      { label: 'Tempo estimado', value: `~${Math.round(distance / 40 * 60)} min` },
                      { label: 'Pagamento', value: 'Carteira Levei.ai' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                        <span className="text-sm text-gray-500">{label}</span>
                        <span className="text-sm font-semibold text-gray-900">{value}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-3 mt-1">
                      <span className="text-base font-semibold text-gray-900">Total</span>
                      <span className="text-xl font-bold text-blue-600">R$ {estimatedPrice.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Saldo insuficiente */}
                  {restaurant && restaurant.wallet_balance < estimatedPrice && (
                    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
                      <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-700">Saldo insuficiente</p>
                        <p className="text-xs text-red-600 mt-0.5">
                          Adicione R$ {(estimatedPrice - restaurant.wallet_balance).toFixed(2)} à sua carteira
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>

          {/* ── FOOTER BUTTON ── */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-lg">
            {step < totalSteps ? (
              <Button
                className="w-full h-13 rounded-2xl text-base font-semibold bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-2"
                style={{ height: 52 }}
                onClick={handleNext}
                disabled={!canProceed()}
              >
                Continuar
                <ChevronRight className="h-5 w-5" />
              </Button>
            ) : (
              <Button
                className="w-full rounded-2xl text-base font-semibold bg-blue-600 hover:bg-blue-700 flex items-center justify-center gap-2"
                style={{ height: 52 }}
                onClick={handleSubmit}
                disabled={submitting || !!(restaurant && restaurant.wallet_balance < estimatedPrice)}
              >
                {submitting ? (
                  <><Loader2 className="h-5 w-5 animate-spin" />Criando...</>
                ) : (
                  <><Package className="h-5 w-5" />Solicitar entrega · R$ {estimatedPrice.toFixed(2)}</>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
