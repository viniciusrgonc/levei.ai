import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { toast } from '@/hooks/use-toast';
import {
  ShoppingBag, Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  Package, Star, Users, Zap, Clock, CheckCircle, Truck,
  X, Loader2, ImageOff, Search,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  created_at: string;
}

interface Redemption {
  id: string;
  driver_id: string;
  item_id: string;
  points_used: number;
  status: string;
  created_at: string;
  store_items: { name: string } | null;
  drivers: { name: string | null; user_id: string } | null;
}

// ── Config ───────────────────────────────────────────────────────────────────
const CATEGORY_OPTIONS = [
  { value: 'equipment', label: 'Equipamentos', icon: Package,     color: 'text-blue-600',   bg: 'bg-blue-50'   },
  { value: 'benefits',  label: 'Benefícios',   icon: Star,        color: 'text-amber-600',  bg: 'bg-amber-50'  },
  { value: 'partners',  label: 'Parceiros',    icon: Users,       color: 'text-green-600',  bg: 'bg-green-50'  },
  { value: 'platform',  label: 'Plataforma',   icon: Zap,         color: 'text-purple-600', bg: 'bg-purple-50' },
];

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  pending:  { label: 'Pendente',  badge: 'secondary' },
  approved: { label: 'Aprovado',  badge: 'default'   },
  delivered:{ label: 'Entregue',  badge: 'default'   },
};

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700 border-amber-200',
  approved:  'bg-blue-100 text-blue-700 border-blue-200',
  delivered: 'bg-green-100 text-green-700 border-green-200',
};

