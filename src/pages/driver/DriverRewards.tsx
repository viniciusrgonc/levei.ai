import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Trophy, Star, Zap, Gift, Lock, CheckCircle,
  History, Flame, Medal, Shield, Crown, Award,
  Plus, Minus, SlidersHorizontal, Calendar,
} from 'lucide-react';
import { DriverBottomNav } from '@/components/DriverBottomNav';

// ── Reward tiers ─────────────────────────────────────────────────────────────
const REWARDS = [
  { id: 1, points: 50,  title: 'Iniciante', description: 'Complete 5 entregas e ganhe o badge de Iniciante',                       icon: Star,   color: 'text-gray-500',   bg: 'bg-gray-100',   activeBg: 'bg-gray-50',   activeBorder: 'border-gray-300'   },
  { id: 2, points: 100, title: 'Veloz',     description: 'Chegue a 100 pontos e desbloqueie prioridade em novas corridas',          icon: Zap,    color: 'text-blue-500',   bg: 'bg-blue-100',   activeBg: 'bg-blue-50',   activeBorder: 'border-blue-300'   },
  { id: 3, points: 250, title: 'Destaque',  description: 'Seja um motoboy destaque e apareça primeiro para restaurantes',            icon: Trophy, color: 'text-amber-500',  bg: 'bg-amber-100',  activeBg: 'bg-amber-50',  activeBorder: 'border-amber-300'  },
  { id: 4, points: 500, title: 'Elite',     description: 'Acesso antecipado a entregas premium e taxa reduzida da plataforma',       icon: Gift,   color: 'text-purple-500', bg: 'bg-purple-100', activeBg: 'bg-purple-50', activeBorder: 'border-purple-300' },
];

