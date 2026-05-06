import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Copy, Share2, Users, Trophy, CheckCircle, Clock, Gift, ChevronRight } from 'lucide-react';
import { DriverBottomNav } from '@/components/DriverBottomNav';
import { toast } from '@/hooks/use-toast';

// ── Types ────────────────────────────────────────────────────────────────────
interface Referral {
  id: string;
  referred_driver_id: string;
  status: 'pending' | 'validated' | 'rewarded';
  referred_deliveries: number;
  created_at: string;
  rewarded_at: string | null;
}

// ── Query ────────────────────────────────────────────────────────────────────
async function fetchReferralData(userId: string) {
  const { data: driver } = await supabase
    .from('drivers')
    .select('id, referral_code, points')
    .eq('user_id', userId)
    .maybeSingle();

  if (!driver) return { referralCode: null, points: 0, referrals: [] as Referral[] };

  const { data: referrals } = await supabase
    .from('referrals')
    .select('*')
    .eq('referrer_driver_id', driver.id)
    .order('created_at', { ascending: false });

  return {
    referralCode: driver.referral_code,
    points: driver.points,
    referrals: (referrals ?? []) as Referral[],
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending: {
    label: 'Aguardando',
    color: 'text-gray-500',
    bg: 'bg-gray-100',
    icon: Clock,
  },
  validated: {
    label: 'Em progresso',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    icon: ChevronRight,
  },
  rewarded: {
    label: 'Concluído',
    color: 'text-green-600',
    bg: 'bg-green-50',
    icon: CheckCircle,
  },
};

// ── Component ────────────────────────────────────────────────────────────────
export default function DriverReferral() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['driver-referral', user?.id],
    queryFn: () => fetchReferralData(user!.id),
    enabled: !!user?.id,
    staleTime: 30 * 1000,
  });

  const referralCode = data?.referralCode ?? '';
  const referrals = data?.referrals ?? [];
  const totalRewarded = referrals.filter((r) => r.status === 'rewarded').length;
  const pointsFromReferrals = totalRewarded * 100;
  const totalPending = referrals.filter((r) => r.status !== 'rewarded').length;

  const shareMessage = `Ganhe dinheiro fazendo entregas com a Levei.ai.\nUse meu código: ${referralCode}\n\nhttps://leveiai.com`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      toast({ title: '✓ Código copiado!' });
    } catch {
      toast({ title: 'Código: ' + referralCode });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Levei.ai — Entregue com a gente',
          text: shareMessage,
        });
      } catch {
        // user dismissed
      }
    } else {
      await navigator.clipboard.writeText(shareMessage);
      toast({ title: '✓ Mensagem copiada!' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-4 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition-transform"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h1 className="text-white font-bold text-xl">Indique um amigo</h1>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/15 rounded-2xl p-3 text-center">
            <p className="text-white text-2xl font-black">{referrals.length}</p>
            <p className="text-blue-100 text-xs mt-0.5">Indicados</p>
          </div>
          <div className="bg-white/15 rounded-2xl p-3 text-center">
            <p className="text-white text-2xl font-black">{totalRewarded}</p>
            <p className="text-blue-100 text-xs mt-0.5">Concluídos</p>
          </div>
          <div className="bg-white/15 rounded-2xl p-3 text-center">
            <p className="text-white text-2xl font-black">{pointsFromReferrals}</p>
            <p className="text-blue-100 text-xs mt-0.5">Pontos ganhos</p>
          </div>
        </div>
      </div>

      {/* ── Referral code card ── */}
      <div className="px-4 -mt-3 relative z-10">
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-5">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">Seu código de indicação</p>

          {isLoading ? (
            <div className="h-12 bg-gray-100 rounded-2xl animate-pulse" />
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl px-4 py-3">
                <p className="text-3xl font-black text-gray-900 tracking-widest text-center">
                  {referralCode || '——'}
                </p>
              </div>
              <button
                onClick={handleCopy}
                className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
              >
                <Copy className="h-5 w-5 text-blue-600" />
              </button>
            </div>
          )}

          {/* Share button */}
          <button
            onClick={handleShare}
            className="mt-3 w-full h-12 rounded-2xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-blue-600/25"
          >
            <Share2 className="h-4 w-4" />
            Compartilhar convite
          </button>
        </div>
      </div>

      {/* ── How it works ── */}
      <div className="px-4 mt-4">
        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Como funciona</p>
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
          {[
            { step: '1', text: 'Compartilhe seu código com um amigo' },
            { step: '2', text: 'Ele se cadastra e informa seu código' },
            { step: '3', text: 'Quando completar 5 entregas, você ganha' },
          ].map((item, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3.5 ${i < 2 ? 'border-b border-gray-50' : ''}`}>
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-700 text-xs font-black">{item.step}</span>
              </div>
              <p className="text-gray-700 text-sm">{item.text}</p>
              {i === 2 && (
                <div className="ml-auto flex items-center gap-1 bg-amber-50 rounded-full px-2.5 py-1 flex-shrink-0">
                  <Trophy className="h-3 w-3 text-amber-500" />
                  <span className="text-amber-700 text-xs font-bold">+100 pts</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Preview da mensagem ── */}
      <div className="px-4 mt-4">
        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Mensagem de convite</p>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="bg-green-50 rounded-xl p-3">
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
              {`Ganhe dinheiro fazendo entregas com a Levei.ai.\nUse meu código: `}
              <span className="font-black text-green-700">{referralCode || 'XXXXXX'}</span>
              {`\n\nhttps://leveiai.com`}
            </p>
          </div>
        </div>
      </div>

      {/* ── Referrals list ── */}
      <div className="px-4 mt-4 pb-28">
        <div className="flex items-center justify-between mb-2">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Seus indicados</p>
          {totalPending > 0 && (
            <span className="text-blue-600 text-xs font-semibold">{totalPending} em andamento</span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-16 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : referrals.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
              <Users className="h-6 w-6 text-blue-400" />
            </div>
            <p className="text-gray-600 font-semibold text-sm">Nenhum indicado ainda</p>
            <p className="text-gray-400 text-xs mt-1">Compartilhe seu código e ganhe pontos</p>
          </div>
        ) : (
          <div className="space-y-2">
            {referrals.map((referral) => {
              const cfg = STATUS_CONFIG[referral.status];
              const Icon = cfg.icon;
              const progress = Math.min((referral.referred_deliveries / 5) * 100, 100);
              return (
                <div key={referral.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        <Users className="h-4 w-4 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-gray-800 font-semibold text-sm">Motoboy indicado</p>
                        <p className="text-gray-400 text-xs">
                          {new Date(referral.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 ${cfg.bg} rounded-full px-2.5 py-1`}>
                      <Icon className={`h-3 w-3 ${cfg.color}`} />
                      <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                    </div>
                  </div>

                  {referral.status !== 'rewarded' ? (
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">
                          {referral.referred_deliveries} de 5 entregas
                        </span>
                        <span className="text-blue-600 font-semibold">+100 pts ao completar</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-700"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 bg-green-50 rounded-xl px-3 py-2">
                      <Gift className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <p className="text-green-700 text-xs font-semibold">+100 pontos creditados!</p>
                      {referral.rewarded_at && (
                        <p className="text-green-500 text-xs ml-auto">
                          {new Date(referral.rewarded_at).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DriverBottomNav />
    </div>
  );
}
