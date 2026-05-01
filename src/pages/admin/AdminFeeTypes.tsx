import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminSidebar } from '@/components/AdminSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Pencil, Trash2, Percent, Loader2,
  X, Check, Eye, EyeOff, TrendingUp,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ── Types ──────────────────────────────────────────────────────────────────────
interface FeeType {
  id: string;
  nome: string;
  percentual: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

interface FormData {
  nome: string;
  percentual: string;
  ativo: boolean;
}

const EMPTY_FORM: FormData = { nome: '', percentual: '0', ativo: true };

// ── Component ──────────────────────────────────────────────────────────────────
export default function AdminFeeTypes() {
  const queryClient = useQueryClient();
  const formRef = useRef<HTMLDivElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeeType | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);

  // ── Query ────────────────────────────────────────────────────────────────────
  const { data: items = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['fee-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_types')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as FeeType[];
    },
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: form.nome.trim(),
        percentual: parseFloat(form.percentual) || 0,
        ativo: form.ativo,
      };
      if (editingId) {
        const { error } = await supabase
          .from('fee_types')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fee_types').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-types'] });
      toast({ title: editingId ? '✅ Tipo atualizado!' : '✅ Tipo criado!' });
      closeForm();
    },
    onError: (e: any) => toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase
        .from('fee_types')
        .update({ ativo: value, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fee-types'] }),
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fee_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-types'] });
      toast({ title: '🗑️ Tipo excluído.' });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' }),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const scrollToForm = () =>
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
    scrollToForm();
  };

  const openEdit = (item: FeeType) => {
    setForm({ nome: item.nome, percentual: item.percentual.toString(), ativo: item.ativo });
    setEditingId(item.id);
    setShowForm(true);
    scrollToForm();
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast({ title: 'Informe o nome do tipo', variant: 'destructive' });
      return;
    }
    const pct = parseFloat(form.percentual);
    if (isNaN(pct) || pct < 0) {
      toast({ title: 'Percentual deve ser maior ou igual a zero', variant: 'destructive' });
      return;
    }
    saveMutation.mutate();
  };

  const activeCount = items.filter(i => i.ativo).length;

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
                <h1 className="font-semibold text-gray-900">Tipos de Taxa</h1>
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
                <p className="text-2xl font-bold text-gray-900">{items.length}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <p className="text-xs text-gray-400 mb-1">Ativos</p>
                <p className="text-2xl font-bold text-green-600">{activeCount}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <p className="text-xs text-gray-400 mb-1">Inativos</p>
                <p className="text-2xl font-bold text-gray-400">{items.length - activeCount}</p>
              </div>
            </div>

            {/* ── Formulário inline ── */}
            <div ref={formRef} />
            {showForm && (
              <div className="bg-white rounded-2xl shadow-sm p-5 border-2 border-blue-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-gray-900 text-base">
                    {editingId ? '✏️ Editar tipo' : '➕ Novo tipo de taxa'}
                  </h2>
                  <button
                    onClick={closeForm}
                    className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
                  >
                    <X className="h-4 w-4 text-gray-500" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">

                  {/* Nome */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">Nome do tipo *</Label>
                    <Input
                      placeholder="Ex: Taxa de Plataforma, Comissão Especial..."
                      value={form.nome}
                      onChange={e => setForm({ ...form, nome: e.target.value })}
                      className="h-11 rounded-xl border-gray-200"
                      autoFocus
                      required
                    />
                  </div>

                  {/* Percentual */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-600">Percentual (%)</Label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          placeholder="0"
                          value={form.percentual}
                          onChange={e => setForm({ ...form, percentual: e.target.value })}
                          className="h-11 rounded-xl border-gray-200 pr-10"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">
                          %
                        </span>
                      </div>
                      {/* Preview */}
                      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-center min-w-[100px]">
                        <p className="text-[10px] text-blue-400 font-medium uppercase tracking-wider">Sobre R$100</p>
                        <p className="text-base font-bold text-blue-700">
                          R$ {(parseFloat(form.percentual) || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="border-t border-gray-100 pt-3">
                    <label className={`flex items-center justify-between gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                      form.ativo ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        {form.ativo
                          ? <Eye className="h-4 w-4 text-green-600 flex-shrink-0" />
                          : <EyeOff className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            {form.ativo ? 'Ativo — aparece para os usuários' : 'Inativo — não aparece para os usuários'}
                          </p>
                          <p className="text-xs text-gray-400">Tipos inativos não são aplicados nas operações</p>
                        </div>
                      </div>
                      <Switch
                        checked={form.ativo}
                        onCheckedChange={v => setForm({ ...form, ativo: v })}
                      />
                    </label>
                  </div>

                  {/* Botões */}
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

            {/* ── Lista ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="font-semibold text-gray-900">
                  Tipos cadastrados
                  <span className="ml-2 text-xs font-normal text-gray-400">{items.length} no total</span>
                </h2>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
                </div>
              ) : isError ? (
                <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                  <p className="text-gray-500 mb-1 font-semibold">Tabela não encontrada</p>
                  <p className="text-sm text-gray-400 mb-4">
                    Execute a migration SQL no Supabase para criar a tabela <code className="bg-gray-100 px-1 rounded">fee_types</code>.
                  </p>
                  <button
                    onClick={() => refetch()}
                    className="text-sm text-blue-600 font-semibold hover:underline"
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : items.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-dashed border-gray-200 p-12 text-center">
                  <div className="w-14 h-14 rounded-full bg-gray-100 mx-auto mb-3 flex items-center justify-center">
                    <Percent className="h-7 w-7 text-gray-400" />
                  </div>
                  <p className="font-semibold text-gray-700 mb-1">Nenhum tipo cadastrado</p>
                  <p className="text-sm text-gray-400 mb-5">Crie tipos de taxa para configurar as cobranças da plataforma.</p>
                  <button
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="h-4 w-4" />Adicionar primeiro tipo
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all ${
                        item.ativo ? 'border-transparent' : 'border-gray-200 opacity-60'
                      }`}
                    >
                      {/* Faixa de status */}
                      <div className={`h-1 w-full ${item.ativo ? 'bg-green-400' : 'bg-gray-200'}`} />

                      <div className="p-4">
                        {/* Linha superior */}
                        <div className="flex items-center gap-3 mb-3">
                          {/* Ícone de percentual */}
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            item.ativo ? 'bg-blue-50' : 'bg-gray-100'
                          }`}>
                            <TrendingUp className={`h-5 w-5 ${item.ativo ? 'text-blue-600' : 'text-gray-400'}`} />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 truncate">{item.nome}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Sobre R$100 → <span className="font-semibold text-gray-700">R$ {item.percentual.toFixed(2)}</span>
                            </p>
                          </div>

                          {/* Badge percentual */}
                          <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-bold flex-shrink-0 ${
                            item.ativo ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            <Percent className="h-3.5 w-3.5" />
                            {item.percentual.toFixed(1)}
                          </div>

                          {/* Status badge */}
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold flex-shrink-0 ${
                            item.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {item.ativo ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                            {item.ativo ? 'Ativo' : 'Inativo'}
                          </div>
                        </div>

                        {/* Linha de ações */}
                        <div className="flex items-center gap-2 pt-3 border-t border-gray-50">
                          {/* Toggle */}
                          <button
                            onClick={() => toggleMutation.mutate({ id: item.id, value: !item.ativo })}
                            disabled={toggleMutation.isPending}
                            className={`flex-1 h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                              item.ativo
                                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                            }`}
                          >
                            {toggleMutation.isPending
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : item.ativo
                                ? <><EyeOff className="h-3.5 w-3.5" />Desativar</>
                                : <><Eye className="h-3.5 w-3.5" />Ativar</>}
                          </button>

                          {/* Editar */}
                          <button
                            onClick={() => openEdit(item)}
                            className="flex-1 h-9 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-blue-100 transition-colors border border-blue-100"
                          >
                            <Pencil className="h-3.5 w-3.5" />Editar
                          </button>

                          {/* Excluir */}
                          <button
                            onClick={() => setDeleteTarget(item)}
                            className="flex-1 h-9 rounded-xl bg-red-50 text-red-600 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-red-100 transition-colors border border-red-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Botão adicionar rodapé */}
                  <button
                    onClick={openCreate}
                    className="w-full h-11 rounded-2xl border-2 border-dashed border-gray-200 text-gray-500 text-sm font-medium flex items-center justify-center gap-2 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <Plus className="h-4 w-4" />Adicionar novo tipo
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
            <AlertDialogTitle>Excluir "{deleteTarget?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O tipo será removido permanentemente.
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
