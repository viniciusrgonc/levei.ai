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
  Zap, Plus, X, Loader2, Pencil, Trash2,
  ToggleLeft, ToggleRight, Calendar, Star,
  Clock, Tag, Ruler, Sun,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Campaign {
  id: string;
  name: string;
  multiplier: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  product_type_filter: string | null;
  min_distance_km: number | null;
  weekdays_only: boolean;
  night_hours_only: boolean;
  created_by: string | null;
  created_at: string;
}

interface CampaignForm {
  name: string;
  multiplier: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  product_type_filter: string;
  min_distance_km: string;
  weekdays_only: boolean;
  night_hours_only: boolean;
}

const DEFAULT_FORM: CampaignForm = {
  name: '',
  multiplier: '2',
  starts_at: '',
  ends_at: '',
  is_active: true,
  product_type_filter: '',
  min_distance_km: '',
  weekdays_only: false,
  night_hours_only: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function campaignStatus(c: Campaign): 'active' | 'upcoming' | 'expired' | 'paused' {
  if (!c.is_active) return 'paused';
  const now = new Date();
  const start = new Date(c.starts_at);
  const end = new Date(c.ends_at);
  if (now < start) return 'upcoming';
  if (now > end) return 'expired';
  return 'active';
}

const STATUS_LABELS: Record<string, { label: string; dot: string; badge: string }> = {
  active:   { label: 'Ativa',     dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700 border-green-200' },
  upcoming: { label: 'Em breve',  dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700 border-blue-200'   },
  expired:  { label: 'Encerrada', dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-500 border-gray-200'   },
  paused:   { label: 'Pausada',   dot: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700 border-amber-200' },
};

const MULTIPLIER_COLOR: Record<number, string> = {
  2: 'from-blue-500 to-indigo-600',
  3: 'from-purple-500 to-purple-700',
  4: 'from-amber-500 to-orange-600',
  5: 'from-red-500 to-rose-600',
};

function multiplierGradient(m: number): string {
  return MULTIPLIER_COLOR[m] ?? 'from-primary to-primary/80';
}

function formatDt(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function localDatetimeToISO(local: string): string {
  // local = "YYYY-MM-DDTHH:mm" → add seconds + timezone
  return local ? new Date(local).toISOString() : '';
}

function isoToLocalDatetime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Queries ───────────────────────────────────────────────────────────────────
async function fetchCampaigns(): Promise<Campaign[]> {
  const { data, error } = await (supabase as any)
    .from('reward_campaigns')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ── Modal ─────────────────────────────────────────────────────────────────────
interface CampaignModalProps {
  campaign: Campaign | null;
  onClose: () => void;
  onSaved: () => void;
  adminId: string;
}

function CampaignModal({ campaign, onClose, onSaved, adminId }: CampaignModalProps) {
  const [form, setForm] = useState<CampaignForm>(
    campaign
      ? {
          name: campaign.name,
          multiplier: String(campaign.multiplier),
          starts_at: isoToLocalDatetime(campaign.starts_at),
          ends_at: isoToLocalDatetime(campaign.ends_at),
          is_active: campaign.is_active,
          product_type_filter: campaign.product_type_filter ?? '',
          min_distance_km: campaign.min_distance_km ? String(campaign.min_distance_km) : '',
          weekdays_only: campaign.weekdays_only,
          night_hours_only: campaign.night_hours_only,
        }
      : DEFAULT_FORM
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof CampaignForm>(key: K, val: CampaignForm[K]) =>
    setForm((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.starts_at || !form.ends_at) {
      toast({ variant: 'destructive', title: 'Campos obrigatórios', description: 'Preencha nome, início e fim.' });
      return;
    }
    const mult = parseFloat(form.multiplier);
    if (!mult || mult < 1.1 || mult > 10) {
      toast({ variant: 'destructive', title: 'Multiplicador inválido', description: 'Use um valor entre 1.1x e 10x.' });
      return;
    }

    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      multiplier: mult,
      starts_at: localDatetimeToISO(form.starts_at),
      ends_at: localDatetimeToISO(form.ends_at),
      is_active: form.is_active,
      product_type_filter: form.product_type_filter.trim() || null,
      min_distance_km: form.min_distance_km ? parseFloat(form.min_distance_km) : null,
      weekdays_only: form.weekdays_only,
      night_hours_only: form.night_hours_only,
    };
    if (!campaign) payload.created_by = adminId;

    const { error } = campaign
      ? await (supabase as any).from('reward_campaigns').update(payload).eq('id', campaign.id)
      : await (supabase as any).from('reward_campaigns').insert(payload);

    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } else {
      toast({ title: campaign ? '✅ Campanha atualizada!' : '🎉 Campanha criada!' });
      onSaved();
    }
  };

  const multVal = parseFloat(form.multiplier) || 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 overflow-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{campaign ? 'Editar campanha' : 'Nova campanha'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Multiplier preview */}
          <div className={`bg-gradient-to-br ${multiplierGradient(Math.floor(multVal))} rounded-2xl p-4 text-center text-white`}>
            <p className="text-white/70 text-xs mb-1">Multiplicador de pontos</p>
            <p className="text-6xl font-black leading-none">{multVal}×</p>
            <p className="text-white/80 text-sm mt-2">
              Entrega normal: 10 pts → Campanha: <strong>{Math.round(10 * multVal)} pts</strong>
            </p>
          </div>

          {/* Name */}
          <div>
            <Label className="text-xs font-semibold text-gray-500 mb-1.5 block">Nome da campanha *</Label>
            <Input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Ex: Campanha Final de Semana"
            />
          </div>

          {/* Multiplier */}
          <div>
            <Label className="text-xs font-semibold text-gray-500 mb-1.5 block">Multiplicador *</Label>
            <div className="flex gap-2 items-center">
              <input
                type="range"
                min="1.5"
                max="5"
                step="0.5"
                value={form.multiplier}
                onChange={(e) => set('multiplier', e.target.value)}
                className="flex-1 h-2 accent-primary cursor-pointer"
              />
              <div className="flex items-center gap-1 bg-primary/10 rounded-xl px-3 py-1.5">
                <span className="font-black text-primary text-lg">{form.multiplier}×</span>
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>1.5×</span><span>2×</span><span>2.5×</span><span>3×</span><span>3.5×</span><span>4×</span><span>4.5×</span><span>5×</span>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-gray-500 mb-1.5 block flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Início *
              </Label>
              <Input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => set('starts_at', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-500 mb-1.5 block flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Fim *
              </Label>
              <Input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => set('ends_at', e.target.value)}
              />
            </div>
          </div>

          {/* Filters section */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filtros opcionais</p>

            <div>
              <Label className="text-xs font-semibold text-gray-500 mb-1.5 block flex items-center gap-1">
                <Tag className="h-3 w-3" /> Tipo de produto específico
              </Label>
              <Input
                value={form.product_type_filter}
                onChange={(e) => set('product_type_filter', e.target.value)}
                placeholder="Ex: Alimentos  (vazio = todos)"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-500 mb-1.5 block flex items-center gap-1">
                <Ruler className="h-3 w-3" /> Distância mínima (km)
              </Label>
              <Input
                type="number"
                min="0"
                step="0.5"
                value={form.min_distance_km}
                onChange={(e) => set('min_distance_km', e.target.value)}
                placeholder="Ex: 5  (vazio = sem mínimo)"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => set('weekdays_only', !form.weekdays_only)}
                className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  form.weekdays_only
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-white text-gray-400 border-gray-200'
                }`}
              >
                <Sun className="h-4 w-4" /> Apenas fins de semana
              </button>
              <button
                onClick={() => set('night_hours_only', !form.night_hours_only)}
                className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  form.night_hours_only
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-white text-gray-400 border-gray-200'
                }`}
              >
                <Clock className="h-4 w-4" /> Apenas horário noturno
              </button>
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Campanha ativa</p>
              <p className="text-xs text-gray-400">Visível e aplicada automaticamente nas entregas</p>
            </div>
            <button onClick={() => set('is_active', !form.is_active)}>
              {form.is_active
                ? <ToggleRight className="h-7 w-7 text-green-600" />
                : <ToggleLeft className="h-7 w-7 text-gray-400" />
              }
            </button>
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : campaign ? 'Salvar' : 'Criar campanha'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminCampaigns() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<Campaign | 'new' | null>(null);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['admin-reward-campaigns'],
    queryFn: fetchCampaigns,
    staleTime: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from('reward_campaigns')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-reward-campaigns'] }),
    onError: () => toast({ variant: 'destructive', title: 'Erro ao alterar status' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('reward_campaigns')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Campanha removida' });
      queryClient.invalidateQueries({ queryKey: ['admin-reward-campaigns'] });
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao remover campanha' }),
  });

  // KPIs
  const activeCount   = campaigns.filter((c) => campaignStatus(c) === 'active').length;
  const upcomingCount = campaigns.filter((c) => campaignStatus(c) === 'upcoming').length;
  const expiredCount  = campaigns.filter((c) => campaignStatus(c) === 'expired').length;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-gray-50 w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminPageHeader
            title="Campanhas de Recompensa"
            subtitle="Crie campanhas com multiplicador automático de pontos"
          />

          <div className="flex-1 p-6 space-y-6">

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  <p className="text-xs text-gray-400 font-medium">Ativas agora</p>
                </div>
                <p className="text-3xl font-black text-gray-900">{activeCount}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <p className="text-xs text-gray-400 font-medium">Em breve</p>
                </div>
                <p className="text-3xl font-black text-gray-900">{upcomingCount}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                  <p className="text-xs text-gray-400 font-medium">Encerradas</p>
                </div>
                <p className="text-3xl font-black text-gray-900">{expiredCount}</p>
              </div>
            </div>

            {/* Header + button */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-600">
                {campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''} no total
              </p>
              <Button
                onClick={() => setModal('new')}
                className="bg-primary hover:bg-primary/90 flex items-center gap-2"
              >
                <Plus className="h-4 w-4" /> Nova campanha
              </Button>
            </div>

            {/* Campaign list */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1,2,3].map((i) => <div key={i} className="bg-white rounded-2xl h-48 animate-pulse" />)}
              </div>
            ) : campaigns.length === 0 ? (
              <div className="bg-white rounded-2xl p-16 text-center border border-dashed border-gray-200">
                <Zap className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                <p className="font-semibold text-gray-500">Nenhuma campanha criada</p>
                <p className="text-sm text-gray-400 mt-1">Crie sua primeira campanha de pontos em dobro</p>
                <Button
                  onClick={() => setModal('new')}
                  className="mt-4 bg-primary hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4 mr-2" /> Criar campanha
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {campaigns.map((c) => {
                  const st = campaignStatus(c);
                  const stCfg = STATUS_LABELS[st];
                  const mult = Number(c.multiplier);

                  return (
                    <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      {/* Top banner with multiplier */}
                      <div className={`bg-gradient-to-br ${multiplierGradient(Math.floor(mult))} p-4`}>
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-white/70 text-xs mb-0.5">Multiplicador</p>
                            <p className="text-white text-4xl font-black leading-none">{mult}×</p>
                          </div>
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${stCfg.badge} bg-white/90`}>
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${stCfg.dot} mr-1 align-middle`} />
                            {stCfg.label}
                          </span>
                        </div>
                      </div>

                      <div className="p-4">
                        <h3 className="font-bold text-gray-900 text-sm leading-snug mb-3 line-clamp-2">{c.name}</h3>

                        {/* Dates */}
                        <div className="space-y-1 mb-3">
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Início: {formatDt(c.starts_at)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Fim: {formatDt(c.ends_at)}</span>
                          </div>
                        </div>

                        {/* Filters */}
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {c.product_type_filter && (
                            <span className="flex items-center gap-1 text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                              <Tag className="h-3 w-3" /> {c.product_type_filter}
                            </span>
                          )}
                          {c.min_distance_km && (
                            <span className="flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                              <Ruler className="h-3 w-3" /> +{c.min_distance_km} km
                            </span>
                          )}
                          {c.weekdays_only && (
                            <span className="flex items-center gap-1 text-[11px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                              <Sun className="h-3 w-3" /> Final de semana
                            </span>
                          )}
                          {c.night_hours_only && (
                            <span className="flex items-center gap-1 text-[11px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
                              <Clock className="h-3 w-3" /> Noturno
                            </span>
                          )}
                          {!c.product_type_filter && !c.min_distance_km && !c.weekdays_only && !c.night_hours_only && (
                            <span className="text-[11px] text-gray-400">Sem filtros — todas as entregas</span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleMutation.mutate({ id: c.id, is_active: !c.is_active })}
                            title={c.is_active ? 'Pausar' : 'Ativar'}
                            className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                          >
                            {c.is_active
                              ? <ToggleRight className="h-4 w-4 text-green-600" />
                              : <ToggleLeft className="h-4 w-4 text-gray-400" />
                            }
                          </button>
                          <button
                            onClick={() => setModal(c)}
                            className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5 text-gray-600" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Remover a campanha "${c.name}"?`)) deleteMutation.mutate(c.id);
                            }}
                            className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {modal !== null && (
        <CampaignModal
          campaign={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            queryClient.invalidateQueries({ queryKey: ['admin-reward-campaigns'] });
          }}
          adminId={user?.id ?? ''}
        />
      )}
    </SidebarProvider>
  );
}