// ── Badges ────────────────────────────────────────────────────────────────────
const BADGES = [
  { id: 'first_delivery', label: 'Primeira entrega', description: 'Completou sua 1ª entrega na plataforma',         icon: Star,   color: 'text-amber-600',  bg: 'bg-amber-100',  border: 'border-amber-300',  check: (_p: number, d: number) => d >= 1   },
  { id: 'deliveries_10',  label: '10 entregas',      description: 'Completou 10 entregas com sucesso',               icon: Medal,  color: 'text-blue-600',   bg: 'bg-blue-100',   border: 'border-blue-300',   check: (_p: number, d: number) => d >= 10  },
  { id: 'deliveries_50',  label: '50 entregas',      description: 'Motoboy experiente — 50 entregas!',              icon: Shield, color: 'text-green-600',  bg: 'bg-green-100',  border: 'border-green-300',  check: (_p: number, d: number) => d >= 50  },
  { id: 'deliveries_100', label: '100 entregas',     description: 'Centena completa — você é um profissional!',      icon: Trophy, color: 'text-amber-500',  bg: 'bg-amber-100',  border: 'border-amber-300',  check: (_p: number, d: number) => d >= 100 },
  { id: 'deliveries_500', label: '500 entregas',     description: 'Lendário — 500 entregas concluídas',              icon: Crown,  color: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-300', check: (_p: number, d: number) => d >= 500 },
  { id: 'points_100',     label: '100 pontos',       description: 'Atingiu 100 pontos acumulados',                   icon: Zap,    color: 'text-blue-600',   bg: 'bg-blue-100',   border: 'border-blue-300',   check: (p: number) => p >= 100  },
  { id: 'points_500',     label: '500 pontos',       description: 'Atingiu 500 pontos acumulados',                   icon: Flame,  color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-300', check: (p: number) => p >= 500  },
  { id: 'points_1000',    label: '1.000 pontos',     description: 'Milésimo ponto — conquista suprema!',             icon: Award,  color: 'text-red-600',    bg: 'bg-red-100',    border: 'border-red-300',    check: (p: number) => p >= 1000 },
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface Adjustment { id: string; amount: number; type: string; observation: string | null; created_at: string; }
interface Campaign   { id: string; name: string; multiplier: number; starts_at: string; ends_at: string; product_type_filter: string | null; min_distance_km: number | null; weekdays_only: boolean; night_hours_only: boolean; }
type Tab = 'niveis' | 'historico' | 'campanhas' | 'conquistas';

const ADJ_ICONS: Record<string, typeof Plus> = { bonus: Plus, campaign: Zap, removal: Minus, adjustment: SlidersHorizontal };

// ── Queries ───────────────────────────────────────────────────────────────────
async function fetchDriverData(userId: string) {
  const { data, error } = await supabase.from('drivers').select('points, total_deliveries, id').eq('user_id', userId).single();
  if (error) throw error;
  return data;
}
async function fetchAdjustments(driverId: string): Promise<Adjustment[]> {
  const { data, error } = await (supabase as any).from('point_adjustments').select('id, amount, type, observation, created_at').eq('driver_id', driverId).order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data ?? [];
}
async function fetchActiveCampaigns(): Promise<Campaign[]> {
  const now = new Date().toISOString();
  const { data, error } = await (supabase as any).from('reward_campaigns').select('*').eq('is_active', true).lte('starts_at', now).gte('ends_at', now).order('multiplier', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DriverRewards() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('niveis');

  const { data: driverData, isLoading } = useQuery({ queryKey: ['driver-points', user?.id], queryFn: () => fetchDriverData(user!.id), enabled: !!user?.id, staleTime: 30_000 });
  const { data: adjustments = [], isLoading: loadingAdj } = useQuery({ queryKey: ['driver-point-history', driverData?.id], queryFn: () => fetchAdjustments(driverData!.id), enabled: !!driverData?.id && tab === 'historico', staleTime: 30_000 });
  const { data: campaigns = [], isLoading: loadingCampaigns } = useQuery({ queryKey: ['active-campaigns'], queryFn: fetchActiveCampaigns, enabled: tab === 'campanhas', staleTime: 60_000 });

  const points = driverData?.points ?? 0;
  const totalDeliveries = driverData?.total_deliveries ?? 0;
  const unlockedRewards = REWARDS.filter((r) => points >= r.points);
  const nextReward = REWARDS.find((r) => points < r.points);
  const progressToNext = nextReward ? Math.min((points / nextReward.points) * 100, 100) : 100;
  const unlockedBadges = BADGES.filter((b) => b.check(points, totalDeliveries));
  const lockedBadges   = BADGES.filter((b) => !b.check(points, totalDeliveries));

  const tabs: { id: Tab; label: string }[] = [
    { id: 'niveis',     label: 'Níveis'     },
    { id: 'historico',  label: 'Histórico'  },
    { id: 'campanhas',  label: 'Campanhas'  },
    { id: 'conquistas', label: 'Conquistas' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      {/* Header */}
      <div className="bg-gradient-to-br from-amber-500 to-amber-600 px-4 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition-transform">
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h1 className="text-white font-bold text-xl">Recompensas</h1>
        </div>

        {isLoading ? (
          <div className="bg-white/20 rounded-2xl p-4 animate-pulse h-28" />
        ) : (
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-amber-100 text-xs font-medium">Seus pontos</p>
                <p className="text-white text-4xl font-black leading-none">{points}</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                <Trophy className="h-7 w-7 text-amber-200" />
              </div>
            </div>
            {nextReward ? (
              <>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-amber-100">{points} pts</span>
                  <span className="text-amber-100 font-semibold">Próximo: {nextReward.title} ({nextReward.points} pts)</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${progressToNext}%` }} />
                </div>
                <p className="text-amber-100 text-xs mt-1.5">Faltam {nextReward.points - points} pontos para desbloquear</p>
              </>
            ) : (
              <p className="text-white font-semibold text-sm">🎉 Você desbloqueou todos os níveis!</p>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-4 flex overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-400'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 pb-28">

        {/* ── NÍVEIS ── */}
        {tab === 'niveis' && (
          <div className="px-4 pt-4 space-y-4">
            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Como ganhar pontos</p>
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50">
                  <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0"><CheckCircle className="h-4 w-4 text-green-600" /></div>
                  <div className="flex-1"><p className="text-gray-800 font-semibold text-sm">Entrega concluída</p><p className="text-gray-400 text-xs">Cada entrega bem-sucedida</p></div>
                  <span className="text-green-600 font-bold text-sm">+10 pts</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0"><Gift className="h-4 w-4 text-blue-600" /></div>
                  <div className="flex-1"><p className="text-gray-800 font-semibold text-sm">Indicar um amigo</p><p className="text-gray-400 text-xs">Motoboy se cadastra com seu código</p></div>
                  <span className="text-blue-600 font-bold text-sm">+100 pts</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1 bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 text-center"><p className="text-2xl font-black text-gray-900">{totalDeliveries}</p><p className="text-gray-400 text-xs mt-0.5">Entregas feitas</p></div>
              <div className="flex-1 bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 text-center"><p className="text-2xl font-black text-gray-900">{unlockedRewards.length}</p><p className="text-gray-400 text-xs mt-0.5">Níveis desbloqueados</p></div>
              <div className="flex-1 bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 text-center"><p className="text-2xl font-black text-gray-900">{unlockedBadges.length}</p><p className="text-gray-400 text-xs mt-0.5">Conquistas</p></div>
            </div>

            <div>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Níveis de recompensa</p>
              <div className="space-y-3">
                {REWARDS.map((reward) => {
                  const unlocked = points >= reward.points;
                  const Icon = reward.icon;
                  return (
                    <div key={reward.id} className={`bg-white rounded-2xl p-4 shadow-sm border transition-all ${unlocked ? `${reward.activeBorder} border-2` : 'border-gray-100'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-2xl ${unlocked ? reward.bg : 'bg-gray-100'} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`h-5 w-5 ${unlocked ? reward.color : 'text-gray-300'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`font-bold text-sm ${unlocked ? 'text-gray-900' : 'text-gray-400'}`}>{reward.title}</p>
                            {unlocked && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${reward.bg} ${reward.color}`}>Desbloqueado</span>}
                          </div>
                          <p className={`text-xs mt-0.5 ${unlocked ? 'text-gray-500' : 'text-gray-300'}`}>{reward.description}</p>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          {unlocked ? <CheckCircle className="h-5 w-5 text-green-500" /> : (<><Lock className="h-4 w-4 text-gray-300 mx-auto mb-0.5" /><p className="text-gray-300 text-xs font-bold">{reward.points} pts</p></>)}
                        </div>
                      </div>
                      {!unlocked && (
                        <div className="mt-3">
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${reward.bg}`} style={{ width: `${Math.min((points / reward.points) * 100, 100)}%` }} />
                          </div>
                          <p className="text-gray-300 text-[10px] mt-1">{points} / {reward.points} pontos</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── HISTÓRICO ── */}
        {tab === 'historico' && (
          <div className="px-4 pt-4">
            {loadingAdj ? (
              <div className="space-y-3">{[1,2,3,4].map((i) => <div key={i} className="h-16 bg-white rounded-2xl animate-pulse" />)}</div>
            ) : adjustments.length === 0 ? (
              <div className="bg-white rounded-2xl p-14 flex flex-col items-center text-center border border-dashed border-gray-200">
                <History className="h-10 w-10 text-gray-300 mb-3" />
                <p className="font-semibold text-gray-500">Nenhum ajuste registrado</p>
                <p className="text-sm text-gray-400 mt-1">Seus bônus e ajustes de pontos aparecerão aqui</p>
              </div>
            ) : (
              <div className="space-y-2">
                {adjustments.map((adj) => {
                  const isPositive = adj.amount > 0;
                  const AdjIcon = ADJ_ICONS[adj.type] ?? SlidersHorizontal;
                  return (
                    <div key={adj.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isPositive ? 'bg-green-100' : 'bg-red-100'}`}>
                        <AdjIcon className={`h-5 w-5 ${isPositive ? 'text-green-600' : 'text-red-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-800 text-sm font-semibold truncate">
                          {adj.observation ?? (adj.type === 'bonus' ? 'Bônus de pontos' : adj.type === 'campaign' ? 'Campanha ativa' : adj.type === 'removal' ? 'Remoção de pontos' : 'Ajuste de pontos')}
                        </p>
                        <p className="text-gray-400 text-xs mt-0.5">
                          {new Date(adj.created_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className={`font-black text-base flex-shrink-0 ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}{adj.amount}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── CAMPANHAS ── */}
        {tab === 'campanhas' && (
          <div className="px-4 pt-4 space-y-3">
            {loadingCampaigns ? (
              <div className="space-y-3">{[1,2].map((i) => <div key={i} className="h-32 bg-white rounded-2xl animate-pulse" />)}</div>
            ) : campaigns.length === 0 ? (
              <div className="bg-white rounded-2xl p-14 flex flex-col items-center text-center border border-dashed border-gray-200">
                <Zap className="h-10 w-10 text-gray-300 mb-3" />
                <p className="font-semibold text-gray-500">Nenhuma campanha ativa</p>
                <p className="text-sm text-gray-400 mt-1">Quando houver promoções de bônus elas aparecerão aqui</p>
              </div>
            ) : (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <p className="text-amber-700 text-sm font-semibold">
                    {campaigns.length} campanha{campaigns.length > 1 ? 's' : ''} ativa{campaigns.length > 1 ? 's' : ''} — suas entregas valem mais pontos!
                  </p>
                </div>
                {campaigns.map((c) => {
                  const mult = Number(c.multiplier);
                  return (
                    <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 flex items-center justify-between">
                        <p className="text-white font-bold text-sm">{c.name}</p>
                        <div className="bg-white/20 rounded-xl px-3 py-1"><span className="text-white font-black text-lg">{mult}×</span></div>
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>até {new Date(c.ends_at).toLocaleString('pt-BR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="bg-green-50 rounded-xl px-3 py-2">
                          <p className="text-green-700 text-xs font-semibold">🎉 Cada entrega vale <strong>{Math.round(10 * mult)} pts</strong> em vez de 10 pts</p>
                        </div>
                        {(c.product_type_filter || c.min_distance_km || c.weekdays_only || c.night_hours_only) && (
                          <div className="flex flex-wrap gap-1.5">
                            {c.product_type_filter && <span className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">{c.product_type_filter}</span>}
                            {c.min_distance_km && <span className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">+{c.min_distance_km} km</span>}
                            {c.weekdays_only && <span className="text-[11px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">Final de semana</span>}
                            {c.night_hours_only && <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">Noturno</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ── CONQUISTAS ── */}
        {tab === 'conquistas' && (
          <div className="px-4 pt-4 space-y-4">
            {unlockedBadges.length > 0 && (
              <div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Desbloqueadas ({unlockedBadges.length})</p>
                <div className="grid grid-cols-2 gap-3">
                  {unlockedBadges.map((badge) => {
                    const Icon = badge.icon;
                    return (
                      <div key={badge.id} className={`bg-white rounded-2xl p-4 border-2 ${badge.border} shadow-sm`}>
                        <div className={`w-12 h-12 rounded-2xl ${badge.bg} flex items-center justify-center mb-2`}><Icon className={`h-6 w-6 ${badge.color}`} /></div>
                        <p className={`font-bold text-sm ${badge.color}`}>{badge.label}</p>
                        <p className="text-gray-400 text-xs mt-0.5 leading-snug">{badge.description}</p>
                        <div className="mt-2 flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5 text-green-500" /><span className="text-green-600 text-[11px] font-semibold">Conquistado</span></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {lockedBadges.length > 0 && (
              <div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Bloqueadas ({lockedBadges.length})</p>
                <div className="grid grid-cols-2 gap-3">
                  {lockedBadges.map((badge) => {
                    const Icon = badge.icon;
                    return (
                      <div key={badge.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm opacity-60">
                        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-2"><Icon className="h-6 w-6 text-gray-300" /></div>
                        <p className="font-bold text-sm text-gray-400">{badge.label}</p>
                        <p className="text-gray-300 text-xs mt-0.5 leading-snug">{badge.description}</p>
                        <div className="mt-2 flex items-center gap-1"><Lock className="h-3.5 w-3.5 text-gray-300" /><span className="text-gray-300 text-[11px] font-semibold">Bloqueada</span></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {unlockedBadges.length === 0 && (
              <div className="bg-white rounded-2xl p-14 flex flex-col items-center text-center border border-dashed border-gray-200">
                <Award className="h-10 w-10 text-gray-300 mb-3" />
                <p className="font-semibold text-gray-500">Nenhuma conquista ainda</p>
                <p className="text-sm text-gray-400 mt-1">Complete entregas para desbloquear badges</p>
              </div>
            )}
          </div>
        )}
      </div>

      <DriverBottomNav />
    </div>
  );
}
