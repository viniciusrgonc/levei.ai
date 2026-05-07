import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import {
  fetchDistanceRanges, fetchProductAddons, fetchPricingConfig,
  DistanceRange, ProductAddon, PricingConfig, formatCurrency, getDistanceLabel,
} from '@/lib/pricing';
import {
  Ruler, Tag, RotateCcw, Zap, Plus, Pencil, Trash2, Loader2, X,
  ToggleLeft, ToggleRight, TrendingUp, AlertCircle,
} from 'lucide-react';

// ── Section tabs ─────────────────────────────────────────────────────────────
const TABS = [
  { key: 'distances',  label: 'Distâncias',  icon: Ruler       },
  { key: 'categories', label: 'Categorias',  icon: Tag         },
  { key: 'return',     label: 'Retorno',     icon: RotateCcw   },
  { key: 'dynamic',    label: 'Dinâmico',    icon: Zap         },
] as const;
type TabKey = typeof TABS[number]['key'];

// ── Distance Range Modal ──────────────────────────────────────────────────────
interface RangeModalProps {
  range: DistanceRange | null;
  onClose: () => void;
  onSaved: () => void;
}

function RangeModal({ range, onClose, onSaved }: RangeModalProps) {
  const [minKm, setMinKm] = useState(String(range?.min_km ?? ''));
  const [maxKm, setMaxKm] = useState(range?.max_km && range.max_km < 9999 ? String(range.max_km) : '');
  const [price, setPrice] = useState(String(range?.price ?? ''));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const min = parseFloat(minKm);
    const max = parseFloat(maxKm) || 9999;
    const p = parseFloat(price);
    if (isNaN(min) || isNaN(p) || p <= 0) {
      toast({ variant: 'destructive', title: 'Preencha todos os campos corretamente' });
      return;
    }
    setSaving(true);
    const payload = { min_km: min, max_km: max, price: p, updated_at: new Date().toISOString() };
    const { error } = range
      ? await supabase.from('pricing_distance_ranges').update(payload).eq('id', range.id)
      : await supabase.from('pricing_distance_ranges').insert(payload);
    setSaving(false);
    if (error) { toast({ variant: 'destructive', title: 'Erro', description: error.message }); return; }
    toast({ title: range ? 'Faixa atualizada!' : 'Faixa criada!' });
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-gray-900">{range ? 'Editar faixa' : 'Nova faixa'}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">De (km)</Label>
              <Input type="number" min="0" step="0.1" value={minKm} onChange={e => setMinKm(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Até (km) <span className="font-normal text-gray-400">vazio = ∞</span></Label>
              <Input type="number" min="0" step="0.1" value={maxKm} onChange={e => setMaxKm(e.target.value)} placeholder="∞" />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Valor (R$)</Label>
            <Input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="7,00" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : range ? 'Salvar' : 'Criar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminPricingManager() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>('distances');
  const [rangeModal, setRangeModal] = useState<DistanceRange | 'new' | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: ranges = [], isLoading: loadingRanges } = useQuery({
    queryKey: ['pricing-ranges'],
    queryFn: fetchDistanceRanges,
    staleTime: 30_000,
  });

  const { data: addons = [], isLoading: loadingAddons } = useQuery({
    queryKey: ['pricing-addons'],
    queryFn: fetchProductAddons,
    staleTime: 30_000,
  });

  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ['pricing-config'],
    queryFn: fetchPricingConfig,
    staleTime: 30_000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const deleteRangeMutation = useMutation({
    mutationFn: (id: string) => supabase.from('pricing_distance_ranges').delete().eq('id', id).then(({ error }) => { if (error) throw error; }),
    onSuccess: () => { toast({ title: 'Faixa removida' }); queryClient.invalidateQueries({ queryKey: ['pricing-ranges'] }); },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao remover faixa' }),
  });

  const updateAddonMutation = useMutation({
    mutationFn: async ({ id, addon_type, addon_value }: { id: string; addon_type: string; addon_value: number }) => {
      const { error } = await supabase.from('pricing_product_addons').update({ addon_type, addon_value, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: 'Adicional atualizado' }); queryClient.invalidateQueries({ queryKey: ['pricing-addons'] }); },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao atualizar adicional' }),
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (updates: Partial<PricingConfig>) => {
      if (!config) return;
      const { error } = await supabase.from('pricing_config').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', config.id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: 'Configuração salva' }); queryClient.invalidateQueries({ queryKey: ['pricing-config'] }); },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao salvar configuração' }),
  });

  // ── Local state for inline editing ───────────────────────────────────────────
  const [addonEdits, setAddonEdits] = useState<Record<string, { type: string; value: string }>>({});
  const [returnPct, setReturnPct] = useState('');
  const [dynamicMult, setDynamicMult] = useState('');
  const [dynamicDesc, setDynamicDesc] = useState('');
  const [commissionPct, setCommissionPct] = useState('');

  const configReturnPct = config?.return_percentage ?? 70;
  const configDynMult = config?.dynamic_multiplier ?? 1.0;
  const configDynDesc = config?.dynamic_description ?? '';
  const configComm = config?.platform_commission_percentage ?? 20;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-gray-50 w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminPageHeader title="Gestão de Tarifas" subtitle="Configure preços, adicionais e modo dinâmico" />

          {/* Tabs */}
          <div className="bg-white border-b border-gray-200 px-6 flex gap-0">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-colors ${
                  tab === key ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          <div className="flex-1 p-6 max-w-3xl">

            {/* ══════════ DISTÂNCIAS ══════════ */}
            {tab === 'distances' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-bold text-gray-900">Faixas de distância</h2>
                    <p className="text-sm text-gray-400 mt-0.5">O sistema aplica o valor da faixa correspondente à distância calculada</p>
                  </div>
                  <Button onClick={() => setRangeModal('new')} className="bg-primary hover:bg-primary/90 flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Nova faixa
                  </Button>
                </div>

                {loadingRanges ? (
                  <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-16 animate-pulse" />)}</div>
                ) : ranges.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center text-gray-400">
                    <Ruler className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma faixa cadastrada</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">Faixa</th>
                          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Valor</th>
                          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Status</th>
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {ranges.map(r => (
                          <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3">
                              <p className="font-semibold text-gray-900">{getDistanceLabel(r)}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-primary font-bold">{formatCurrency(r.price)}</span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => supabase.from('pricing_distance_ranges').update({ is_active: !r.is_active }).eq('id', r.id).then(() => queryClient.invalidateQueries({ queryKey: ['pricing-ranges'] }))}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${r.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
                              >
                                {r.is_active ? 'Ativa' : 'Inativa'}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 justify-end">
                                <button onClick={() => setRangeModal(r)} className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200">
                                  <Pencil className="h-3.5 w-3.5 text-gray-600" />
                                </button>
                                <button onClick={() => { if (confirm('Remover faixa?')) deleteRangeMutation.mutate(r.id); }} className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100">
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Preview calculator */}
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" /> Simulação rápida
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {ranges.filter(r => r.is_active).map(r => (
                      <div key={r.id} className="flex justify-between bg-white rounded-lg px-3 py-2">
                        <span className="text-gray-500">{getDistanceLabel(r)}</span>
                        <span className="font-bold text-gray-900">{formatCurrency(r.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════ CATEGORIAS ══════════ */}
            {tab === 'categories' && (
              <div>
                <div className="mb-4">
                  <h2 className="font-bold text-gray-900">Adicionais por categoria de produto</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Aplicados sobre o valor base de distância. Podem ser fixos (R$) ou percentuais (%).</p>
                </div>

                {loadingAddons ? (
                  <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-16 animate-pulse" />)}</div>
                ) : addons.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center text-gray-400">
                    <Tag className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma categoria com adicional</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="divide-y divide-gray-50">
                      {addons.map(addon => {
                        const edit = addonEdits[addon.id] ?? { type: addon.addon_type, value: String(addon.addon_value) };
                        const dirty = edit.type !== addon.addon_type || parseFloat(edit.value) !== addon.addon_value;
                        return (
                          <div key={addon.id} className="px-5 py-4 flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900">{addon.product_type}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {addon.addon_value === 0 ? 'Sem adicional' : addon.addon_type === 'fixed' ? `+${formatCurrency(addon.addon_value)}` : `+${addon.addon_value}%`}
                              </p>
                            </div>

                            {/* Type toggle */}
                            <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
                              {(['percentage', 'fixed'] as const).map(t => (
                                <button
                                  key={t}
                                  onClick={() => setAddonEdits(prev => ({ ...prev, [addon.id]: { ...edit, type: t } }))}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${edit.type === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
                                >
                                  {t === 'percentage' ? '%' : 'R$'}
                                </button>
                              ))}
                            </div>

                            {/* Value input */}
                            <div className="w-24">
                              <Input
                                type="number"
                                min="0"
                                step={edit.type === 'fixed' ? '0.01' : '0.5'}
                                value={edit.value}
                                onChange={e => setAddonEdits(prev => ({ ...prev, [addon.id]: { ...edit, value: e.target.value } }))}
                                className="text-sm h-9"
                              />
                            </div>

                            {/* Save */}
                            <button
                              disabled={!dirty || updateAddonMutation.isPending}
                              onClick={() => updateAddonMutation.mutate({ id: addon.id, addon_type: edit.type, addon_value: parseFloat(edit.value) || 0 })}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${dirty ? 'bg-primary text-white hover:bg-primary/90' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
                            >
                              {updateAddonMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="text-xs font-bold">✓</span>}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">Para adicionar novas categorias, acesse <strong>Tipos de Produto</strong> no menu. O adicional de preço é configurado aqui.</p>
                </div>
              </div>
            )}

            {/* ══════════ RETORNO ══════════ */}
            {tab === 'return' && (
              <div className="max-w-sm">
                <div className="mb-5">
                  <h2 className="font-bold text-gray-900">Percentual de retorno</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Quando uma entrega exige retorno ao ponto de coleta, este percentual é cobrado sobre o valor da entrega principal.</p>
                </div>

                {loadingConfig ? (
                  <div className="bg-white rounded-2xl h-32 animate-pulse" />
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">
                    <div>
                      <Label className="text-xs font-semibold text-gray-600 mb-2 block">Percentual de retorno (%)</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          type="number"
                          min="0"
                          max="200"
                          step="5"
                          defaultValue={configReturnPct}
                          onChange={e => setReturnPct(e.target.value)}
                          className="max-w-[120px]"
                        />
                        <span className="text-sm text-gray-500">% do valor da entrega</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Ex: entrega de R$12,00 → retorno = R$ {((parseFloat(returnPct) || configReturnPct) / 100 * 12).toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-gray-600 mb-2 block">Comissão da plataforma (%)</Label>
                      <div className="flex items-center gap-3">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          defaultValue={configComm}
                          onChange={e => setCommissionPct(e.target.value)}
                          className="max-w-[120px]"
                        />
                        <span className="text-sm text-gray-500">% retido pela plataforma</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Motoboy recebe {100 - (parseFloat(commissionPct) || configComm)}% do valor da entrega
                      </p>
                    </div>

                    <Button
                      className="w-full bg-primary hover:bg-primary/90"
                      onClick={() => updateConfigMutation.mutate({
                        return_percentage: parseFloat(returnPct) || configReturnPct,
                        platform_commission_percentage: parseFloat(commissionPct) || configComm,
                      })}
                      disabled={updateConfigMutation.isPending}
                    >
                      {updateConfigMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Salvar configurações
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* ══════════ DINÂMICO ══════════ */}
            {tab === 'dynamic' && (
              <div className="max-w-sm">
                <div className="mb-5">
                  <h2 className="font-bold text-gray-900">Preço dinâmico</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Multiplica automaticamente o valor final das entregas. Use em horários de pico, chuva ou alta demanda.</p>
                </div>

                {loadingConfig ? (
                  <div className="bg-white rounded-2xl h-48 animate-pulse" />
                ) : (
                  <div className="space-y-4">
                    {/* On/Off toggle */}
                    <div className={`bg-white rounded-2xl shadow-sm border p-5 flex items-center justify-between transition-all ${config?.dynamic_enabled ? 'border-amber-300' : 'border-gray-100'}`}>
                      <div>
                        <p className="font-bold text-gray-900">Modo dinâmico</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {config?.dynamic_enabled
                            ? <span className="text-amber-600 font-semibold">⚡ Ativo — multiplicador {config.dynamic_multiplier}x</span>
                            : 'Desativado — preços normais'
                          }
                        </p>
                      </div>
                      <button
                        onClick={() => updateConfigMutation.mutate({ dynamic_enabled: !config?.dynamic_enabled })}
                        disabled={updateConfigMutation.isPending}
                      >
                        {config?.dynamic_enabled
                          ? <ToggleRight className="h-8 w-8 text-amber-500" />
                          : <ToggleLeft className="h-8 w-8 text-gray-400" />
                        }
                      </button>
                    </div>

                    {/* Multiplier */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                      <div>
                        <Label className="text-xs font-semibold text-gray-600 mb-2 block">Multiplicador</Label>
                        <div className="flex items-center gap-2 flex-wrap">
                          {[1.2, 1.5, 2.0, 2.5].map(m => (
                            <button
                              key={m}
                              onClick={() => setDynamicMult(String(m))}
                              className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                                (parseFloat(dynamicMult) || configDynMult) === m
                                  ? 'bg-amber-500 text-white border-amber-500'
                                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-amber-300'
                              }`}
                            >
                              {m}x
                            </button>
                          ))}
                          <Input
                            type="number"
                            min="1"
                            max="5"
                            step="0.1"
                            value={dynamicMult || configDynMult}
                            onChange={e => setDynamicMult(e.target.value)}
                            className="w-20 text-sm"
                            placeholder="1.0"
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          Entrega de R$12,00 → com {parseFloat(dynamicMult) || configDynMult}x = <strong>R$ {((parseFloat(dynamicMult) || configDynMult) * 12).toFixed(2)}</strong>
                        </p>
                      </div>

                      <div>
                        <Label className="text-xs font-semibold text-gray-600 mb-2 block">Motivo (exibido ao solicitante)</Label>
                        <Input
                          defaultValue={configDynDesc}
                          onChange={e => setDynamicDesc(e.target.value)}
                          placeholder="Ex: Alta demanda · Horário de pico"
                        />
                      </div>

                      <Button
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={() => updateConfigMutation.mutate({
                          dynamic_multiplier: parseFloat(dynamicMult) || configDynMult,
                          dynamic_description: dynamicDesc || configDynDesc,
                        })}
                        disabled={updateConfigMutation.isPending}
                      >
                        {updateConfigMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                        Aplicar configuração
                      </Button>
                    </div>

                    {config?.dynamic_enabled && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
                        <Zap className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">
                          <strong>Modo dinâmico ativo!</strong> Todas as novas entregas terão preço multiplicado por {config.dynamic_multiplier}x.
                          {config.dynamic_description && ` Motivo: "${config.dynamic_description}".`}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Range modal */}
      {rangeModal !== null && (
        <RangeModal
          range={rangeModal === 'new' ? null : rangeModal}
          onClose={() => setRangeModal(null)}
          onSaved={() => { setRangeModal(null); queryClient.invalidateQueries({ queryKey: ['pricing-ranges'] }); }}
        />
      )}
    </SidebarProvider>
  );
}
