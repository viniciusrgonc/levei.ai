import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ShoppingBag, Trophy, Package, Star, Users, Zap,
  Clock, CheckCircle, Truck, AlertCircle, Loader2, ImageOff,
} from 'lucide-react';
import { DriverBottomNav } from '@/components/DriverBottomNav';
import { toast } from '@/hooks/use-toast';

// ── Types ────────────────────────────────────────────────────────────────────
interface StoreItem {
  id: string;
  name: string;
  description: string;
  category: string;
  image_url: string | null;
  points_cost: number;
  stock: number;
  is_active: boolean;
}

interface Redemption {
  id: string;
  item_id: string;
  points_used: number;
  status: string;
  created_at: string;
  store_items: { name: string } | null;
}

// ── Category config ──────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all',       label: 'Todos',       icon: ShoppingBag, color: 'text-gray-600',   bg: 'bg-gray-100'   },
  { key: 'equipment', label: 'Equipamentos', icon: Package,     color: 'text-blue-600',   bg: 'bg-blue-100'   },
  { key: 'benefits',  label: 'Benefícios',   icon: Star,        color: 'text-amber-600',  bg: 'bg-amber-100'  },
  { key: 'partners',  label: 'Parceiros',    icon: Users,       color: 'text-green-600',  bg: 'bg-green-100'  },
  { key: 'platform',  label: 'Plataforma',   icon: Zap,         color: 'text-purple-600', bg: 'bg-purple-100' },
];

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:  { label: 'Pendente',  color: 'text-amber-600 bg-amber-50',  icon: Clock        },
  approved: { label: 'Aprovado',  color: 'text-blue-600 bg-blue-50',    icon: CheckCircle  },
  delivered:{ label: 'Entregue',  color: 'text-green-600 bg-green-50',  icon: Truck        },
};

// ── Queries ──────────────────────────────────────────────────────────────────
async function fetchDriverPoints(userId: string) {
  const { data, error } = await supabase
    .from('drivers')
    .select('id, points')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data;
}

async function fetchStoreItems() {
  const { data, error } = await supabase
    .from('store_items')
    .select('*')
    .eq('is_active', true)
    .order('points_cost', { ascending: true });
  if (error) throw error;
  return (data ?? []) as StoreItem[];
}

async function fetchRedemptions(driverId: string) {
  const { data, error } = await supabase
    .from('store_redemptions')
    .select('id, item_id, points_used, status, created_at, store_items(name)')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as Redemption[];
}

