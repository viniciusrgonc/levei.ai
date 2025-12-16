import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, MapPin, User, Phone, Navigation, Clock, CheckCircle2, Package, Loader2, Star, X, XCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useRealtimeDriverLocation } from '@/hooks/useRealtimeDriverLocation';
import DeliveryMap from '@/components/DeliveryMap';
import { SidebarProvider } from '@/components/ui/sidebar';
import { RestaurantSidebar } from '@/components/RestaurantSidebar';
import { getGoogleMapsLink } from '@/lib/utils';
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

const statusConfig: Record<string, { step: number; label: string; description: string; icon: string; color: string }> = {
  pending: { step: 1, label: 'Aguardando entregador', description: 'Procurando entregador disponível...', icon: '🕐', color: 'text-amber-600' },
  accepted: { step: 2, label: 'Coleta em andamento', description: 'Entregador a caminho da coleta', icon: '🚗', color: 'text-blue-600' },
  picked_up: { step: 3, label: 'Em rota de entrega', description: 'Seu pacote está a caminho', icon: '📦', color: 'text-purple-600' },
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

    return () => {
      supabase.removeChannel(channel);
    };
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
      // Check if already rated
      checkIfRated(data.id);
    }
    setLoading(false);
  };

  const checkIfRated = async (deliveryId: string) => {
    if (!user) return;
    
    const { data } = await supabase
      .from('ratings')
      .select('id')
      .eq('delivery_id', deliveryId)
      .eq('rated_by', user.id)
      .maybeSingle();
    
    setHasRated(!!data);
  };

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
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <RestaurantSidebar />
          <div className="flex-1 p-4 space-y-4">
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
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <RestaurantSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header - Mobile optimized */}
          <header className="sticky top-0 z-10 h-12 sm:h-14 border-b bg-background flex items-center px-3 sm:px-4 gap-2 sm:gap-3 safe-top">
            <Button 
              variant="ghost" 
              size="icon"
              className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0"
              onClick={() => navigate('/restaurant/dashboard')}
            >
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm sm:text-base font-semibold truncate">Acompanhar Entrega</h1>
              <p className="text-xs text-muted-foreground">#{delivery.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            {/* Map - Responsive height */}
            {isActive && (
              <div className="h-48 sm:h-64 md:h-80 relative">
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
                  <div className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-background/95 backdrop-blur rounded-lg px-2 py-1.5 sm:px-3 sm:py-2 text-xs shadow-lg">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 animate-pulse" />
                      <span className="font-medium text-xs">Entregador em movimento</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 pb-20 safe-bottom">
              {/* Status Card - Compact on mobile */}
              <Card className="border-2">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="text-2xl sm:text-4xl">{status.icon}</div>
                    <div className="flex-1 min-w-0">
                      <h2 className={`text-base sm:text-xl font-bold ${status.color} truncate`}>
                        {status.label}
                      </h2>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{status.description}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg sm:text-2xl font-bold text-primary">
                        R$ {(delivery.price_adjusted || delivery.price).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Progress Steps - Smaller on mobile */}
                  <div className="flex items-center gap-1 sm:gap-2 mt-4 sm:mt-6">
                    {[1, 2, 3, 4].map((stepNum) => (
                      <div key={stepNum} className="flex-1 flex items-center gap-1 sm:gap-2">
                        <div
                          className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-colors ${
                            stepNum <= status.step
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {stepNum < status.step ? (
                            <CheckCircle2 className="h-3 w-3 sm:h-5 sm:w-5" />
                          ) : (
                            stepNum
                          )}
                        </div>
                        {stepNum < 4 && (
                          <div
                            className={`flex-1 h-0.5 sm:h-1 rounded-full ${
                              stepNum < status.step ? 'bg-primary' : 'bg-muted'
                            }`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-muted-foreground">
                    <span>Criado</span>
                    <span>Aceito</span>
                    <span>Coletado</span>
                    <span>Entregue</span>
                  </div>
                </CardContent>
              </Card>

              {/* Driver Card - Compact on mobile */}
              {driver ? (
                <Card>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User className="h-5 w-5 sm:h-7 sm:w-7 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-base sm:text-lg truncate">{driver.profiles.full_name}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground capitalize truncate">
                          {driver.vehicle_type} • {driver.license_plate}
                        </p>
                      </div>
                      {driver.profiles.phone && (
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={handleCall}
                          className="h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0"
                        >
                          <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : delivery.status === 'pending' ? (
                <Card className="border-dashed">
                  <CardContent className="p-4 sm:p-6 text-center">
                    <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin mx-auto text-muted-foreground mb-2 sm:mb-3" />
                    <p className="font-medium text-sm sm:text-base">Procurando entregador...</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Aguarde enquanto buscamos um entregador disponível
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 sm:mt-4 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                      onClick={() => setShowCancelModal(true)}
                    >
                      <X className="h-4 w-4 mr-1.5" />
                      Cancelar entrega
                    </Button>
                  </CardContent>
                </Card>
              ) : delivery.status === 'cancelled' ? (
                <Card className="bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900">
                  <CardContent className="p-4 sm:p-6 text-center">
                    <XCircle className="h-10 w-10 sm:h-12 sm:w-12 text-red-600 mx-auto mb-2 sm:mb-3" />
                    <h3 className="text-base sm:text-lg font-bold text-red-800 dark:text-red-400">Entrega Cancelada</h3>
                    <p className="text-xs sm:text-sm text-red-700 dark:text-red-500 mt-1">
                      Esta entrega foi cancelada e não está mais disponível.
                    </p>
                  </CardContent>
                </Card>
              ) : null}

              {/* Addresses - Compact on mobile */}
              <Card>
                <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                  <div 
                    className="flex items-start gap-2 sm:gap-3 cursor-pointer hover:bg-muted/50 p-1.5 sm:p-2 rounded-lg transition-colors -m-1.5 sm:-m-2"
                    onClick={() => openInMaps(delivery.pickup_latitude, delivery.pickup_longitude)}
                  >
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Coleta</p>
                      <p className="text-xs sm:text-sm font-medium line-clamp-2">{delivery.pickup_address}</p>
                    </div>
                    <Navigation className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                  </div>

                  <div className="border-l-2 border-dashed border-muted ml-4 sm:ml-5 h-3 sm:h-4" />

                  <div 
                    className="flex items-start gap-2 sm:gap-3 cursor-pointer hover:bg-muted/50 p-1.5 sm:p-2 rounded-lg transition-colors -m-1.5 sm:-m-2"
                    onClick={() => openInMaps(delivery.delivery_latitude, delivery.delivery_longitude)}
                  >
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <Navigation className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">Entrega</p>
                      <p className="text-xs sm:text-sm font-medium line-clamp-2">{delivery.delivery_address}</p>
                      {delivery.recipient_name && (
                        <p className="text-xs text-muted-foreground">Para: {delivery.recipient_name}</p>
                      )}
                    </div>
                    <Navigation className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>

              {/* Info - Compact on mobile */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <Card>
                  <CardContent className="p-3 sm:p-4 text-center">
                    <Clock className="h-4 w-4 sm:h-5 sm:w-5 mx-auto text-muted-foreground mb-0.5 sm:mb-1" />
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Criado em</p>
                    <p className="font-medium text-xs sm:text-sm">
                      {new Date(delivery.created_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 sm:p-4 text-center">
                    <Package className="h-4 w-4 sm:h-5 sm:w-5 mx-auto text-muted-foreground mb-0.5 sm:mb-1" />
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Distância</p>
                    <p className="font-medium text-xs sm:text-sm">{delivery.distance_km.toFixed(1)} km</p>
                  </CardContent>
                </Card>
              </div>

              {/* Success Message - Compact on mobile */}
              {delivery.status === 'delivered' && (
                <Card className="bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900">
                  <CardContent className="p-4 sm:p-6 text-center">
                    <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12 text-green-600 mx-auto mb-2 sm:mb-3" />
                    <h3 className="text-base sm:text-lg font-bold text-green-800 dark:text-green-400">Entrega Concluída!</h3>
                    <p className="text-xs sm:text-sm text-green-700 dark:text-green-500 mt-1">
                      Entregue em {delivery.delivered_at && new Date(delivery.delivered_at).toLocaleString('pt-BR')}
                    </p>
                    
                    {/* Rating Button */}
                    {driver && !hasRated && (
                      <Button
                        size="sm"
                        className="mt-3 sm:mt-4 gap-2"
                        onClick={() => setShowRatingModal(true)}
                      >
                        <Star className="h-4 w-4" />
                        Avaliar Entregador
                      </Button>
                    )}
                    
                    {hasRated && (
                      <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-green-600 flex items-center justify-center gap-1.5 sm:gap-2">
                        <Star className="h-4 w-4 fill-current" />
                        Você já avaliou esta entrega
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Rating Modal */}
      {showRatingModal && driver && (
        <RatingModal
          deliveryId={delivery.id}
          driverUserId={driver.user_id}
          driverName={driver.profiles.full_name}
          onClose={() => setShowRatingModal(false)}
          onSubmitted={() => {
            setShowRatingModal(false);
            setHasRated(true);
          }}
        />
      )}

      {/* Cancel Modal */}
      <CancelDeliveryModal
        deliveryId={delivery.id}
        open={showCancelModal}
        onOpenChange={setShowCancelModal}
        onCancelled={() => {
          setShowCancelModal(false);
          fetchDelivery();
        }}
      />
    </SidebarProvider>
  );
}
