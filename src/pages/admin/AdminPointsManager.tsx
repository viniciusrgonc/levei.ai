import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { toast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Search, Trophy, Plus, Minus, SlidersHorizontal, Zap,
  User, Loader2, History, ChevronRight, AlertTriangle,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DriverRow {
  id: string;
  user_id: string;
  points: number;
  total_deliveries: number | null;
  profile_name: string;
  profile_phone: string | null;
  avatar_url: string | null;
}

interface Adjustment {
  id: string;
  driver_id: string;
  admin_id: string;
  amount: number;
  type: string;
  observation: string | null;
  created_at: string;
}

type AdjType = 'bonus' | 'removal' | 'adjustment' | 'campaign';

const TYPE_CONFIG: Record<AdjType, { label: string; color: string; bg: string; icon: typeof Plus }> = {
  bonus:      { label: 'Bônus',    color: 'text-green-700',  bg: 'bg-green-100',  icon: Plus  },
  removal:    { label: 'Remoção',  color: 'text-red-700',    bg: 'bg-red-100',    icon: Minus },
  adjustment: { label: 'Ajuste',   color: 'text-blue-700',   bg: 'bg-blue-100',   icon: SlidersHorizontal },
  campaign:   { label: 'Campanha', color: 'text-purple-700', bg: 'bg-purple-100', icon: Zap   },
};

const OBSERVATION_SUGGESTIONS: Record<AdjType, string[]> = {
  bonus:      ['Bônus por alta performance', 'Meta semanal atingida', 'Motoboy destaque do mês'],
  removal:    ['Correção de pontos indevidos', 'Penalidade por cancelamento', 'Ajuste de inconsistência'],
  adjustment: ['Correção manual', 'Ajuste de sistema', 'Reprocessamento de entrega'],
  campaign:   ['Campanha final de semana', 'Campanha horário de pico', 'Promoção relâmpago'],
};

// ── Queries ──────────────────────────────────────────────────────────────────
async function fetchDrivers(): Promise<DriverRow[]> {
  const { data: drivers, error } = await supabase
    .from('drivers')
    .select('id, user_id, points, total_deliveries')
    .order('points', { ascending: false });
  if (error) throw error;

  const enriched = await Promise.all(
    (drivers ?? []).map(async (d) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, avatar_url')
        .eq('id', d.user_id)
        .single();
      return {
        ...d,
        profile_name: profile?.full_name ?? 'Sem nome',
        profile_phone: profile?.phone ?? null,
        avatar_url: (profile as any)?.avatar_url ?? null,
      };
    })
  );
  return enriched;
}

