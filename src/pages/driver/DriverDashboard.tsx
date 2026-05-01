import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import {
  MapPin, Package, Navigation, Star,
  TrendingUp, ChevronRight, Clock,
} from 'lucide-react';
import { useNearbyDeliveries } from '@/hooks/useNearbyDeliveries';
import NotificationBell from '@/components/NotificationBell';
import { useRealtimeDeliveries } from '@/hooks/useRealtimeDeliveries';
import { useAcceptDelivery } from '@/hooks/useAcceptDelivery';
import { DriverBottomNav } from '@/components/DriverBottomNav';
import leveiLogo from '@/assets/levei-logo.png';

// ── Query functions ────────────────────────────────────────────────────────
async function fetchDriver(userId: string) {
  const { data, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error?.code === 'PGRST116') throw new Error('SETUP_REQUIRED');
  if (error) throw error;
  return data;
}

async function fetchActiveDelivery(userId: string) {
  const { data: driverData } = await supabase
    .from('drivers')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (!driverData) return null;

  const { data } = await supabase
    .from('deliveries')
    .select('*')
    .eq('driver_id', driverData.id)
    .in('status', ['accepted', 'picking_up', 'picked_up', 'delivering', 'returning'])
    .order('delivery_sequence', { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

async function fetchTodayEarnings(userId: string) {
  const { data: driverData } = await supabase
    .from('drivers')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (!driverData) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('transactions')
    .select('driver_earnings')
    .eq('driver_id', driverData.id)
    .gte('created_at', today.toISOString());
  return (data ?? []).reduce((sum, t) => sum + (Number(t.driver_earnings) || 0), 0);
}

// ── Component ──────────────────────────────────────────────────────────────
export default function DriverDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { acceptDelivery, loading: accepting, acceptingId } = useAcceptDelivery({
    onSuccess: (deliveryId) => navigate(`/driver/pickup/${deliveryId}`, { replace: true }),
  });

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: driver, isLoading: driverLoading, error: driverError } = useQuery({
    queryKey: ['driver', user?.id],
    queryFn: () => fetchDriver(user!.id),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
    retry: (count, err: any) => err?.message !== 'SETUP_REQUIRED' && count < 2,
  });

  const { data: activeDelivery } = useQuery({
    queryKey: ['active-delivery', user?.id],
    queryFn: () => fetchActiveDelivery(user!.id),
    enabled: !!user?.id,
    staleTime: 10 * 1000,       // active delivery changes fast — 10s
    refetchInterval: 15 * 1000, // poll every 15s as backup
  });

  const { data: todayEarnings = 0 } = useQuery({
    queryKey: ['today-earnings', user?.id],
    queryFn: () => fetchTodayEarnings(user!.id),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  const { deliveries: availableDeliveries, loading: deliveriesLoading, radiusKm } =
    useNearbyDeliveries({
      driverId: driver?.id || '',
      isAvailable: driver?.is_available || false,
    });

  // ── Realtime: invalidate React Query caches instead of manual refetch ────
  useRealtimeDeliveries({
    driverId: driver?.id,
    showNotifications: true,
    onUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ['active-delivery', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['today-earnings', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['driver', user?.id] });
    },
  });

  // ── Redirect if setup not done or active delivery found ──────────────────
  useEffect(() => {
    if (driverError?.message === 'SETUP_REQUIRED') {
      navigate('/driver/setup');
    }
  }, [driverError, navigate]);

  useEffect(() => {
    if (!activeDelivery) return;
    if (['accepted', 'picking_up'].includes(activeDelivery.status)) {
      navigate(`/driver/pickup/${activeDelivery.id}`, { replace: true });
    } else if (['picked_up', 'delivering'].includes(activeDelivery.status)) {
      navigate(`/driver/delivery/${activeDelivery.id}`, { replace: true });
    } else if (activeDelivery.status === 'returning') {
      navigate(`/driver/return/${activeDelivery.id}`, { replace: true });
    }
  }, [activeDelivery, navigate]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const toggleAvailability = async (available: boolean) => {
    if (!driver) return;
    const { error } = await supabase
      .from('drivers')
      .update({ is_available: available })
      .eq('id', driver.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao atualizar disponibilidade' });
    } else {
      // Optimistic update: update cache directly
      queryClient.setQueryData(['driver', user?.id], { ...driver, is_available: available });
      toast({
        title: available ? 'Você está disponível!' : 'Você está offline',
        description: available ? 'Entregas aparecerão aqui' : 'Você não receberá novas entregas',
      });
    }
  };

  const handleAccept = async (deliveryId: string) => {
    if (!driver?.id) return;
    await acceptDelivery(deliveryId, driver.id);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (driverLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-primary h-52" />
        <div className="px-4 space-y-3 mt-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const safeDeliveries = Array.isArray(availableDeliveries) ? availableDeliveries : [];
  const isOnline = driver?.is_available;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── HERO ── */}
      <div className={`transition-colors duration-500 ${isOnline ? 'bg-primary' : 'bg-gray-700'}`}>
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-4 pb-2"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
        >
          <img src={leveiLogo} alt="Levei" className="h-10 w-10 rounded-xl object-cover" />
          <div className="flex items-center gap-2">
            {driver?.rating && (
              <div className="flex items-center gap-1 bg-white/10 rounded-full px-2.5 py-1">
                <Star className="h-3.5 w-3.5 text-yellow-300 fill-yellow-300" />
                <span className="text-white text-xs font-medium">
                  {Number(driver.rating).toFixed(1)}
                </span>
              </div>
            )}
            <NotificationBell />
          </div>
        </div>

        {/* Status + toggle */}
        <div className="px-4 pt-2 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-white/70 text-sm">
                {isOnline ? `Raio de ${radiusKm} km` : 'Você está offline'}
              </p>
              <h1 className="text-2xl font-bold text-white mt-0.5">
                {isOnline ? 'Disponível' : 'Offline'}
              </h1>
            </div>
            <Switch
              checked={isOnline || false}
              onCheckedChange={toggleAvailability}
              className="scale-125 data-[state=checked]:bg-green-400"
            />
          </div>

          {/* Earnings today */}
          <div
            className="bg-white/10 border border-white/20 rounded-2xl px-4 py-3 cursor-pointer"
            onClick={() => navigate('/driver/wallet')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-white/70 text-xs">Ganhos hoje</p>
                  <p className="text-white font-bold text-lg leading-none">
                    R$ {todayEarnings.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-white/70 text-xs">Entregas</p>
                  <p className="text-white font-bold text-lg leading-none">
                    {driver?.total_deliveries || 0}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-white/50" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-3">

        {/* Offline state */}
        {!isOnline && (
          <div className="bg-white rounded-2xl shadow-sm border border-dashed border-gray-200 p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 mx-auto mb-3 flex items-center justify-center">
              <Package className="h-7 w-7 text-gray-400" />
            </div>
            <p className="font-semibold text-gray-700 mb-1">Você está offline</p>
            <p className="text-sm text-gray-400 mb-4">
              Ative o toggle acima para começar a receber entregas
            </p>
            <button
              onClick={() => toggleAvailability(true)}
              className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
            >
              Ficar online
            </button>
          </div>
        )}

        {/* Available deliveries */}
        {isOnline && (
          <>
            <div className="flex items-center justify-between px-1">
              <h2 className="font-semibold text-gray-900">Entregas disponíveis</h2>
              {safeDeliveries.length > 0 && (
                <Badge className="bg-blue-100 text-blue-700 border-none text-xs h-5 px-2">
                  {safeDeliveries.length}
                </Badge>
              )}
            </div>

            {deliveriesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-36 rounded-2xl" />
                <Skeleton className="h-36 rounded-2xl" />
              </div>
            ) : safeDeliveries.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-dashed border-gray-200 p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 mx-auto mb-3 flex items-center justify-center">
                  <Package className="h-6 w-6 text-gray-400" />
                </div>
                <p className="font-semibold text-gray-700 text-sm mb-1">
                  Nenhuma entrega disponível
                </p>
                <p className="text-xs text-gray-400">
                  Aguarde, novas entregas aparecerão automaticamente em um raio de {radiusKm} km
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {safeDeliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className="bg-white rounded-2xl shadow-sm overflow-hidden"
                  >
                    {/* Price + distance header */}
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
                        onClick={() => handleAccept(delivery.id)}
                        disabled={accepting}
                        className="w-full h-11 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-60 transition-opacity"
                      >
                        {acceptingId === delivery.id ? 'Aceitando...' : 'Aceitar entrega'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <DriverBottomNav />
    </div>
  );
}
