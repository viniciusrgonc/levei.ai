import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Star, MessageSquare, TrendingUp, Award } from 'lucide-react';
import { DriverBottomNav } from '@/components/DriverBottomNav';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Query ────────────────────────────────────────────────────────────────────
async function fetchDriverRatings(userId: string) {
  // Get all ratings where this user was rated
  const { data: ratings, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('rated_user', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const list = ratings ?? [];
  const total = list.length;
  const avg = total > 0
    ? list.reduce((sum, r) => sum + r.rating, 0) / total
    : null;

  // Distribution 1–5
  const dist = [1, 2, 3, 4, 5].map((star) => ({
    star,
    count: list.filter((r) => r.rating === star).length,
  }));

  return { ratings: list, avg, total, dist };
}

// ── Star display ─────────────────────────────────────────────────────────────
function Stars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  const px = size === 'lg' ? 20 : 14;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: px, height: px }}
          fill={i <= Math.round(value) ? '#fbbf24' : 'transparent'}
          stroke={i <= Math.round(value) ? '#fbbf24' : '#d1d5db'}
        />
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DriverRatings() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['driver-ratings', user?.id],
    queryFn: () => fetchDriverRatings(user!.id),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  const avg = data?.avg ?? null;
  const total = data?.total ?? 0;
  const dist = data?.dist ?? [];
  const ratings = data?.ratings ?? [];
  const maxCount = Math.max(...dist.map((d) => d.count), 1);

  // Sentiment label
  const sentiment =
    avg === null ? null
    : avg >= 4.5 ? { label: 'Excelente', color: 'text-green-600', bg: 'bg-green-50' }
    : avg >= 4.0 ? { label: 'Muito bom', color: 'text-blue-600', bg: 'bg-blue-50' }
    : avg >= 3.5 ? { label: 'Bom', color: 'text-amber-600', bg: 'bg-amber-50' }
    : { label: 'Precisa melhorar', color: 'text-red-600', bg: 'bg-red-50' };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-yellow-500 to-amber-500 px-4 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition-transform"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h1 className="text-white font-bold text-xl">Minhas Avaliações</h1>
        </div>

        {/* Score card */}
        {isLoading ? (
          <div className="bg-white/20 rounded-2xl h-28 animate-pulse" />
        ) : avg !== null ? (
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 flex items-center gap-5">
            {/* Big number */}
            <div className="text-center">
              <p className="text-white text-5xl font-black leading-none">{avg.toFixed(1)}</p>
              <Stars value={avg} size="lg" />
              <p className="text-amber-100 text-xs mt-1">{total} avaliação{total !== 1 ? 'ões' : ''}</p>
            </div>

            {/* Distribution bars */}
            <div className="flex-1 space-y-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const d = dist.find((x) => x.star === star)!;
                const pct = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-amber-100 text-[10px] w-3 text-right">{star}</span>
                    <Star className="h-2.5 w-2.5 text-amber-200 fill-amber-200 flex-shrink-0" />
                    <div className="flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-amber-100 text-[10px] w-3">{d.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white/15 rounded-2xl p-4 text-center">
            <Star className="h-8 w-8 text-amber-200 mx-auto mb-2" />
            <p className="text-white font-semibold text-sm">Ainda sem avaliações</p>
            <p className="text-amber-100 text-xs mt-1">Complete entregas para receber notas</p>
          </div>
        )}
      </div>

      {/* ── Sentiment badge + stats ── */}
      {sentiment && (
        <div className="px-4 mt-4 flex items-center gap-3">
          <div className={`flex items-center gap-1.5 ${sentiment.bg} rounded-full px-3 py-1.5`}>
            <Award className={`h-3.5 w-3.5 ${sentiment.color}`} />
            <span className={`text-xs font-bold ${sentiment.color}`}>{sentiment.label}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-gray-500" />
            <span className="text-xs font-semibold text-gray-600">
              {dist.find((d) => d.star >= 4)
                ? `${Math.round(((dist.filter((d) => d.star >= 4).reduce((s, d) => s + d.count, 0)) / Math.max(total, 1)) * 100)}% positivas`
                : '—'
              }
            </span>
          </div>
        </div>
      )}

      {/* ── Reviews list ── */}
      <div className="px-4 mt-4 pb-28">
        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">
          Histórico de avaliações
        </p>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-20 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : ratings.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
            <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-3">
              <Star className="h-6 w-6 text-amber-300" />
            </div>
            <p className="text-gray-600 font-semibold text-sm">Nenhuma avaliação ainda</p>
            <p className="text-gray-400 text-xs mt-1">Complete entregas para aparecer aqui</p>
          </div>
        ) : (
          <div className="space-y-2">
            {ratings.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Stars value={r.rating} />
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      r.rating >= 4 ? 'bg-green-50 text-green-700'
                      : r.rating === 3 ? 'bg-amber-50 text-amber-700'
                      : 'bg-red-50 text-red-700'
                    }`}>
                      {r.rating}/5
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs flex-shrink-0">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
                {r.comment && (
                  <div className="flex items-start gap-2 mt-2.5 bg-gray-50 rounded-xl px-3 py-2">
                    <MessageSquare className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-600 text-sm leading-relaxed">{r.comment}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <DriverBottomNav />
    </div>
  );
}
