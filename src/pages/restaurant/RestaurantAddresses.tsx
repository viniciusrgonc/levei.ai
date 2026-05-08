import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { BottomNav } from '@/components/BottomNav';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, Star, Trash2, Pencil, Plus, Check,
  Loader2, ArrowLeft, Home, Building2, Heart,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface SavedAddress {
  id: string;
  restaurant_id: string;
  label: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  is_favorite: boolean;
  created_at: string;
}

interface AddressForm {
  label: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  is_default: boolean;
  is_favorite: boolean;
}

const emptyForm: AddressForm = {
  label: '', cep: '', street: '', number: '',
  complement: '', neighborhood: '', city: '', state: '',
  is_default: false, is_favorite: false,
};

// ── Fetch restaurant_id for current user ──────────────────────────────────────
async function fetchRestaurantId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');
  const { data, error } = await supabase
    .from('restaurants')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Restaurante não encontrado');
  return data.id;
}

// ── Fetch addresses ────────────────────────────────────────────────────────────
async function fetchAddresses(restaurantId: string): Promise<SavedAddress[]> {
  const { data, error } = await supabase
    .from('saved_addresses')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('is_default', { ascending: false })
    .order('is_favorite', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as SavedAddress[];
}

// ── ViaCEP ─────────────────────────────────────────────────────────────────────
async function fetchCep(cep: string) {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) throw new Error('CEP inválido');
  const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
  const json = await res.json();
  if (json.erro) throw new Error('CEP não encontrado');
  return json;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function RestaurantAddresses() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SavedAddress | null>(null);
  const [form, setForm] = useState<AddressForm>(emptyForm);
  const [cepLoading, setCepLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: restaurantId } = useQuery({
    queryKey: ['my-restaurant-id'],
    queryFn: fetchRestaurantId,
    staleTime: Infinity,
  });

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ['saved-addresses', restaurantId],
    queryFn: () => fetchAddresses(restaurantId!),
    enabled: !!restaurantId,
    staleTime: 30 * 1000,
  });

  // ── Invalidate helper ──────────────────────────────────────────────────────
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['saved-addresses', restaurantId] });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async (payload: Omit<AddressForm, ''> & { id?: string }) => {
      if (!restaurantId) throw new Error('Sem restaurante');

      // Se for padrão, remove is_default dos outros
      if (payload.is_default) {
        await supabase
          .from('saved_addresses')
          .update({ is_default: false })
          .eq('restaurant_id', restaurantId);
      }

      const row = {
        restaurant_id: restaurantId,
        label: payload.label.trim(),
        cep: payload.cep.replace(/\D/g, ''),
        street: payload.street.trim(),
        number: payload.number.trim(),
        complement: payload.complement.trim() || null,
        neighborhood: payload.neighborhood.trim(),
        city: payload.city.trim(),
        state: payload.state.trim().toUpperCase(),
        is_default: payload.is_default,
        is_favorite: payload.is_favorite,
      };

      if (payload.id) {
        const { error } = await supabase
          .from('saved_addresses')
          .update(row)
          .eq('id', payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('saved_addresses')
          .insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      invalidate();
      toast({ title: editTarget ? 'Endereço atualizado!' : 'Endereço salvo!' });
      closeModal();
    },
    onError: (e: any) => toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('saved_addresses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Endereço removido.' });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: 'Erro ao remover', description: e.message, variant: 'destructive' }),
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!restaurantId) return;
      await supabase
        .from('saved_addresses')
        .update({ is_default: false })
        .eq('restaurant_id', restaurantId);
      const { error } = await supabase
        .from('saved_addresses')
        .update({ is_default: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Endereço padrão definido!' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase
        .from('saved_addresses')
        .update({ is_favorite: value })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  // ── Modal helpers ──────────────────────────────────────────────────────────
  function openAdd() {
    setEditTarget(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(addr: SavedAddress) {
    setEditTarget(addr);
    setForm({
      label: addr.label,
      cep: addr.cep,
      street: addr.street,
      number: addr.number,
      complement: addr.complement || '',
      neighborhood: addr.neighborhood,
      city: addr.city,
      state: addr.state,
      is_default: addr.is_default,
      is_favorite: addr.is_favorite,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditTarget(null);
    setForm(emptyForm);
  }

  function setField<K extends keyof AddressForm>(key: K, value: AddressForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleCepSearch() {
    setCepLoading(true);
    try {
      const data = await fetchCep(form.cep);
      setForm(prev => ({
        ...prev,
        street: data.logradouro || prev.street,
        neighborhood: data.bairro || prev.neighborhood,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
      }));
      toast({ title: 'Endereço encontrado!' });
    } catch (e: any) {
      toast({ title: 'CEP não encontrado', description: e.message, variant: 'destructive' });
    } finally {
      setCepLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.label.trim()) {
      toast({ title: 'Informe um nome para o endereço', variant: 'destructive' });
      return;
    }
    if (!form.street.trim() || !form.number.trim() || !form.city.trim()) {
      toast({ title: 'Preencha rua, número e cidade', variant: 'destructive' });
      return;
    }
    saveMutation.mutate({ ...form, id: editTarget?.id });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-24">
      {/* Header */}
      <div
        className="bg-primary text-white px-4 pb-4 flex-shrink-0"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold flex-1">Endereços Salvos</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl h-24 animate-pulse" />
            ))}
          </div>
        ) : addresses.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <MapPin className="h-10 w-10 text-primary" />
            </div>
            <p className="font-bold text-gray-800 text-lg mb-2">Nenhum endereço salvo</p>
            <p className="text-sm text-gray-500">
              Adicione um endereço de coleta para agilizar suas entregas
            </p>
          </div>
        ) : (
          addresses.map((addr) => (
            <div
              key={addr.id}
              className="bg-white rounded-2xl shadow-sm p-4 space-y-3"
            >
              {/* Top row */}
              <div
                className="flex items-start gap-3 cursor-pointer"
                onClick={() => openEdit(addr)}
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {addr.label.toLowerCase().includes('casa') ? (
                    <Home className="h-5 w-5 text-primary" />
                  ) : (
                    <Building2 className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900 text-sm">{addr.label}</p>
                    {addr.is_default && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        Padrão
                      </span>
                    )}
                    {addr.is_favorite && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                        Favorito
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5 truncate">
                    {addr.street}, {addr.number}
                    {addr.complement ? ` — ${addr.complement}` : ''}
                  </p>
                  <p className="text-xs text-gray-400">
                    {addr.neighborhood} · {addr.city}/{addr.state}
                  </p>
                </div>
              </div>

              {/* Action row */}
              <div className="flex items-center gap-2 pt-1 border-t border-gray-50">
                {/* Edit */}
                <button
                  onClick={() => openEdit(addr)}
                  className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </button>

                {/* Set default */}
                {!addr.is_default && (
                  <button
                    onClick={() => setDefaultMutation.mutate(addr.id)}
                    disabled={setDefaultMutation.isPending}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 transition-colors disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Definir padrão
                  </button>
                )}

                {/* Favorite */}
                <button
                  onClick={() => toggleFavoriteMutation.mutate({ id: addr.id, value: !addr.is_favorite })}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                    addr.is_favorite
                      ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  <Heart className={`h-3.5 w-3.5 ${addr.is_favorite ? 'fill-yellow-400' : ''}`} />
                  {addr.is_favorite ? 'Favoritado' : 'Favoritar'}
                </button>

                {/* Delete */}
                <button
                  onClick={() => setDeleteTarget(addr.id)}
                  className="ml-auto flex items-center justify-center w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <button
        onClick={openAdd}
        className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-green-500 text-white shadow-lg flex items-center justify-center hover:bg-green-600 transition-colors z-40"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}
      >
        <Plus className="h-7 w-7" />
      </button>

      <BottomNav />

      {/* ── Delete confirm modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-6 w-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Remover endereço?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget)}
                disabled={deleteMutation.isPending}
                className="flex-1 h-11 rounded-xl bg-red-500 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-red-600 transition-colors disabled:opacity-60"
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remover'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add/Edit modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center">
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
            style={{ maxHeight: '90vh' }}
          >
            {/* Modal header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <ArrowLeft className="h-4 w-4 text-gray-600" />
              </button>
              <h2 className="font-bold text-gray-900 text-base flex-1">
                {editTarget ? 'Editar Endereço' : 'Novo Endereço'}
              </h2>
            </div>

            {/* Modal body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Label */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                  Nome do endereço *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Loja Centro, Depósito..."
                  value={form.label}
                  onChange={e => setField('label', e.target.value)}
                  className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>

              {/* CEP */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                  CEP
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="00000-000"
                    value={form.cep}
                    onChange={e => setField('cep', e.target.value)}
                    maxLength={9}
                    className="flex-1 h-11 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={handleCepSearch}
                    disabled={cepLoading}
                    className="h-11 px-4 rounded-xl bg-primary text-white text-sm font-semibold flex items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60"
                  >
                    {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
                  </button>
                </div>
              </div>

              {/* Rua */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                  Rua *
                </label>
                <input
                  type="text"
                  placeholder="Nome da rua"
                  value={form.street}
                  onChange={e => setField('street', e.target.value)}
                  className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>

              {/* Número + Complemento */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                    Número *
                  </label>
                  <input
                    type="text"
                    placeholder="123"
                    value={form.number}
                    onChange={e => setField('number', e.target.value)}
                    className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                    Complemento
                  </label>
                  <input
                    type="text"
                    placeholder="Apto, sala..."
                    value={form.complement}
                    onChange={e => setField('complement', e.target.value)}
                    className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>

              {/* Bairro */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                  Bairro
                </label>
                <input
                  type="text"
                  placeholder="Bairro"
                  value={form.neighborhood}
                  onChange={e => setField('neighborhood', e.target.value)}
                  className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>

              {/* Cidade + Estado */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                    Cidade *
                  </label>
                  <input
                    type="text"
                    placeholder="Cidade"
                    value={form.city}
                    onChange={e => setField('city', e.target.value)}
                    className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                    Estado
                  </label>
                  <input
                    type="text"
                    placeholder="SP"
                    value={form.state}
                    onChange={e => setField('state', e.target.value)}
                    maxLength={2}
                    className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary uppercase"
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-3 pt-1">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setField('is_default', !form.is_default)}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                      form.is_default ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                    }`}
                  >
                    {form.is_default && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className="text-sm text-gray-700">Definir como endereço padrão</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setField('is_favorite', !form.is_favorite)}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                      form.is_favorite ? 'bg-yellow-400 border-yellow-400' : 'border-gray-300'
                    }`}
                  >
                    {form.is_favorite && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <span className="text-sm text-gray-700">Marcar como favorito</span>
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 h-12 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="flex-1 h-12 rounded-xl bg-primary text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Star className="h-4 w-4" />
                      Salvar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
