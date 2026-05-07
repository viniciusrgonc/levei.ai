import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MapPin, Package, Clock, Calendar, Eye, Search, Star, Loader2, ArrowLeft, ChevronRight, PackageX } from 'lucide-react';
import { getStatusConfig } from '@/lib/deliveryStatus';
import { toast } from '@/hooks/use-toast';
import { RatingModal } from '@/components/RatingModal';
import { BottomNav } from '@/components/BottomNav';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: 'all',       label: 'Todos' },
  { value: 'pending',   label: 'Pendente' },
  { value: 'accepted',  label: 'A buscar' },
  { value: 'picked_up', label: 'Em rota' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'cancelled', label: 'Cancelada' },
];

type Delivery = {
  id: string;
  pickup_address: string;
  delivery_address: string;
  status: string;
  price: number;
  distance_km: number;
  created_at: string;
  delivered_at: string | null;
  description: string | null;
  driver_id: string | null;
};

type RatingTarget = {
  deliveryId: string;
  targetUserId: string;
  targetName: string;
};

export default function RestaurantHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [stats, setStats] = useState({ total: 0, delivered: 0, totalSpent: 0 });

  const [ratingTarget, setRatingTarget] = useState<RatingTarget | null>(null);
  const [ratedDeliveryIds, setRatedDeliveryIds] = useState<Set<string>>(new Set());

  // ── bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase
      .from('restaurants')
      .select('id')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (!data) { navigate('/restaurant/setup'); return; }
        setRestaurantId(data.id);
      });
  }, [user]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!restaurantId) return;
    supabase
      .from('deliveries')
      .select('status, price')
      .eq('restaurant_id', restaurantId)
      .then(({ data }) => {
        if (!data) return;
        const delivered = data.filter((d) => d.status === 'delivered');
        setStats({
          total: data.length,
          delivered: delivered.length,
          totalSpent: delivered.reduce((s, d) => s + Number(d.price), 0),
        });
      });
  }, [restaurantId]);

  // ── fetch page ────────────────────────────────────────────────────────────
  const fetchPage = useCallback(async (pageIndex: number, reset = false) => {
    if (!restaurantId) return;
    pageIndex === 0 ? setLoading(true) : setLoadingMore(true);

    const from = pageIndex * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    let query = supabase
      .from('deliveries')
      .select('id,pickup_address,delivery_address,status,price,distance_km,created_at,delivered_at,description,driver_id')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (statusFilter !== 'all' && !searchTerm) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao carregar histórico' });
    } else {
      const rows = (data ?? []) as Delivery[];
      setDeliveries((prev) => (reset ? rows : [...prev, ...rows]));
      setHasMore(rows.length === PAGE_SIZE);
      setPage(pageIndex);
    }

    pageIndex === 0 ? setLoading(false) : setLoadingMore(false);
  }, [restaurantId, statusFilter, searchTerm]);

  useEffect(() => {
    if (!restaurantId) return;
    fetchPage(0, true);
  }, [restaurantId, statusFilter, searchTerm]);

  // ── rated ids ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const ids = deliveries
      .filter((d) => d.status === 'delivered' && d.driver_id)
      .map((d) => d.id);
    if (!user || ids.length === 0) return;
    supabase
      .from('ratings')
      .select('delivery_id')
      .eq('rated_by', user.id)
      .in('delivery_id', ids)
      .then(({ data }) => {
        if (data) setRatedDeliveryIds(new Set(data.map((r) => r.delivery_id)));
      });
  }, [user?.id, deliveries]);

  const openRating = async (deliveryId: string, driverId: string) => {
    const { data } = await supabase
      .from('drivers')
      .select('user_id, profiles!drivers_user_id_fkey(full_name)')
      .eq('id', driverId)
      .maybeSingle();
    if (!data) return;
    setRatingTarget({
      deliveryId,
      targetUserId: data.user_id,
      targetName: (data as any).profiles?.full_name || 'Entregador',
    });
  };

  // ── filtered list ─────────────────────────────────────────────────────────
  const filtered = deliveries.filter((d) => {
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    const q = searchTerm.toLowerCase();
    const matchSearch = !q ||
      d.delivery_address.toLowerCase().includes(q) ||
      d.pickup_address.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <div className="bg-primary h-40" />
        <div className="px-4 space-y-3 mt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* ── HERO ── */}
      <div className="bg-primary">
        <div
          className="flex items-center gap-3 px-4 pb-4"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
        >
          <button
            onClick={() => navigate('/restaurant/dashboard')}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h1 className="text-white font-bold text-lg">Histórico</h1>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 px-4 pb-5">
          {[
            { label: 'Total', value: stats.total, color: 'text-white' },
            { label: 'Entregues', value: stats.delivered, color: 'text-green-300' },
            { label: 'Gasto', value: `R$ ${stats.totalSpent.toFixed(0)}`, color: 'text-white' },
          ].map((k) => (
            <div key={k.label} className="bg-white/10 rounded-2xl p-3 text-center">
              <p className={`text-xl font-extrabold ${k.color}`}>{k.value}</p>
              <p className="text-white/60 text-xs mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-3">

        {/* Busca + filtro de status */}
        <div className="bg-white rounded-2xl shadow-sm p-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por endereço..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 border-gray-200"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  statusFilter === opt.value
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
            <PackageX className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium text-sm">Nenhuma entrega encontrada</p>
          </div>
        ) : (
          <>
            {filtered.map((delivery) => {
              const cfg = getStatusConfig(delivery.status);
              const date = new Date(delivery.created_at);
              const canRate = delivery.status === 'delivered' && delivery.driver_id && !ratedDeliveryIds.has(delivery.id);

              return (
                <div key={delivery.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  {/* Status bar */}
                  <div className={`h-1 ${cfg.badge?.includes('green') ? 'bg-green-400' : cfg.badge?.includes('red') ? 'bg-red-400' : cfg.badge?.includes('blue') ? 'bg-blue-400' : 'bg-gray-300'}`} />

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`text-xs ${cfg.badge}`}>{cfg.label}</Badge>
                          <span className="text-xs text-gray-400">
                            {date.toLocaleDateString('pt-BR')} · {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="space-y-1.5 mt-2">
                          <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                            <p className="text-xs text-gray-600 leading-snug truncate">{delivery.pickup_address}</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                            <p className="text-xs text-gray-600 leading-snug truncate">{delivery.delivery_address}</p>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-base font-bold text-primary">R$ {Number(delivery.price).toFixed(2)}</p>
                        <p className="text-xs text-gray-400">{Number(delivery.distance_km).toFixed(1)} km</p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1 border-t border-gray-50">
                      <button
                        onClick={() => navigate(`/restaurant/delivery/${delivery.id}`)}
                        className="flex-1 h-9 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Ver detalhes
                      </button>
                      {canRate && (
                        <button
                          onClick={() => openRating(delivery.id, delivery.driver_id!)}
                          className="flex-1 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold flex items-center justify-center gap-1.5"
                        >
                          <Star className="h-3.5 w-3.5" />
                          Avaliar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <button
                onClick={() => fetchPage(page + 1)}
                disabled={loadingMore}
                className="w-full h-11 rounded-2xl bg-white shadow-sm border border-gray-100 text-sm font-medium text-gray-600 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loadingMore ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</>
                ) : (
                  <><ChevronRight className="h-4 w-4" /> Carregar mais</>
                )}
              </button>
            )}
          </>
        )}
      </main>

      <BottomNav />

      {ratingTarget && (
        <RatingModal
          deliveryId={ratingTarget.deliveryId}
          raterRole="restaurant"
          targetUserId={ratingTarget.targetUserId}
          targetName={ratingTarget.targetName}
          onClose={() => setRatingTarget(null)}
          onSubmitted={() => {
            setRatedDeliveryIds((prev) => new Set(prev).add(ratingTarget.deliveryId));
            setRatingTarget(null);
          }}
        />
      )}
    </div>
  );
}