async function fetchAdjustments(driverId: string): Promise<Adjustment[]> {
  const { data, error } = await (supabase as any)
    .from('point_adjustments')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

// ── KPI helpers ──────────────────────────────────────────────────────────────
function KpiCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-2xl px-5 py-4 shadow-sm border border-gray-100 flex-1 min-w-0">
      <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminPointsManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DriverRow | null>(null);

  // Form state
  const [adjType, setAdjType] = useState<AdjType>('bonus');
  const [amount, setAmount] = useState('');
  const [observation, setObservation] = useState('');

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: drivers = [], isLoading: loadingDrivers } = useQuery({
    queryKey: ['admin-drivers-points'],
    queryFn: fetchDrivers,
    staleTime: 60_000,
  });

  const { data: history = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['point-adjustments', selected?.id],
    queryFn: () => fetchAdjustments(selected!.id),
    enabled: !!selected,
    staleTime: 15_000,
  });

  // ── Mutation ──────────────────────────────────────────────────────────────
  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !user) throw new Error('Selecione um motoboy');
      const pts = parseInt(amount, 10);
      if (!pts || pts <= 0) throw new Error('Quantidade inválida');

      const delta = adjType === 'removal' ? -pts : pts;
      const newPoints = selected.points + delta;

      if (newPoints < 0) throw new Error('Saldo não pode ser negativo');

      // Update driver points
      const { error: updateError } = await supabase
        .from('drivers')
        .update({ points: newPoints, updated_at: new Date().toISOString() })
        .eq('id', selected.id);
      if (updateError) throw updateError;

      // Insert adjustment record
      const { error: insertError } = await (supabase as any)
        .from('point_adjustments')
        .insert({
          driver_id: selected.id,
          admin_id: user.id,
          amount: delta,
          type: adjType,
          observation: observation.trim() || null,
        });
      if (insertError) throw insertError;

      return newPoints;
    },
    onSuccess: (newPoints) => {
      // Optimistically update selected driver
      setSelected((prev) => prev ? { ...prev, points: newPoints } : prev);
      setAmount('');
      setObservation('');
      toast({ title: '✅ Pontos ajustados com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['admin-drivers-points'] });
      queryClient.invalidateQueries({ queryKey: ['point-adjustments', selected?.id] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    },
  });

  // ── Derived ───────────────────────────────────────────────────────────────
  const filtered = drivers.filter((d) =>
    d.profile_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPtsAdded = history
    .filter((h) => h.amount > 0)
    .reduce((acc, h) => acc + h.amount, 0);

  const totalPtsRemoved = history
    .filter((h) => h.amount < 0)
    .reduce((acc, h) => acc + Math.abs(h.amount), 0);

  const TypeIcon = TYPE_CONFIG[adjType].icon;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-gray-50 w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminPageHeader
            title="Gerenciar Pontos"
            subtitle="Adicione, remova ou ajuste pontos dos motoboys"
          />

          <div className="flex-1 p-6 grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-6 items-start">

            {/* ── LEFT: Driver selector ── */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar motoboy..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {loadingDrivers ? (
                <div className="space-y-2">
                  {[1,2,3,4].map((i) => (
                    <div key={i} className="bg-white rounded-2xl h-16 animate-pulse" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center text-gray-400 border border-dashed border-gray-200">
                  <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum motoboy encontrado</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[calc(100vh-240px)] overflow-y-auto pr-1">
                  {filtered.map((d) => {
                    const isSelected = selected?.id === d.id;
                    return (
                      <button
                        key={d.id}
                        onClick={() => setSelected(d)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all border ${
                          isSelected
                            ? 'bg-primary/5 border-primary/30 shadow-sm'
                            : 'bg-white border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {d.avatar_url ? (
                            <img src={d.avatar_url} alt={d.profile_name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-amber-600 font-bold text-sm">
                              {d.profile_name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{d.profile_name}</p>
                          <p className="text-gray-400 text-xs">{d.total_deliveries ?? 0} entregas</p>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className="text-amber-600 font-black text-sm">{d.points}</p>
                          <p className="text-gray-400 text-[10px]">pts</p>
                        </div>

                        <ChevronRight className={`h-4 w-4 flex-shrink-0 transition-colors ${isSelected ? 'text-primary' : 'text-gray-300'}`} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── RIGHT: Adjustment panel ── */}
            {!selected ? (
              <div className="bg-white rounded-2xl p-16 flex flex-col items-center justify-center text-center border border-dashed border-gray-200 text-gray-400">
                <Trophy className="h-12 w-12 mb-4 opacity-20" />
                <p className="font-semibold text-gray-600">Selecione um motoboy</p>
                <p className="text-sm mt-1">Escolha à esquerda para ajustar os pontos</p>
              </div>
            ) : (
              <div className="space-y-5">

                {/* Driver summary card */}
                <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {selected.avatar_url ? (
                        <img src={selected.avatar_url} alt={selected.profile_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl font-black text-white">
                          {selected.profile_name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-lg leading-tight truncate">{selected.profile_name}</p>
                      <p className="text-amber-100 text-sm">{selected.total_deliveries ?? 0} entregas no total</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-amber-100 text-xs mb-0.5">Saldo atual</p>
                      <p className="text-white text-4xl font-black leading-none">{selected.points}</p>
                      <p className="text-amber-200 text-xs mt-0.5">pontos</p>
                    </div>
                  </div>
                </div>

                {/* KPIs for this driver */}
                {selected && (
                  <div className="flex gap-3">
                    <KpiCard label="Pontos adicionados" value={`+${totalPtsAdded}`} color="text-green-600" />
                    <KpiCard label="Pontos removidos" value={`-${totalPtsRemoved}`} color="text-red-500" />
                    <KpiCard label="Ajustes totais" value={history.length} color="text-gray-800" />
                  </div>
                )}

                {/* Adjustment form + history — side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">

                  {/* Form */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                    <h2 className="font-bold text-gray-900">Novo ajuste</h2>

                    {/* Type selector */}
                    <div>
                      <Label className="text-xs font-semibold text-gray-500 mb-2 block">Tipo de ajuste</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.entries(TYPE_CONFIG) as [AdjType, typeof TYPE_CONFIG[AdjType]][]).map(([key, cfg]) => {
                          const Icon = cfg.icon;
                          return (
                            <button
                              key={key}
                              onClick={() => setAdjType(key)}
                              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                                adjType === key
                                  ? `${cfg.bg} ${cfg.color} border-current`
                                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                              {cfg.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Amount */}
                    <div>
                      <Label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                        Quantidade de pontos *
                      </Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Ex: 100"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="text-lg font-bold"
                      />
                      {amount && (
                        <p className={`text-xs mt-1.5 font-semibold ${adjType === 'removal' ? 'text-red-500' : 'text-green-600'}`}>
                          {adjType === 'removal' ? '−' : '+'}{amount} pontos →{' '}
                          saldo: {Math.max(0, selected.points + (adjType === 'removal' ? -parseInt(amount||'0') : parseInt(amount||'0')))} pts
                        </p>
                      )}
                      {adjType === 'removal' && amount && selected.points - parseInt(amount||'0') < 0 && (
                        <div className="flex items-center gap-1.5 mt-2 text-red-600 bg-red-50 rounded-xl px-3 py-2">
                          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                          <p className="text-xs font-medium">Saldo ficaria negativo — operação não permitida</p>
                        </div>
                      )}
                    </div>

                    {/* Observation */}
                    <div>
                      <Label className="text-xs font-semibold text-gray-500 mb-1.5 block">
                        Observação / Motivo
                      </Label>
                      <textarea
                        value={observation}
                        onChange={(e) => setObservation(e.target.value)}
                        placeholder="Descreva o motivo do ajuste..."
                        rows={3}
                        className="w-full text-sm border border-input rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                      />
                      {/* Quick suggestions */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {OBSERVATION_SUGGESTIONS[adjType].map((sug) => (
                          <button
                            key={sug}
                            onClick={() => setObservation(sug)}
                            className="text-[11px] px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button
                      className="w-full h-11 bg-primary hover:bg-primary/90 font-bold"
                      onClick={() => adjustMutation.mutate()}
                      disabled={adjustMutation.isPending || !amount || parseInt(amount) <= 0}
                    >
                      {adjustMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <TypeIcon className="h-4 w-4 mr-2" />
                          Aplicar {TYPE_CONFIG[adjType].label}
                        </>
                      )}
                    </Button>
                  </div>

                  {/* History */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <History className="h-4 w-4 text-gray-400" />
                      <h2 className="font-bold text-gray-900">Histórico</h2>
                    </div>

                    {loadingHistory ? (
                      <div className="space-y-3">
                        {[1,2,3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
                      </div>
                    ) : history.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                        <History className="h-8 w-8 mb-2 opacity-30" />
                        <p className="text-sm">Nenhum ajuste registrado</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {history.map((adj) => {
                          const typeCfg = TYPE_CONFIG[adj.type as AdjType] ?? TYPE_CONFIG.adjustment;
                          const isPositive = adj.amount > 0;
                          return (
                            <div key={adj.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-50 bg-gray-50/50">
                              <div className={`w-8 h-8 rounded-lg ${typeCfg.bg} flex items-center justify-center flex-shrink-0`}>
                                <span className={`text-xs font-black ${typeCfg.color}`}>
                                  {isPositive ? '+' : '−'}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className={`font-bold text-sm ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                                    {isPositive ? '+' : ''}{adj.amount} pts
                                  </span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${typeCfg.bg} ${typeCfg.color}`}>
                                    {typeCfg.label}
                                  </span>
                                </div>
                                {adj.observation && (
                                  <p className="text-gray-500 text-xs mt-0.5 truncate">{adj.observation}</p>
                                )}
                                <p className="text-gray-300 text-[10px] mt-0.5">
                                  {new Date(adj.created_at).toLocaleString('pt-BR', {
                                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                                  })}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