// ── Queries ──────────────────────────────────────────────────────────────────
async function fetchItems(): Promise<StoreItem[]> {
  const { data, error } = await supabase
    .from('store_items')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function fetchRedemptions(): Promise<Redemption[]> {
  const { data, error } = await supabase
    .from('store_redemptions')
    .select('*, store_items(name), drivers(name, user_id)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as Redemption[];
}

// ── Modal for item CRUD ──────────────────────────────────────────────────────
interface ItemFormState {
  name: string;
  description: string;
  category: string;
  image_url: string;
  points_cost: string;
  stock: string;
  is_active: boolean;
}

const DEFAULT_FORM: ItemFormState = {
  name: '', description: '', category: 'equipment',
  image_url: '', points_cost: '', stock: '-1', is_active: true,
};

interface ItemModalProps {
  item: StoreItem | null;
  onClose: () => void;
  onSaved: () => void;
}

function ItemModal({ item, onClose, onSaved }: ItemModalProps) {
  const [form, setForm] = useState<ItemFormState>(
    item
      ? {
          name: item.name,
          description: item.description,
          category: item.category,
          image_url: item.image_url ?? '',
          points_cost: String(item.points_cost),
          stock: String(item.stock),
          is_active: item.is_active,
        }
      : DEFAULT_FORM
  );
  const [saving, setSaving] = useState(false);

  const set = (key: keyof ItemFormState, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.description.trim() || !form.points_cost) {
      toast({ variant: 'destructive', title: 'Campos obrigatórios', description: 'Preencha nome, descrição e custo em pontos.' });
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      image_url: form.image_url.trim() || null,
      points_cost: parseInt(form.points_cost, 10) || 0,
      stock: parseInt(form.stock, 10) ?? -1,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };
    const { error } = item
      ? await supabase.from('store_items').update(payload).eq('id', item.id)
      : await supabase.from('store_items').insert(payload);
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } else {
      toast({ title: item ? 'Item atualizado!' : 'Item criado!' });
      onSaved();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">{item ? 'Editar item' : 'Novo item'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Nome *</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex: Capa de Chuva" />
          </div>

          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Descrição *</Label>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Descreva o item..."
              rows={3}
              className="w-full text-sm border border-input rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Categoria *</Label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_OPTIONS.map(({ value, label, icon: Icon, color, bg }) => (
                <button
                  key={value}
                  onClick={() => set('category', value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    form.category === value
                      ? `${bg} ${color} border-current`
                      : 'bg-gray-50 text-gray-500 border-gray-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">Custo (pontos) *</Label>
              <Input
                type="number"
                min="1"
                value={form.points_cost}
                onChange={(e) => set('points_cost', e.target.value)}
                placeholder="500"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">
                Estoque <span className="font-normal text-gray-400">(-1 = ilimitado)</span>
              </Label>
              <Input
                type="number"
                min="-1"
                value={form.stock}
                onChange={(e) => set('stock', e.target.value)}
                placeholder="-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-1.5 block">URL da imagem (opcional)</Label>
            <Input
              value={form.image_url}
              onChange={(e) => set('image_url', e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Item ativo</p>
              <p className="text-xs text-gray-400">Visível para os motoboys</p>
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
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : item ? 'Salvar alterações' : 'Criar item'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function AdminPointsStore() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'items' | 'redemptions'>('items');
  const [modal, setModal] = useState<'new' | StoreItem | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ['admin-store-items'],
    queryFn: fetchItems,
    staleTime: 30_000,
  });

  const { data: redemptions = [], isLoading: loadingRedemptions } = useQuery({
    queryKey: ['admin-store-redemptions'],
    queryFn: fetchRedemptions,
    staleTime: 30_000,
  });

  // ── Realtime: notifica novo resgate ─────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('admin-store-redemptions-rt')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'store_redemptions',
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['admin-store-redemptions'] });
        // Toast de alerta para o admin
        toast({
          title: '🎁 Novo resgate de pontos!',
          description: 'Um motoboy acabou de resgatar um item da loja.',
        });
        // Muda automaticamente para a aba de resgates para o admin ver
        setTab('redemptions');
        setStatusFilter('pending');
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const pendingRedemptions = redemptions.filter((r) => r.status === 'pending').length;

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('store_items').update({ is_active, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-store-items'] }),
    onError: () => toast({ variant: 'destructive', title: 'Erro ao alterar status' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('store_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Item removido' });
      queryClient.invalidateQueries({ queryKey: ['admin-store-items'] });
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao remover item' }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('store_redemptions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Status atualizado' });
      queryClient.invalidateQueries({ queryKey: ['admin-store-redemptions'] });
    },
    onError: () => toast({ variant: 'destructive', title: 'Erro ao atualizar status' }),
  });

  const filteredItems = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredRedemptions = statusFilter === 'all'
    ? redemptions
    : redemptions.filter((r) => r.status === statusFilter);

  const catInfo = (cat: string) => CATEGORY_OPTIONS.find((c) => c.value === cat);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-gray-50 w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AdminPageHeader title="Loja de Pontos" subtitle="Gerencie itens e resgates dos motoboys" />

          {/* Tabs */}
          <div className="bg-white border-b border-gray-200 px-6 flex gap-1">
            <button
              onClick={() => setTab('items')}
              className={`py-3 px-1 text-sm font-semibold border-b-2 mr-6 transition-colors ${
                tab === 'items' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Itens ({items.length})
            </button>
            <button
              onClick={() => setTab('redemptions')}
              className={`py-3 px-1 text-sm font-semibold border-b-2 mr-6 transition-colors flex items-center gap-2 ${
                tab === 'redemptions' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              Resgates ({redemptions.length})
              {pendingRedemptions > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                  {pendingRedemptions > 9 ? '9+' : pendingRedemptions}
                </span>
              )}
            </button>
          </div>

          <div className="flex-1 p-6">

            {/* ── Items tab ── */}
            {tab === 'items' && (
              <>
                <div className="flex items-center justify-between mb-4 gap-3">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar item..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button
                    onClick={() => setModal('new')}
                    className="bg-primary hover:bg-primary/90 flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" /> Novo item
                  </Button>
                </div>

                {loadingItems ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-white rounded-2xl h-40 animate-pulse" />
                    ))}
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-dashed border-gray-200">
                    <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Nenhum item encontrado</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredItems.map((item) => {
                      const cat = catInfo(item.category);
                      const Icon = cat?.icon ?? Package;
                      return (
                        <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                          {/* Image area */}
                          <div className={`h-24 ${cat?.bg ?? 'bg-gray-100'} flex items-center justify-center relative`}>
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <Icon className={`h-10 w-10 ${cat?.color ?? 'text-gray-400'} opacity-40`} />
                            )}
                            {!item.is_active && (
                              <div className="absolute inset-0 bg-gray-900/40 flex items-center justify-center">
                                <span className="text-white text-xs font-bold bg-gray-700 px-2 py-0.5 rounded-full">Inativo</span>
                              </div>
                            )}
                          </div>

                          <div className="p-4">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="font-bold text-gray-900 text-sm leading-snug line-clamp-1">{item.name}</p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${cat?.bg ?? 'bg-gray-100'} ${cat?.color ?? 'text-gray-500'}`}>
                                {cat?.label ?? item.category}
                              </span>
                            </div>
                            <p className="text-gray-400 text-xs line-clamp-2 mb-3">{item.description}</p>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <span className="text-amber-600 font-black text-sm">{item.points_cost} pts</span>
                                <span className="text-gray-300 text-xs">·</span>
                                <span className="text-gray-400 text-xs">
                                  {item.stock === -1 ? '∞ estoque' : `${item.stock} un`}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => toggleActiveMutation.mutate({ id: item.id, is_active: !item.is_active })}
                                  title={item.is_active ? 'Desativar' : 'Ativar'}
                                  className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                                >
                                  {item.is_active
                                    ? <ToggleRight className="h-4 w-4 text-green-600" />
                                    : <ToggleLeft className="h-4 w-4 text-gray-400" />
                                  }
                                </button>
                                <button
                                  onClick={() => setModal(item)}
                                  className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                                >
                                  <Pencil className="h-3.5 w-3.5 text-gray-600" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Remover "${item.name}"?`)) deleteMutation.mutate(item.id);
                                  }}
                                  className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── Redemptions tab ── */}
            {tab === 'redemptions' && (
              <>
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  {(['all', 'pending', 'approved', 'delivered'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        statusFilter === s
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {s === 'all' ? 'Todos' : STATUS_CONFIG[s]?.label ?? s}
                    </button>
                  ))}
                </div>

                {loadingRedemptions ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => <div key={i} className="bg-white rounded-2xl h-20 animate-pulse" />)}
                  </div>
                ) : filteredRedemptions.length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-dashed border-gray-200">
                    <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Nenhum resgate encontrado</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Motoboy</th>
                          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Item</th>
                          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Pontos</th>
                          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Data</th>
                          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Status</th>
                          <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredRedemptions.map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
                                {r.drivers?.name ?? 'Motoboy'}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-gray-700 truncate max-w-[150px]">
                                {r.store_items?.name ?? 'Item removido'}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-amber-600 font-bold text-sm">{r.points_used}</span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-xs text-gray-400">
                                {new Date(r.created_at).toLocaleDateString('pt-BR', {
                                  day: '2-digit', month: 'short',
                                })}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[r.status] ?? STATUS_COLORS.pending}`}>
                                {STATUS_CONFIG[r.status]?.label ?? r.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={r.status}
                                onChange={(e) => updateStatusMutation.mutate({ id: r.id, status: e.target.value })}
                                className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                              >
                                <option value="pending">Pendente</option>
                                <option value="approved">Aprovado</option>
                                <option value="delivered">Entregue</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {modal !== null && (
        <ItemModal
          item={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            queryClient.invalidateQueries({ queryKey: ['admin-store-items'] });
          }}
        />
      )}
    </SidebarProvider>
  );
}
