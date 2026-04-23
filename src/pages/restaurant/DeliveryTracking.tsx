import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, MapPin, User, Phone, Navigation, Clock, CheckCircle2, Package, Loader2, Star, X, XCircle, LayoutDashboard, Camera } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useRealtimeDriverLocation } from '@/hooks/useRealtimeDriverLocation';
import DeliveryMap from '@/components/DeliveryMap';
import { SidebarProvider } from '@/components/ui/sidebar';
import { RestaurantSidebar } from '@/components/RestaurantSidebar';
import { getGoogleMapsLink, formatAddress } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { RatingModal } from '@/components/RatingModal';
import { CancelDeliveryModal } from '@/components/CancelDeliveryModal';

type Delivery = {
  id: string;
  pickup_address: string;
  delivery_address: string;
  pickup_latitude: number;
  pickup_longitude: number;
  delivery_latitude: number;
  delivery_longitude: number;
  recipient_name: string | null;
  recipient_phone: string | null;
  distance_km: number;
  price: number;
  price_adjusted: number;
  status: string;
  created_at: string;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  driver_id: string | null;
};

type Driver = {
  id: string;
  user_id: string;
  vehicle_type: string;
  license_plate: string;
  rating: number;
  profiles: {
    full_name: string;
    phone: string | null;
  };
};

type DeliveryConfirmation = {
  photo_url: string;
  latitude: number;
  longitude: number;
  distance_meters: number | null;
  is_within_radius: boolean | null;
  confirmed_at: string;
};

const statusConfig: Record<string, { step: number; label: string; description: string; icon: string; color: string }> = {
  pending: { step: 1, label: 'Aguardando entregador', description: 'Procurando entregador disponível...', icon: '🕐', color: 'text-amber-600' },
  accepted: { step: 2, label: 'Coleta em andamento', description: 'Entregador a caminho da coleta', icon: '🚗', color: 'text-blue-600' },
  picking_up: { step: 2, label: 'Coleta em andamento', description: 'Entregador a caminho da coleta', icon: '🚗', color: 'text-blue-600' },
  picked_up: { step: 3, label: 'Em rota de entrega', description: 'Seu pacote está a caminho', icon: '📦', color: 'text-purple-600' },
  delivering: { step: 3, label: 'Em rota de entrega', description: 'Seu pacote está a caminho', icon: '📦', color: 'text-purple-600' },
  delivered: { step: 4, label: 'Entregue', description: 'Entrega finalizada com sucesso!', icon: '✅', color: 'text-green-600' },
  cancelled: { step: 0, label: 'Cancelada', description: 'Esta entrega foi cancelada', icon: '❌', color: 'text-red-600' },
};

