import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Package, MapPin, Navigation, Clock, ArrowLeft, Settings } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useNearbyDeliveries } from '@/hooks/useNearbyDeliveries';
import { useAcceptDelivery } from '@/hooks/useAcceptDelivery';
import { DriverBottomNav } from '@/components/DriverBottomNav';
import leveiLogo from '@/assets/levei-logo.png';
import NotificationBell from '@/components/NotificationBell';
import { getProductTypeIcon, getProductTypeLabel } from '@/lib/productTypes';
import { toast } from '@/hooks/use-toast';

interface Driver {
  id: string;
  is_available: boolean;
  accepted_product_types: string[];
}

export default function AvailableDeliveries() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  const { acceptDelivery, loading: accepting, acceptingId } = useAcceptDelivery({
    onSuccess: (deliveryId) => navigate(`/driver/pickup/${deliveryId}`, { replace: true }),
  });

  const { deliveries: availableDeliveries, loading: deliveriesLoading, radiusKm } =
    useNearbyDeliveries({ driverId: driver?.id || '', isAvailable: driver?.is_available || false });

  const safeDeliveries = Array.isArray(availableDeliveries) ? availableDeliveries : [];

  useEffect(() => { if (user) fetchDriver(); }, [user]);

  const fetchDriver = async () => {
    const { data, error } = await supabase
      .from('drivers')
      .select('id, is_available, accepted_product_types')
      .eq('user_id', user?.id)
      .single();
    if (!error && data) setDriver({
      ...data,
      accepted_product_types: (data.accepted_product_types as string[]) || [],
    });
    setLoading(false);
  };

  const handleAccept = async (deliveryId: string, productType?: string | null) => {
    if (!driver?.id) return;

    // Validação client-side: verifica compatibilidade antes de chamar edge function
    if (productType && driver.accepted_product_types.length > 0) {
      if (!driver.accepted_product_types.includes(productType)) {
        toast({
          title: 'Tipo de produto incompatível',
          description: `Você não aceita "${productType}". Configure suas categorias em Configurações.`,
          variant: 'destructive',
        });
        return;
      }
    }

    await acceptDelivery(deliveryId, driver.id);
  };

  const hasNoCategories = driver && driver.accepted_product_types.length === 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-primary h-44" />
        <div className="px-4 space-y-3 mt-4">
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── HERO ── */}
      <div className="bg-primary">
        <div
          className="flex items-center justify-between px-4 pb-2"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/driver/dashboard')}
              className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
            <img src={leveiLogo} alt="Levei" className="h-8 w-8 rounded-lg object-cover" />
          </div>
          <NotificationBell />
        </div>

        <div className="px-4 pt-2 pb-5">
          <h1 className="text-2xl font-bold text-white">Entregas disponíveis</h1>
          {driver?.is_available && (
            <p className="text-white/70 text-sm mt-1">
              {safeDeliveries.length > 0
                ? `${safeDeliveries.length} ${safeDeliveries.length === 1 ? 'entrega compatível' : 'entregas compatíveis'} · raio ${radiusKm} km`
                : `Raio de ${radiusKm} km`}
            </p>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-3">

        {/* Alerta: sem categorias configuradas */}
        {hasNoCategories && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Package className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Configure suas categorias</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Você ainda não selecionou quais tipos de entrega aceita. Sem isso, nenhuma entrega aparecerá.
              </p>
              <button
                onClick={() => navigate('/driver/settings')}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 underline underline-offset-2"
              >
                <Settings className="h-3.5 w-3.5" />
                Configurar agora
              </button>
            </div>
          </div>
        )}

        {!driver?.is_available ? (
          <div className="bg-white rounded-2xl shadow-sm border border-dashed border-gray-200 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 mx-auto mb-3 flex items-center justify-center">
              <Package className="h-6 w-6 text-gray-400" />
            </div>
            <p className="font-semibold text-gray-700 mb-1">Você está offline</p>
            <p className="text-sm text-gray-400 mb-4">Ative sua disponibilidade para ver entregas</p>
            <button
              onClick={() => navigate('/driver/dashboard')}
              className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
            >
              Ir para o início
            </button>
          </div>
        ) : deliveriesLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        ) : safeDeliveries.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-dashed border-gray-200 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 mx-auto mb-3 flex items-center justify-center">
              <Package className="h-6 w-6 text-gray-400" />
            </div>
            <p className="font-semibold text-gray-700 text-sm mb-1">Nenhuma entrega disponível</p>
            <p className="text-xs text-gray-400">
              {hasNoCategories
                ? 'Configure suas categorias nas configurações para ver entregas.'
                : `Aguarde, novas entregas compatíveis aparecerão automaticamente em um raio de ${radiusKm} km`}
            </p>
          </div>
        ) : (
          safeDeliveries.map((delivery) => (
            <div key={delivery.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">

              {/* Tipo de produto — faixa colorida no topo */}
              {delivery.product_type && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border-b border-blue-100">
                  <span className="text-base">{getProductTypeIcon(delivery.product_type)}</span>
                  <span className="text-xs font-semibold text-blue-700">
                    {getProductTypeLabel(delivery.product_type)}
                  </span>
                </div>
              )}

              {/* Price + badges */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-gray-100 rounded-full px-2.5 py-1">
                    <Navigation className="h-3 w-3 text-gray-500" />
                    <span className="text-xs text-gray-600 font-medium">
                      {Number(delivery.distance_km).toFixed(1)} km
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-gray-100 rounded-full px-2.5 py-1">
                    <Clock className="h-3 w-3 text-gray-500" />
                    <span className="text-xs text-gray-600 font-medium">
                      ~{Math.ceil(Number(delivery.distance_km) * 3)} min
                    </span>
                  </div>
                </div>
                <span className="text-lg font-bold text-blue-600">
                  R$ {Number(delivery.price_adjusted || delivery.price).toFixed(2)}
                </span>
              </div>

              {/* Addresses */}
              <div className="px-4 py-3 space-y-2.5">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Package className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Coleta</p>
                    <p className="text-sm text-gray-800 truncate">{delivery.pickup_address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="h-4 w-4 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Entrega</p>
                    <p className="text-sm text-gray-800 truncate">{delivery.delivery_address}</p>
                  </div>
                </div>
              </div>

              {/* Accept button */}
              <div className="px-4 pb-4">
                <button
                  onClick={() => handleAccept(delivery.id, delivery.product_type)}
                  disabled={accepting}
                  className="w-full h-11 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-60 transition-opacity"
                >
                  {acceptingId === delivery.id ? 'Aceitando...' : 'Aceitar entrega'}
                </button>
              </div>
            </div>
          ))
        )}
      </main>

      <DriverBottomNav />
    </div>
  );
}
