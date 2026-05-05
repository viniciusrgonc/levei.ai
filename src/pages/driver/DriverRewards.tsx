import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Trophy, Star, Zap, Gift, Lock, CheckCircle } from 'lucide-react';
import { DriverBottomNav } from '@/components/DriverBottomNav';

// ── Reward tiers ────────────────────────────────────────────────────────────
const REWARDS = [
  {
    id: 1,
    points: 50,
    title: 'Iniciante',
    description: 'Complete 5 entregas e ganhe o badge de Iniciante',
    icon: Star,
    color: 'text-gray-500',
    bg: 'bg-gray-100',
    activeBg: 'bg-gray-50',
    activeBorder: 'border-gray-300',
  },
  {
    id: 2,
    points: 100,
    title: 'Veloz',
    description: 'Chegue a 100 pontos e desbloqueie prioridade em novas corridas',
    icon: Zap,
    color: 'text-blue-500',
    bg: 'bg-blue-100',
    activeBg: 'bg-blue-50',
    activeBorder: 'border-blue-300',
  },
  {
    id: 3,
    points: 250,
    title: 'Destaque',
    description: 'Seja um motoboy destaque e apareça primeiro para restaurantes',
    icon: Trophy,
    color: 'text-amber-500',
    bg: 'bg-amber-100',
    activeBg: 'bg-amber-50',
    activeBorder: 'border-amber-300',
  },
  {
    id: 4,
    points: 500,
    title: 'Elite',
    description: 'Acesso antecipado a entregas premium e taxa reduzida da plataforma',
    icon: Gift,
    color: 'text-purple-500',
    bg: 'bg-purple-100',
    activeBg: 'bg-purple-50',
    activeBorder: 'border-purple-300',
  },
];

// ── Query ───────────────────────────────────────────────────────────────────
async function fetchDriverPoints(userId: string) {
  const { data, error } = await supabase
    .from('drivers')
    .select('points, total_deliveries')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data;
}

// ── Component ───────────────────────────────────────────────────────────────
export default function DriverRewards() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['driver-points', user?.id],
    queryFn: () => fetchDriverPoints(user!.id),
    enabled: !!user?.id,
    staleTime: 30 * 1000,
  });

  const points = data?.points ?? 0;
  const totalDeliveries = data?.total_deliveries ?? 0;

  // Find current tier and next tier
  const unlockedRewards = REWARDS.filter((r) => points >= r.points);
  const nextReward = REWARDS.find((r) => points < r.points);
  const progressToNext = nextReward
    ? Math.min((points / nextReward.points) * 100, 100)
    : 100;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-amber-500 to-amber-600 px-4 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition-transform"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h1 className="text-white font-bold text-xl">Recompensas</h1>
        </div>

        {/* Points display */}
        {isLoading ? (
          <div className="bg-white/20 rounded-2xl p-4 animate-pulse h-24" />
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

            {/* Progress bar to next reward */}
            {nextReward && (
              <>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-amber-100">{points} pts</span>
                  <span className="text-amber-100 font-semibold">
                    Próximo: {nextReward.title} ({nextReward.points} pts)
                  </span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-700"
                    style={{ width: `${progressToNext}%` }}
                  />
                </div>
                <p className="text-amber-100 text-xs mt-1.5">
                  Faltam {nextReward.points - points} pontos para desbloquear
                </p>
              </>
            )}
            {!nextReward && (
              <p className="text-white font-semibold text-sm">
                🎉 Você desbloqueou todos os níveis!
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── How to earn ── */}
      <div className="px-4 mt-4">
        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Como ganhar pontos</p>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="text-gray-800 font-semibold text-sm">Entrega concluída</p>
              <p className="text-gray-400 text-xs">Cada entrega bem-sucedida</p>
            </div>
            <span className="text-green-600 font-bold text-sm">+10 pts</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Gift className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-gray-800 font-semibold text-sm">Indicar um amigo</p>
              <p className="text-gray-400 text-xs">Motoboy se cadastra com seu código</p>
            </div>
            <span className="text-blue-600 font-bold text-sm">+100 pts</span>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="px-4 mt-4">
        <div className="flex gap-3">
          <div className="flex-1 bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-black text-gray-900">{totalDeliveries}</p>
            <p className="text-gray-400 text-xs mt-0.5">Entregas feitas</p>
          </div>
          <div className="flex-1 bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-black text-gray-900">{unlockedRewards.length}</p>
            <p className="text-gray-400 text-xs mt-0.5">Níveis desbloqueados</p>
          </div>
          <div className="flex-1 bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 text-center">
            <p className="text-2xl font-black text-gray-900">{REWARDS.length - unlockedRewards.length}</p>
            <p className="text-gray-400 text-xs mt-0.5">Restantes</p>
          </div>
        </div>
      </div>

      {/* ── Reward tiers ── */}
      <div className="px-4 mt-4 pb-28">
        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Níveis de recompensa</p>
        <div className="space-y-3">
          {REWARDS.map((reward) => {
            const unlocked = points >= reward.points;
            const Icon = reward.icon;
            return (
              <div
                key={reward.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border transition-all ${
                  unlocked
                    ? `${reward.activeBorder} border-2`
                    : 'border-gray-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl ${unlocked ? reward.bg : 'bg-gray-100'} flex items-center justify-center flex-shrink-0`}>
                    <Icon
                      className={`h-5 w-5 ${unlocked ? reward.color : 'text-gray-300'}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-bold text-sm ${unlocked ? 'text-gray-900' : 'text-gray-400'}`}>
                        {reward.title}
                      </p>
                      {unlocked && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${reward.bg} ${reward.color}`}>
                          Desbloqueado
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 ${unlocked ? 'text-gray-500' : 'text-gray-300'}`}>
                      {reward.description}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {unlocked ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <>
                        <Lock className="h-4 w-4 text-gray-300 mx-auto mb-0.5" />
                        <p className="text-gray-300 text-xs font-bold">{reward.points} pts</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Progress bar for locked rewards */}
                {!unlocked && (
                  <div className="mt-3">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${reward.bg}`}
                        style={{ width: `${Math.min((points / reward.points) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-gray-300 text-[10px] mt-1">
                      {points} / {reward.points} pontos
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <DriverBottomNav />
    </div>
  );
}