export default function DeliveryTracking() {
  const { deliveryId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [autoRatingChecked, setAutoRatingChecked] = useState(false);
  const [confirmation, setConfirmation] = useState<DeliveryConfirmation | null>(null);
  const [confirmationPhotoUrl, setConfirmationPhotoUrl] = useState<string | null>(null);

  const { currentLocation, locationHistory } = useRealtimeDriverLocation(deliveryId || '');

  useEffect(() => {
    if (!deliveryId) return;
    fetchDelivery();
    const channel = supabase
      .channel(`delivery-tracking-${deliveryId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'deliveries',
        filter: `id=eq.${deliveryId}`
      }, (payload) => {
        setDelivery(payload.new as Delivery);
        if (payload.new.driver_id && !driver) {
          fetchDriver(payload.new.driver_id);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [deliveryId]);

  const fetchDelivery = async () => {
    if (!deliveryId) return;
    const { data, error } = await supabase
      .from('deliveries')
      .select('*')
      .eq('id', deliveryId)
      .single();
    if (error || !data) {
      toast({ variant: 'destructive', title: 'Entrega não encontrada' });
      navigate('/restaurant/dashboard');
      return;
    }
    setDelivery(data);
    if (data.driver_id) {
      fetchDriver(data.driver_id);
      checkIfRated(data.id);
    }
    if (data.status === 'delivered') fetchConfirmation(data.id);
    setLoading(false);
  };

  const fetchConfirmation = async (id: string) => {
    const { data } = await (supabase as any)
      .from('delivery_confirmations')
      .select('photo_url, latitude, longitude, distance_meters, is_within_radius, confirmed_at')
      .eq('delivery_id', id)
      .maybeSingle();

    if (!data) return;
    setConfirmation(data);

    const { data: signed } = await supabase.storage
      .from('delivery-photos')
      .createSignedUrl(data.photo_url, 60 * 10);
    setConfirmationPhotoUrl(signed?.signedUrl ?? null);
  };

  const checkIfRated = async (deliveryId: string) => {
    if (!user) return false;
    const { data } = await supabase
      .from('ratings')
      .select('id')
      .eq('delivery_id', deliveryId)
      .eq('rated_by', user.id)
      .maybeSingle();
    setHasRated(!!data);
    return !!data;
  };

  useEffect(() => {
    if (delivery?.status === 'delivered' && driver && !hasRated && !autoRatingChecked) {
      setAutoRatingChecked(true);
      checkIfRated(delivery.id).then((alreadyRated) => {
        if (!alreadyRated) {
          setTimeout(() => { setShowRatingModal(true); }, 1500);
        }
      });
    }
  }, [delivery?.status, driver, hasRated, autoRatingChecked]);

  const fetchDriver = async (driverId: string) => {
    const { data } = await supabase
      .from('drivers')
      .select(`*, profiles!drivers_user_id_fkey (full_name, phone)`)
      .eq('id', driverId)
      .single();
    if (data) setDriver(data as any);
  };

  const handleCall = () => {
    if (driver?.profiles.phone) {
      window.open(`tel:${driver.profiles.phone}`, '_self');
    }
  };

  const openInMaps = (lat: number, lng: number) => {
    const url = getGoogleMapsLink(undefined, [lat, lng]);
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <SidebarProvider defaultOpen={false}>
        <div className="min-h-screen flex w-full overflow-hidden">
          <RestaurantSidebar />
          <div className="flex-1 p-4 space-y-4 min-w-0">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </SidebarProvider>
    );
  }

  if (!delivery) return null;

  const status = statusConfig[delivery.status] || statusConfig.pending;
  const isActive = ['accepted', 'picked_up'].includes(delivery.status);

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full overflow-hidden bg-background">
        <RestaurantSidebar />
        <div className="flex-1 flex flex-col min-w-0">

          <header className="sticky top-0 z-10 h-12 border-b bg-background flex items-center px-3 gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 flex-shrink-0"
              onClick={() => navigate('/restaurant/dashboard')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-semibold truncate">Acompanhar Entrega</h1>
              <p className="text-xs text-muted-foreground">#{delivery.id.slice(0, 8).toUpperCase()}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-muted-foreground"
              onClick={() => navigate('/restaurant/dashboard')}
            >
              <LayoutDashboard className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Dashboard</span>
            </Button>
            {['pending', 'accepted', 'picking_up', 'picked_up'].includes(delivery.status) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowCancelModal(true)}
              >
                <X className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Cancelar</span>
              </Button>
            )}
          </header>

          <main className="flex-1 overflow-auto">
            {isActive && (
              <div className="h-48 sm:h-64 relative">
                <DeliveryMap
                  pickupLat={delivery.pickup_latitude}
                  pickupLng={delivery.pickup_longitude}
                  deliveryLat={delivery.delivery_latitude}
                  deliveryLng={delivery.delivery_longitude}
                  driverLat={currentLocation?.latitude}
                  driverLng={currentLocation?.longitude}
                  locationHistory={locationHistory}
                />
                {currentLocation && (
                  <div className="absolute top-2 right-2 bg-background/95 backdrop-blur rounded-lg px-2 py-1.5 text-xs shadow-lg">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      <span className="font-medium">Entregador em movimento</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="p-3 space-y-3 pb-20">

              <Card className="border-2">
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{status.icon}</div>
                    <div className="flex-1 min-w-0">
                      <h2 className={`text-base font-bold ${status.color} truncate`}>{status.label}</h2>
                      <p className="text-xs text-muted-foreground truncate">{status.description}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-primary">
                        R$ {(delivery.price_adjusted || delivery.price).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 mt-4">
                    {[1, 2, 3, 4].map((stepNum) => (
                      <div key={stepNum} className="flex-1 flex items-center gap-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                          stepNum <= status.step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}>
                          {stepNum < status.step ? <CheckCircle2 className="h-3 w-3" /> : stepNum}
                        </div>
                        {stepNum < 4 && (
                          <div className={`flex-1 h-0.5 rounded-full ${stepNum < status.step ? 'bg-primary' : 'bg-muted'}`} />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                    <span>Criado</span>
                    <span>Aceito</span>
                    <span>Coletado</span>
                    <span>Entregue</span>
                  </div>
                </CardContent>
              </Card>

              {driver ? (
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{driver.profiles.full_name}</p>
                        <p className="text-xs text-muted-foreground capitalize truncate">
                          {driver.vehicle_type} • {driver.license_plate}
                        </p>
                      </div>
                      {driver.profiles.phone && (
                        <Button size="icon" variant="outline" onClick={handleCall} className="h-9 w-9 flex-shrink-0">
                          <Phone className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : delivery.status === 'pending' ? (
                <Card className="border-dashed">
                  <CardContent className="p-6 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground mb-2" />
                    <p className="font-medium text-sm">Procurando entregador...</p>
                    <p className="text-xs text-muted-foreground">Aguarde enquanto buscamos um entregador disponível</p>
                  </CardContent>
                </Card>
              ) : delivery.status === 'cancelled' ? (
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="p-6 text-center">
                    <XCircle className="h-10 w-10 text-red-600 mx-auto mb-2" />
                    <h3 className="text-base font-bold text-red-800">Entrega Cancelada</h3>
                    <p className="text-xs text-red-700 mt-1">Esta entrega foi cancelada e não está mais disponível.</p>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardContent className="p-3 space-y-3">
                  <div
                    className="flex items-start gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                    onClick={() => openInMaps(delivery.pickup_latitude, delivery.pickup_longitude)}
                  >
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Coleta</p>
                      <p className="text-xs sm:text-sm font-medium line-clamp-2">{formatAddress(delivery.pickup_address)}</p>
                    </div>
                    <Navigation className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>

                  <div className="border-l-2 border-dashed border-muted ml-4 h-3" />

                  <div
                    className="flex items-start gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                    onClick={() => openInMaps(delivery.delivery_latitude, delivery.delivery_longitude)}
                  >
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <Navigation className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Entrega</p>
                      <p className="text-xs sm:text-sm font-medium line-clamp-2">{formatAddress(delivery.delivery_address)}</p>
                      {delivery.recipient_name && (
                        <p className="text-xs text-muted-foreground">Para: {delivery.recipient_name}</p>
                      )}
                    </div>
                    <Navigation className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-2">
                <Card>
                  <CardContent className="p-3 text-center">
                    <Clock className="h-4 w-4 mx-auto text-muted-foreground mb-0.5" />
                    <p className="text-[10px] text-muted-foreground">Criado em</p>
                    <p className="font-medium text-xs">
                      {new Date(delivery.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <Package className="h-4 w-4 mx-auto text-muted-foreground mb-0.5" />
                    <p className="text-[10px] text-muted-foreground">Distância</p>
                    <p className="font-medium text-xs">{delivery.distance_km.toFixed(1)} km</p>
                  </CardContent>
                </Card>
              </div>

              {delivery.status === 'delivered' && (
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4 text-center">
                    <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-2" />
                    <h3 className="text-base font-bold text-green-800">Entrega Concluída!</h3>
                    <p className="text-xs text-green-700 mt-1">
                      Entregue em {delivery.delivered_at && new Date(delivery.delivered_at).toLocaleString('pt-BR')}
                    </p>
                    {driver && !hasRated && (
                      <Button size="sm" className="mt-3 gap-2" onClick={() => setShowRatingModal(true)}>
                        <Star className="h-4 w-4" />
                        Avaliar Entregador
                      </Button>
                    )}
                    {hasRated && (
                      <p className="mt-3 text-xs text-green-600 flex items-center justify-center gap-1.5">
                        <Star className="h-4 w-4 fill-current" />
                        Você já avaliou esta entrega
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {delivery.status === 'delivered' && confirmation && (
                <Card>
                  <CardContent className="p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Camera className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Comprovante de entrega</h3>
                    </div>
                    {confirmationPhotoUrl && (
                      <img
                        src={confirmationPhotoUrl}
                        alt="Foto de confirmação da entrega"
                        className="w-full max-h-72 rounded-lg object-cover border"
                        loading="lazy"
                      />
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div className="rounded-lg bg-muted p-2">
                        <p className="text-muted-foreground">Horário</p>
                        <p className="font-medium">{new Date(confirmation.confirmed_at).toLocaleString('pt-BR')}</p>
                      </div>
                      <div className="rounded-lg bg-muted p-2">
                        <p className="text-muted-foreground">Localização</p>
                        <p className="font-medium">{Number(confirmation.latitude).toFixed(5)}, {Number(confirmation.longitude).toFixed(5)}</p>
                      </div>
                      <div className="rounded-lg bg-muted p-2">
                        <p className="text-muted-foreground">Distância do destino</p>
                        <p className="font-medium">{Math.round(Number(confirmation.distance_meters || 0))} m</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </main>
        </div>
      </div>

      {showRatingModal && driver && (
        <RatingModal
          deliveryId={delivery.id}
          driverUserId={driver.user_id}
          driverName={driver.profiles.full_name}
          onClose={() => setShowRatingModal(false)}
          onSubmitted={() => { setShowRatingModal(false); setHasRated(true); }}
        />
      )}

      <CancelDeliveryModal
        deliveryId={delivery.id}
        open={showCancelModal}
        onOpenChange={setShowCancelModal}
        onCancelled={() => { setShowCancelModal(false); fetchDelivery(); }}
      />
    </SidebarProvider>
  );
}
