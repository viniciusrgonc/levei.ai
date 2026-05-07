import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { Star, Eye, EyeOff, Search, Filter } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

interface Rating {
  id: string;
  delivery_id: string;
  rated_by: string;
  rated_user: string;
  rating: number;
  comment: string | null;
  rater_role: string | null;
  negative_reasons: string[] | null;
  is_hidden: boolean;
  created_at: string;
  rater_profile: { full_name: string } | null;
  rated_profile: { full_name: string } | null;
}

const STARS_FILTER = [0, 1, 2, 3, 4, 5]; // 0 = todos

export default function AdminReviews() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'restaurant' | 'driver'>('all');
  const [starsFilter, setStarsFilter] = useState(0);
  const [showHidden, setShowHidden] = useState(false);

  const { data: ratings = [], isLoading } = useQuery<Rating[]>({
    queryKey: ['admin-ratings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ratings')
        .select(`
          *,
          rater_profile:profiles!ratings_rated_by_fkey(full_name),
          rated_profile:profiles!ratings_rated_user_fkey(full_name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Rating[];
    },
    staleTime: 30 * 1000,
  });

  const toggleHidden = useMutation({
    mutationFn: async ({ id, is_hidden }: { id: string; is_hidden: boolean }) => {
      const { error } = await supabase.from('ratings').update({ is_hidden }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ratings'] });
      toast({ title: 'Avaliação atualizada' });
    },
    onError: () => toast({ title: 'Erro ao atualizar', variant: 'destructive' }),
  });

  // Stats
  const totalRatings = ratings.length;
  const avgAll = totalRatings > 0
    ? (ratings.reduce((s, r) => s + r.rating, 0) / totalRatings).toFixed(2)
    : '—';
  const restToDriver = ratings.filter(r => r.rater_role === 'restaurant');
  const driverToRest = ratings.filter(r => r.rater_role === 'driver');
  const avgRestToDriver = restToDriver.length > 0
    ? (restToDriver.reduce((s, r) => s + r.rating, 0) / restToDriver.length).toFixed(2)
    : '—';
  const avgDriverToRest = driverToRest.length > 0
    ? (driverToRest.reduce((s, r) => s + r.rating, 0) / driverToRest.length).toFixed(2)
    : '—';

  // Filter
  const filtered = ratings.filter(r => {
    if (!showHidden && r.is_hidden) return false;
    if (roleFilter !== 'all' && r.rater_role !== roleFilter) return false;
    if (starsFilter > 0 && r.rating !== starsFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const raterName = r.rater_profile?.full_name?.toLowerCase() ?? '';
      const ratedName = r.rated_profile?.full_name?.toLowerCase() ?? '';
      const comment = r.comment?.toLowerCase() ?? '';
      if (!raterName.includes(q) && !ratedName.includes(q) && !comment.includes(q)) return false;
    }
    return true;
  });

  const roleLabel: Record<string, string> = {
    restaurant: 'Solicitante → Motoboy',
    driver: 'Motoboy → Solicitante',
  };

  const roleBadgeColor: Record<string, string> = {
    restaurant: 'bg-blue-100 text-blue-700',
    driver: 'bg-green-100 text-green-700',
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminPageHeader title="Avaliações" subtitle="Histórico de avaliações entre solicitantes e motoboys" />

          <main className="flex-1 p-6 space-y-6">

            {/* Stats cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                <p className="text-3xl font-extrabold text-gray-900">{avgAll}</p>
                <p className="text-xs text-gray-400 mt-1">Média geral</p>
                <div className="flex justify-center mt-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 text-amber-400 fill-amber-400" />
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                <p className="text-3xl font-extrabold text-blue-600">{avgRestToDriver}</p>
                <p className="text-xs text-gray-400 mt-1">Motoboys recebidos</p>
                <p className="text-xs text-gray-500 mt-0.5">{restToDriver.length} avaliações</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                <p className="text-3xl font-extrabold text-green-600">{avgDriverToRest}</p>
                <p className="text-xs text-gray-400 mt-1">Solicitantes recebidos</p>
                <p className="text-xs text-gray-500 mt-0.5">{driverToRest.length} avaliações</p>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por nome ou comentário..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <div className="flex gap-1.5">
                  {(['all', 'restaurant', 'driver'] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setRoleFilter(r)}
                      className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                        roleFilter === r
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {r === 'all' ? 'Todos' : r === 'restaurant' ? 'Rest→Motoboy' : 'Motoboy→Rest'}
                    </button>
                  ))}
                </div>

                <div className="flex gap-1">
                  {STARS_FILTER.map(s => (
                    <button
                      key={s}
                      onClick={() => setStarsFilter(s)}
                      className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${
                        starsFilter === s
                          ? 'bg-amber-400 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {s === 0 ? '★' : s}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowHidden(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                    showHidden ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  {showHidden ? 'Ocultas visíveis' : 'Mostrar ocultas'}
                </button>
              </div>

              <p className="text-xs text-gray-400">{filtered.length} de {totalRatings} avaliações</p>
            </div>

            {/* List */}
            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-2xl" />
                ))
              ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
                  <Star className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">Nenhuma avaliação encontrada</p>
                </div>
              ) : (
                filtered.map(rating => (
                  <div
                    key={rating.id}
                    className={`bg-white rounded-2xl shadow-sm p-4 ${rating.is_hidden ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {rating.rater_role && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleBadgeColor[rating.rater_role] ?? 'bg-gray-100 text-gray-600'}`}>
                              {roleLabel[rating.rater_role] ?? rating.rater_role}
                            </span>
                          )}
                          {rating.is_hidden && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                              Oculta
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-sm text-gray-700 mb-1">
                          <span className="font-semibold">{rating.rater_profile?.full_name ?? '—'}</span>
                          <span className="text-gray-300">→</span>
                          <span className="font-semibold">{rating.rated_profile?.full_name ?? '—'}</span>
                        </div>

                        {/* Stars */}
                        <div className="flex items-center gap-1 mb-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${i < rating.rating ? 'fill-amber-400 text-amber-400' : 'fill-gray-100 text-gray-100'}`}
                            />
                          ))}
                          <span className="text-xs text-gray-500 ml-1">{rating.rating}/5</span>
                        </div>

                        {/* Negative reasons */}
                        {rating.negative_reasons && rating.negative_reasons.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1">
                            {rating.negative_reasons.map(r => (
                              <span key={r} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100">
                                {r}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Comment */}
                        {rating.comment && (
                          <p className="text-sm text-gray-600 italic">"{rating.comment}"</p>
                        )}

                        <p className="text-xs text-gray-400 mt-1.5">
                          {new Date(rating.created_at).toLocaleString('pt-BR')}
                          {' · '}
                          Entrega {rating.delivery_id.slice(0, 8).toUpperCase()}
                        </p>
                      </div>

                      {/* Toggle hide */}
                      <button
                        onClick={() => toggleHidden.mutate({ id: rating.id, is_hidden: !rating.is_hidden })}
                        className={`flex-shrink-0 p-2 rounded-xl transition-colors ${
                          rating.is_hidden
                            ? 'bg-green-50 text-green-600 hover:bg-green-100'
                            : 'bg-red-50 text-red-500 hover:bg-red-100'
                        }`}
                        title={rating.is_hidden ? 'Tornar visível' : 'Ocultar avaliação'}
                      >
                        {rating.is_hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
