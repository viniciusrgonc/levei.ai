import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminSidebar } from '@/components/AdminSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Package, Loader2, X, Check, Eye, EyeOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ProductType {
  id: string;
  product_type: string;
  icon: string;
  percentage_increase: number;
  is_active: boolean;
  allows_return: boolean;
}

interface FormData {
  product_type: string;
  icon: string;
  percentage_increase: string;
  is_active: boolean;
  allows_return: boolean;
}

const EMPTY_FORM: FormData = {
  product_type: '', icon: '📦', percentage_increase: '0',
  is_active: true, allows_return: false,
};

const ICON_SUGGESTIONS = ['🍔','📦','📄','💊','⚠️','📱','🎁','👕','🏋️','🌸','🧴','🛒','🔧','🎨','🧸'];

export default function AdminProductSettings() {
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLDivElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductType | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  // ── Query ─────────────────────────────────────────────────────────────────
  const { data: types = [], isLoading } = useQuery({
    queryKey: ['product-type-settings-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_type_settings')
        .select('*')
        .order('product_type');
      if (error) throw error;
      return data as ProductType[];
    },
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        product_type: form.product_type.trim(),
        icon: form.icon.trim() || '📦',
        percentage_increase: parseFloat(form.percentage_increase) || 0,
        is_active: form.is_active,
        allows_return: form.allows_return,
      };
      if (editingId) {
        const { error } = await supabase.from('product_type_settings').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('product_type_settings').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-type-settings-admin'] });
      queryClient.invalidateQueries({ queryKey: ['product-type-settings-active'] });
      toast({ title: editingId ? '✅ Tipo atualizado!' : '✅ Tipo criado!' });
      closeForm();
    },
    onError: (e: any) => toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_type_settings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-type-settings-admin'] });
      queryClient.invalidateQueries({ queryKey: ['product-type-settings-active'] });
      toast({ title: '🗑️ Tipo excluído.' });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase.from('product_type_settings').update({ is_active: value }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-type-settings-admin'] });
      queryClient.invalidateQueries({ queryKey: ['product-type-settings-active'] });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const scrollToForm = () => {
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    scrollToForm();
  };

  const openEdit = (t: ProductType) => {
    setForm({
      product_type: t.product_type,
      icon: t.icon,
      percentage_increase: t.percentage_increase.toString(),
      is_active: t.is_active,
      allows_return: t.allows_return,
    });
    setEditingId(t.id);
    setShowForm(true);
    scrollToForm();
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_type.trim()) {
      toast({ title: 'Informe o nome do tipo', variant: 'destructive' });
      return;
    }
    saveMutation.mutate();
  };

  const activeCount = types.filter(t => t.is_active).length;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">

          <AdminPageHeader title="Tipos de Produto" showBack showLogout>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 h-9 px-4 rounded-xl bg-white/15 text-white text-sm font-semibold hover:bg-white/25 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
          </AdminPageHeader>

          <main className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto w-full">

            {/* ── KPIs ── */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <p className="text-xs text-gray-400 mb-1">Total</p>
                <p className="text-2xl font-bold text-gray-900">{types.length}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <p className="text-xs text-gray-400 mb-1">Visíveis</p>
                <p className="text-2xl font-bold text-green-600">{activeCount}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <p className="text-xs text-gray-400 mb-1">Ocultos</p>
                <p className="text-2xl font-bold text-gray-400">{types.length - activeCount}</p>
              </div>
            </div>

            {/* ── Formulário inline ── */}
            <div ref={formRef} />
            {showForm && (
              <div className="bg-white rounded-2xl shadow-sm p-5 border-2 border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900 text-base">
                    {editingId ? '✏️ Editar tipo de produto' : '➕ Novo tipo de produto'}
                  </h2>
                  <button
                    onClick={closeForm}
                    className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Nome + ícone */}
                  <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">Nome do tipo *</Label>
                      <Input
                        placeholder="Ex: Alimentos, Medicamentos..."
                        value={form.product_type}
                        onChange={e => setForm({ ...form, product_type: e.target.value })}
                        className="h-11 rounded-xl border-gray-200"
                        autoFocus
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-600">Ícone</Label>
                      <Input
                        placeholder="📦"
                        value={form.icon}
                        onChange={e => setForm({ ...form, icon: e.target.value })}
                        className="h-11 rounded-xl border-gray-200 w-20 text-center text-xl"
                        maxLength={4}
                      />
                    </div>
                  </div>

                  {/* Sugestões de ícone */}
                  <div>
                    <p className="text-xs text-gray-400 mb-2">Sugestões:</p>
                    <div className="flex flex-wrap gap-2">
                      {ICON_SUGGESTIONS.map(ico => (
                        <button
                          key={ico}
                          type="button"
                          onClick={() => setForm({ ...form, icon: ico })}
                          className={`w-9 h-9 rounded-xl text-xl flex items-center justify-center transition-colors ${
                            form.icon === ico
                              ? 'bg-blue-100 ring-2 ring-blue-400'
                              : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          {ico}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Acréscimo */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">Acréscimo no preço (%)</Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number" min="0" max="200" step="0.5"
                        value={form.percentage_increase}
                        onChange={e => setForm({ ...form, percentage_increase: e.target.value })}
                        className="h-11 rounded-xl border-gray-200 w-28"
                      />
                      <span className="text-sm text-gray-500">% sobre o valor da entrega</span>
                    </div>
                  </div>

                  {/* Switches */}
                  <div className="space-y-3 pt-1 border-t border-gray-100">
                    {/* Visibilidade */}
                    <label className={`flex items-center justify-between gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                      form.is_active ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        {form.is_active
                          ? <Eye className="h-4 w-4 text-green-600 flex-shrink-0" />
                          : <EyeOff className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            {form.is_active ? 'Visível para os estabelecimentos' : 'Oculto para os estabelecimentos'}
                          </p>
                          <p className="text-xs text-gray-400">Aparece como opção na criação de entrega</p>
                        </div>
                      </div>
                      <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
                    </label>

                    {/* Retorno */}
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

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={saveMutation.isPending}
                      className="flex-1 h-11 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
                    >
                      {saveMutation.isPending
                        ? <><Loader2 className="h-4 w-4 animate-spin" />Salvando...</>
                        : <><Check className="h-4 w-4" />{editingId ? 'Salvar alterações' : 'Criar tipo'}</>}
                    </button>
                    <button
                      type="button"
                      onClick={closeForm}
                      className="px-5 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ── Lista de tipos ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-semibold text-gray-900">
                  Tipos cadastrados
                  <span className="ml-2 text-xs font-normal text-gray-400">{types.length} no total</span>
                </h2>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
                </div>
              ) : types.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-dashed border-gray-200 p-12 text-center">
                  <div className="w-14 h-14 rounded-full bg-gray-100 mx-auto mb-3 flex items-center justify-center">
                    <Package className="h-7 w-7 text-gray-400" />
                  </div>
                  <p className="font-semibold text-gray-700 mb-1">Nenhum tipo cadastrado</p>
                  <p className="text-sm text-gray-400 mb-5">Crie tipos de produto para os estabelecimentos selecionarem.</p>
                  <button
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />Adicionar primeiro tipo
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {types.map((t) => (
                    <div
                      key={t.id}
                      className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all ${
                        t.is_active ? 'border-transparent' : 'border-gray-200 opacity-60'
                      }`}
                    >
                      {/* Faixa de status no topo */}
                      <div className={`h-1 w-full ${t.is_active ? 'bg-green-400' : 'bg-gray-200'}`} />

                      <div className="p-4">
                        {/* Linha superior: ícone + nome + badges */}
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center text-2xl flex-shrink-0">
                            {t.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900">{t.product_type}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {Number(t.percentage_increase) > 0
                                ? `+${Number(t.percentage_increase)}% no valor`
                                : 'Sem acréscimo'}
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {t.allows_return && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
                                  ↩️ Retorno
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Status badge */}
                          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
                            t.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {t.is_active
                              ? <><Eye className="h-3 w-3" />Visível</>
                              : <><EyeOff className="h-3 w-3" />Oculto</>}
                          </div>
                        </div>

                        {/* Linha de ações */}
                        <div className="flex items-center gap-2 pt-3 border-t border-gray-50">

                          {/* Toggle visibilidade */}
                          <button
                            onClick={() => toggleMutation.mutate({ id: t.id, value: !t.is_active })}
                            disabled={toggleMutation.isPending}
                            className={`flex-1 h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                              t.is_active
                                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                            }`}
                          >
                            {toggleMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : t.is_active ? (
                              <><EyeOff className="h-3.5 w-3.5" />Ocultar</>
                            ) : (
                              <><Eye className="h-3.5 w-3.5" />Tornar visível</>
                            )}
                          </button>

                          {/* Editar */}
                          <button
                            onClick={() => openEdit(t)}
                            className="flex-1 h-9 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-blue-100 transition-colors border border-blue-100"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </button>

                          {/* Excluir */}
                          <button
                            onClick={() => setDeleteTarget(t)}
                            className="flex-1 h-9 rounded-xl bg-red-50 text-red-600 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-red-100 transition-colors border border-red-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Excluir
                          </button>

                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Botão adicionar no rodapé da lista */}
              {types.length > 0 && (
                <button
                  onClick={openCreate}
                  className="w-full h-11 rounded-2xl border-2 border-dashed border-gray-200 text-gray-500 text-sm font-medium flex items-center justify-center gap-2 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar novo tipo
                </button>
              )}
            </div>

          </main>
        </div>
      </div>

      {/* ── Confirm delete ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{deleteTarget?.product_type}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Entregas existentes não serão afetadas, mas este tipo não ficará mais disponível para novas solicitações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
