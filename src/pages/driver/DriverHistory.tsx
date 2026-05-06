import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Package, Search, Loader2, ArrowLeft } from 'lucide-react';
import { getStatusConfig } from '@/lib/deliveryStatus';
import { DriverBottomNav } from '@/components/DriverBottomNav';

const PAGE_SIZE = 15;

type Delivery = {
  id: string;
  pickup_address: string;
  delivery_address: string;
  status: string;
  price: number;
  distance_km: number;
  created_at: string;
};

const filterTabs = [
  { key: 'all',       label: 'Todas' },
  { key: 'delivered', label: 'Entregues' },
  { key: 'cancelled', label: 'Canceladas' },
];

function shortAddress(addr: string) {
  const parts = addr.split(',');
  return parts.slice(0, 2).join(',').trim();
}

export default function DriverHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [driverId, setDriverId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  // KPI stats (all-time, fetched once)
  const [stats, setStats] = useState({ total: 0, delivered: 0, earned: 0 });

  // ── bootstrap: resolve driverId ──────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase
      .from('drivers')
      .select('id')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (!data) { navigate('/driver/setup'); return; }
        setDriverId(data.id);
      });
  }, [user]);

  // ── fetch KPIs (totals, not paginated) ──────────────────────────
  useEffect(() => {
    if (!driverId) return;
    supabase
      .from('deliveries')
      .select('status, price')
      .eq('driver_id', driverId)
      .then(({ data }) => {
        if (!data) return;
        const delivered = data.filter((d) => d.status === 'delivered');
        setStats({
          total: data.length,
          delivered: delivered.length,
          earned: delivered.reduce((s, d) => s + Number(d.price) * 0.8, 0),
        });
      });
  }, [driverId]);

  // ── fetch page (server-side filter by status when possible) ──────
  const fetchPage = useCallback(async (pageIndex: number, reset = false) => {
    if (!driverId) return;
    pageIndex === 0 ? setLoading(true) : setLoadingMore(true);

    const from = pageIndex * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    let query = supabase
      .from('deliveries')
      .select('id, pickup_address, delivery_address, status, price, distance_km, created_at')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false })
      .range(from, to);

    // Apply server-side status filter when not searching (search needs client-side anyway)
    if (activeFilter !== 'all' && !searchTerm) {
      query = query.eq('status', activeFilter);
    }

    const { data, error } = await query;

    if (error) {
      toast({ variant: 'destructive', title: 'Erro ao carregar histórico' });
    } else {
      const rows = data ?? [];
      setDeliveries((prev) => (reset ? rows : [...prev, ...rows]));
      setHasMore(rows.length === PAGE_SIZE);
      setPage(pageIndex);
    }

    pageIndex === 0 ? setLoading(false) : setLoadingMore(false);
  }, [driverId, activeFilter, searchTerm]);

  // Reset + refetch when filter or search changes
  useEffect(() => {
    if (!driverId) return;
    fetchPage(0, true);
  }, [driverId, activeFilter, searchTerm]);

  // ── client-side filter (search term only, since status is server-side) ──
  const filtered = deliveries.filter((d) => {
    const matchStatus = activeFilter === 'all' || d.status === activeFilter;
    const matchSearch = !searchTerm ||
      d.delivery_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.pickup_address.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-primary h-44" />
        <div className="px-4 space-y-3 mt-4">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── HERO ── */}
      <div className="bg-primary">
        <div
          className="flex items-center gap-3 px-4 pb-2"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
        >
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h1 className="text-white font-bold text-xl flex-1">Histórico</h1>
        </div>

        <div className="px-4 pt-2 pb-5">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[
              { label: 'Total',     value: stats.total },
              { label: 'Entregues', value: stats.delivered },
              { label: 'Ganhos (80%)', value: `R$ ${stats.earned.toFixed(2)}` },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white/10 border border-white/20 rounded-xl p-3 text-center">
                <p className="text-white font-bold text-lg leading-none">{kpi.value}</p>
                <p className="text-white/60 text-[10px] mt-1">{kpi.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-3">

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por endereço..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white rounded-xl pl-9 pr-4 py-3 text-sm border border-gray-100 shadow-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                activeFilter === tab.key
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-gray-500 border border-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* List */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-dashed border-gray-200 p-8 text-center">
            <p className="text-sm font-medium text-gray-700 mb-1">Nenhuma entrega encontrada</p>
            <p className="text-xs text-gray-400">Tente mudar o filtro ou a busca</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((delivery) => {
              const cfg = getStatusConfig(delivery.status);
              return (
                <div
                  key={delivery.id}
                  className="bg-white rounded-2xl shadow-sm p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Status badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </div>

                      {/* Pickup */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <Package className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                        <p className="text-xs text-gray-500 truncate">{shortAddress(delivery.pickup_address)}</p>
                      </div>
                      {/* Delivery */}
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {shortAddress(delivery.delivery_address)}
                        </p>
                      </div>

                      <p className="text-xs text-gray-400 mt-1.5">
                        {Number(delivery.distance_km).toFixed(1)} km ·{' '}
                        {new Date(delivery.created_at).toLocaleDateString('pt-BR')} ·{' '}
                        {new Date(delivery.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="text-base font-bold text-green-600">
                        +R$ {Number(delivery.price).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Load more */}
            {hasMore && (
              <button
                onClick={() => fetchPage(page + 1)}
                disabled={loadingMore}
                className="w-full py-3 rounded-2xl bg-white border border-gray-100 shadow-sm text-sm font-medium text-primary flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  'Carregar mais'
                )}
              </button>
            )}
          </div>
        )}
      </main>

      <DriverBottomNav />
    </div>
  );
}