// ── Component ────────────────────────────────────────────────────────────────
export default function DriverPointsStore() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState('all');
  const [tab, setTab] = useState<'store' | 'history'>('store');
  const [redeeming, setRedeeming] = useState<string | null>(null);

  const { data: driver, isLoading: loadingDriver } = useQuery({
    queryKey: ['driver-points', user?.id],
    queryFn: () => fetchDriverPoints(user!.id),
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ['store-items'],
    queryFn: fetchStoreItems,
    staleTime: 60_000,
  });

  const { data: redemptions = [], isLoading: loadingRedemptions } = useQuery({
    queryKey: ['store-redemptions', driver?.id],
    queryFn: () => fetchRedemptions(driver!.id),
    enabled: !!driver?.id,
    staleTime: 30_000,
  });

  const redeemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase.rpc('redeem_store_item', { p_item_id: itemId });
      if (error) throw error;
      const result = data as { success: boolean; error?: string; points_used?: number };
      if (!result.success) throw new Error(result.error ?? 'Erro ao resgatar');
      return result;
    },
    onSuccess: (result) => {
      toast({
        title: 'Resgate solicitado!',
        description: `${result.points_used} pontos usados. Aguarde aprovação do admin.`,
      });
      queryClient.invalidateQueries({ queryKey: ['driver-points'] });
      queryClient.invalidateQueries({ queryKey: ['store-redemptions'] });
      setTab('history');
    },
    onError: (err: Error) => {
      const msg: Record<string, string> = {
        'Driver not found':   'Perfil não encontrado.',
        'Item not found':     'Item não encontrado.',
        'Item unavailable':   'Item indisponível.',
        'Out of stock':       'Estoque esgotado.',
        'Insufficient points':'Pontos insuficientes para este resgate.',
      };
      toast({
        variant: 'destructive',
        title: 'Erro no resgate',
        description: msg[err.message] ?? err.message,
      });
    },
    onSettled: () => setRedeeming(null),
  });

  const handleRedeem = (item: StoreItem) => {
    if (!driver) return;
    if (driver.points < item.points_cost) {
      toast({ variant: 'destructive', title: 'Pontos insuficientes', description: `Você precisa de ${item.points_cost} pts mas tem ${driver.points}.` });
      return;
    }
    if (item.stock === 0) {
      toast({ variant: 'destructive', title: 'Esgotado', description: 'Este item está sem estoque.' });
      return;
    }
    setRedeeming(item.id);
    redeemMutation.mutate(item.id);
  };

  const filteredItems = activeCategory === 'all'
    ? items
    : items.filter((i) => i.category === activeCategory);

  const points = driver?.points ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-green-600 to-green-700 px-4 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition-transform"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h1 className="text-white font-bold text-xl">Loja de Pontos</h1>
        </div>

        {/* Balance card */}
        {loadingDriver ? (
          <div className="bg-white/20 rounded-2xl p-4 animate-pulse h-20" />
        ) : (
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-green-100 text-xs font-medium">Seus pontos disponíveis</p>
              <p className="text-white text-4xl font-black leading-tight">{points}</p>
              <p className="text-green-200 text-xs mt-0.5">pontos</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
              <Trophy className="h-7 w-7 text-green-200" />
            </div>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white border-b border-gray-100 px-4 flex gap-1 pt-1">
        {(['store', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t ? 'border-green-600 text-green-600' : 'border-transparent text-gray-400'
            }`}
          >
            {t === 'store' ? 'Itens disponíveis' : 'Histórico de resgates'}
          </button>
        ))}
      </div>

      {/* ── Store tab ── */}
      {tab === 'store' && (
        <>
          {/* Category filters */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {CATEGORIES.map(({ key, label, icon: Icon, color, bg }) => (
                <button
                  key={key}
                  onClick={() => setActiveCategory(key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                    activeCategory === key
                      ? `${bg} ${color} border-transparent`
                      : 'bg-white text-gray-500 border-gray-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Items grid */}
          <div className="px-4 pb-28">
            {loadingItems ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white rounded-2xl h-52 animate-pulse" />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <ShoppingBag className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">Nenhum item nesta categoria</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredItems.map((item) => {
                  const canAfford = points >= item.points_cost;
                  const outOfStock = item.stock === 0;
                  const catInfo = CATEGORIES.find((c) => c.key === item.category);
                  const isRedeeming = redeeming === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`bg-white rounded-2xl shadow-sm border flex flex-col overflow-hidden transition-all ${
                        outOfStock ? 'opacity-60 border-gray-100' : canAfford ? 'border-green-100' : 'border-gray-100'
                      }`}
                    >
                      {/* Image / placeholder */}
                      <div className={`h-28 flex items-center justify-center ${catInfo?.bg ?? 'bg-gray-100'} relative`}>
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageOff className={`h-10 w-10 ${catInfo?.color ?? 'text-gray-400'} opacity-50`} />
                        )}
                        {outOfStock && (
                          <div className="absolute inset-0 bg-gray-900/40 flex items-center justify-center">
                            <span className="text-white text-xs font-bold bg-gray-700 px-2 py-0.5 rounded-full">Esgotado</span>
                          </div>
                        )}
                        {item.stock > 0 && item.stock <= 5 && (
                          <span className="absolute top-1.5 right-1.5 text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                            Últimos {item.stock}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-3 flex flex-col flex-1">
                        <p className="text-gray-900 font-bold text-xs leading-snug line-clamp-2">{item.name}</p>
                        <p className="text-gray-400 text-[10px] mt-1 leading-relaxed line-clamp-2 flex-1">{item.description}</p>

                        <div className="mt-2.5 flex items-center gap-1.5 mb-2">
                          <Trophy className="h-3 w-3 text-amber-500" />
                          <span className="text-amber-600 font-black text-sm">{item.points_cost}</span>
                          <span className="text-gray-400 text-[10px]">pts</span>
                        </div>

                        <button
                          onClick={() => handleRedeem(item)}
                          disabled={!canAfford || outOfStock || isRedeeming}
                          className={`w-full py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                            outOfStock
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : canAfford
                              ? 'bg-green-600 text-white hover:bg-green-700'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {isRedeeming ? (
                            <span className="flex items-center justify-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" /> Resgatando...
                            </span>
                          ) : outOfStock ? (
                            'Esgotado'
                          ) : canAfford ? (
                            'Resgatar'
                          ) : (
                            `Faltam ${item.points_cost - points} pts`
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── History tab ── */}
      {tab === 'history' && (
        <div className="px-4 pt-4 pb-28">
          {loadingRedemptions ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl h-20 animate-pulse" />
              ))}
            </div>
          ) : redemptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <AlertCircle className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhum resgate ainda</p>
              <p className="text-xs mt-1">Troque seus pontos por recompensas!</p>
              <button
                onClick={() => setTab('store')}
                className="mt-4 bg-green-600 text-white text-xs font-bold px-4 py-2 rounded-xl"
              >
                Ver itens disponíveis
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {redemptions.map((r) => {
                const s = STATUS_MAP[r.status] ?? STATUS_MAP.pending;
                const Icon = s.icon;
                const date = new Date(r.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit', month: 'short', year: 'numeric',
                });
                return (
                  <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                      <ShoppingBag className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 font-semibold text-sm truncate">
                        {r.store_items?.name ?? 'Item removido'}
                      </p>
                      <p className="text-gray-400 text-xs mt-0.5">{date}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${s.color}`}>
                        <Icon className="h-3 w-3" />
                        {s.label}
                      </div>
                      <p className="text-amber-600 font-bold text-xs">-{r.points_used} pts</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <DriverBottomNav />
    </div>
  );
}
