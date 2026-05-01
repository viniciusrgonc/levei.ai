import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminSidebar } from '@/components/AdminSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Tag, Loader2, X, Check, Eye, EyeOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeliveryCategory {
  id: string;
  name: string;
  base_price: number;
  price_per_km: number;
  is_active: boolean;
  allows_return: boolean;
  created_at: string;
}

interface FormData {
  name: string;
  base_price: string;
  price_per_km: string;
  is_active: boolean;
  allows_return: boolean;
}

const EMPTY_FORM: FormData = {
  name: '', base_price: '', price_per_km: '', is_active: true, allows_return: false,
};

function categoryIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes('farm')) return '💊';
  if (n.includes('moto') || n.includes('bike')) return '🛵';
  if (n.includes('carro') || n.includes('car')) return '🚗';
  if (n.includes('van')) return '🚐';
  if (n.includes('caminhão') || n.includes('caminhao') || n.includes('truck')) return '🚛';
  if (n.includes('doc')) return '📄';
  return '📦';
}

export default function AdminDeliveryCategories() {
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLDivElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeliveryCategory | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  // ── Query ─────────────────────────────────────────────────────────────────
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['delivery-categories-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_categories')
        .select('*')
        .order('base_price');
      if (error) throw error;
      return data as DeliveryCategory[];
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        base_price: parseFloat(form.base_price),
        price_per_km: parseFloat(form.price_per_km),
        is_active: form.is_active,
        allows_return: form.allows_return,
      };
      if (editingId) {
        const { error } = await supabase.from('delivery_categories').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('delivery_categories').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-categories-admin'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-categories-active'] });
      toast({ title: editingId ? '✅ Categoria atualizada!' : '✅ Categoria criada!' });
      closeForm();
    },
    onError: (e: any) => toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('delivery_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-categories-admin'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-categories-active'] });
      toast({ title: '🗑️ Categoria excluída.' });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from('delivery_categories').update({ is_active: value }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-categories-admin'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-categories-active'] });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const scrollToForm = () => setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);

  const openCreate = () => {
    setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); scrollToForm();
  };

  const openEdit = (cat: DeliveryCategory) => {
    setForm({
      name: cat.name,
      base_price: cat.base_price.toString(),
      price_per_km: cat.price_per_km.toString(),
      is_active: cat.is_active,
      allows_return: cat.allows_return,
    });
    setEditingId(cat.id); setShowForm(true); scrollToForm();
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.base_price || !form.price_per_km) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    saveMutation.mutate();
  };

  const activeCount = categories.filter(c => c.is_active).length;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">

          {/* ── Header ── */}
          <header className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm safe-top">
            <div className="flex items-center gap-3 px-4 h-14">
              <SidebarTrigger className="text-gray-500" />
              <div className="flex-1 min-w-0">
                <h1 className="font-semibold text-gray-900">Categorias de Entrega</h1>
              </div>
              <button
                onClick={openCreate}
                className="flex items-center gap-2 h-9 px-4 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Adicionar
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto w-full">

            {/* ── KPIs ── */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <p className="text-xs text-gray-400 mb-1">Total</p>
                <p className="text-2xl font-bold text-gray-900">{categories.length}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <p className="text-xs text-gray-400 mb-1">Ativas</p>
                <p className="text-2xl font-bold text-green-600">{activeCount}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <p className="text-xs text-gray-400 mb-1">Inativas</p>
                <p className="text-2xl font-bold text-gray-400">{categories.length - activeCount}</p>
              </div>
            </div>

            {/* ── Formulário inline ── */}
            <div ref={formRef} />
            {showForm && (
              <div className="bg-white rounded-2xl shadow-sm p-5 border-2 border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900 text-base">
                    {editingId ? '✏️ Editar categoria' : '➕ Nova categoria'}
                  </h2>
                  <button onClick={closeForm} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">Nome da categoria *</Label>
                    <Input
                      placeholder="Ex: Moto, Carro, Farmácia..."
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      className="h-11 rounded-xl border-gray-200"
                      autoFocus
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">Preço base (R$) *</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                        <Input
                          type="number" step="0.01" min="0" placeholder="0,00"
                          value={form.base_price}
                          onChange={e => setForm({ ...form, base_price: e.target.value })}
                          className="h-11 pl-9 rounded-xl border-gray-200"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">Preço por km (R$) *</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                        <Input
                          type="number" step="0.01" min="0" placeholder="0,00"
                          value={form.price_per_km}
                          onChange={e => setForm({ ...form, price_per_km: e.target.value })}
                          className="h-11 pl-9 rounded-xl border-gray-200"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Switches */}
                  <div className="space-y-3 pt-1 border-t border-gray-100">
                    <label className={`flex items-center justify-between gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                      form.is_active ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        {form.is_active
                          ? <Eye className="h-4 w-4 text-green-600 flex-shrink-0" />
                          : <EyeOff className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            {form.is_active ? 'Visível para os estabelecimentos' : 'Oculta para os estabelecimentos'}
                          </p>
                          <p className="text-xs text-gray-400">Aparece como opção na criação de entrega</p>
                        </div>
                      </div>
                      <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
                    </label>

                    <label className={`flex items-center justify-between gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                      form.allows_return ? 'border-orange-300 bg-orange-50' : 'border-gray-100 bg-gray-50'
                    }`}>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">↩️ Permite entrega com retorno</p>
                        <p className="text-xs text-gray-400">Exibe opção de retorno ao ponto de coleta</p>
                      </div>
                      <Switch checked={form.allows_return} onCheckedChange={v => setForm({ ...form, allows_return: v })} />
                    </label>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={saveMutation.isPending}
                      className="flex-1 h-11 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
                    >
                      {saveMutation.isPending
                        ? <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</>
                        : <><Check className="h-4 w-4" />{editingId ? 'Salvar alterações' : 'Criar categoria'}</>}
                    </button>
                    <button type="button" onClick={closeForm}
                      className="px-5 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors">
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── Lista ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-semibold text-gray-900">
                  Categorias cadastradas
                  <span className="ml-2 text-xs font-normal text-gray-400">{categories.length} no total</span>
                </h2>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
                </div>
              ) : categories.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-dashed border-gray-200 p-12 text-center">
                  <div className="w-14 h-14 rounded-full bg-gray-100 mx-auto mb-3 flex items-center justify-center">
                    <Tag className="h-7 w-7 text-gray-400" />
                  </div>
                  <p className="font-semibold text-gray-700 mb-1">Nenhuma categoria ainda</p>
                  <p className="text-sm text-gray-400 mb-5">Crie a primeira para que os estabelecimentos possam solicitar entregas.</p>
                  <button onClick={openCreate}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors">
                    <Plus className="h-4 w-4" />Adicionar categoria
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all ${
                        cat.is_active ? 'border-transparent' : 'border-gray-200 opacity-60'
                      }`}
                    >
                      {/* Faixa de status */}
                      <div className={`h-1 w-full ${cat.is_active ? 'bg-green-400' : 'bg-gray-200'}`} />

                      <div className="p-4">
                        {/* Linha superior */}
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0">
                            {categoryIcon(cat.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900">{cat.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              <span className="font-semibold text-gray-700">R$ {Number(cat.base_price).toFixed(2)}</span> base
                              {' · '}
                              <span className="font-semibold text-gray-700">R$ {Number(cat.price_per_km).toFixed(2)}</span>/km
                            </p>
                            {cat.allows_return && (
                              <span className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
                                ↩️ Retorno
                              </span>
                            )}
                          </div>
                          {/* Status badge */}
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
                            cat.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {cat.is_active
                              ? <><Eye className="h-3 w-3" />Ativa</>
                              : <><EyeOff className="h-3 w-3" />Inativa</>}
                          </div>
                        </div>

                        {/* Linha de ações */}
                        <div className="flex items-center gap-2 pt-3 border-t border-gray-50">
                          <button
                            onClick={() => toggleMutation.mutate({ id: cat.id, value: !cat.is_active })}
                            disabled={toggleMutation.isPending}
                            className={`flex-1 h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                              cat.is_active
                                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                            }`}
                          >
                            {toggleMutation.isPending
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : cat.is_active
                                ? <><EyeOff className="h-3.5 w-3.5" />Desativar</>
                                : <><Eye className="h-3.5 w-3.5" />Ativar</>}
                          </button>

                          <button
                            onClick={() => openEdit(cat)}
                            className="flex-1 h-9 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-blue-100 transition-colors border border-blue-100"
                          >
                            <Pencil className="h-3.5 w-3.5" />Editar
                          </button>

                          <button
                            onClick={() => setDeleteTarget(cat)}
                            className="flex-1 h-9 rounded-xl bg-red-50 text-red-600 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-red-100 transition-colors border border-red-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Botão adicionar no rodapé */}
                  <button
                    onClick={openCreate}
                    className="w-full h-11 rounded-2xl border-2 border-dashed border-gray-200 text-gray-500 text-sm font-medium flex items-center justify-center gap-2 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <Plus className="h-4 w-4" />Adicionar nova categoria
                  </button>
                </div>
              )}
            </div>

          </main>
        </div>
      </div>

      {/* ── Confirm delete ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Entregas existentes não serão afetadas, mas esta categoria não ficará mais disponível para novas solicitações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
