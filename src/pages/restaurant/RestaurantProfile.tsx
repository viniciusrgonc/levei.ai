import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import {
  Loader2, Star, Package, Settings, Camera, LogOut,
  ChevronRight, Pencil, Check, X, Bell, Info, Lock, User,
  MapPin, Building2, Phone, Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { BottomNav } from '@/components/BottomNav';
import { Skeleton } from '@/components/ui/skeleton';

const DAYS: Record<string, string> = {
  seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui',
  sex: 'Sex', sab: 'Sáb', dom: 'Dom',
};

export default function RestaurantProfile() {
  const { signOut, user: authUser } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [editingField, setEditingField] = useState<'name' | 'phone' | null>(null);
  const [nameValue, setNameValue] = useState('');
  const [phoneValue, setPhoneValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['restaurant-profile', authUser?.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const [{ data: profileData }, { data: restaurantData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('restaurants')
          .select('id, rating, total_deliveries, business_name, person_type, company_name, fantasy_name, phone, address_street, address_number, address_city, address_state, address_label, business_hours')
          .eq('user_id', user.id).maybeSingle(),
      ]);

      setNameValue(profileData?.full_name || '');
      setPhoneValue(restaurantData?.phone || profileData?.phone || '');
      return { ...profileData, ...restaurantData, email: user.email };
    },
  });

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: 'Foto muito grande', description: 'Use uma imagem de até 5MB.', variant: 'destructive' });
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      queryClient.invalidateQueries({ queryKey: ['restaurant-profile'] });
      toast({ title: '✅ Foto atualizada!' });
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('Bucket') || msg.includes('storage')) {
        toast({ title: 'Armazenamento indisponível', description: 'Entre em contato com o suporte.', variant: 'destructive' });
      } else {
        toast({ title: 'Erro ao atualizar foto', description: msg || 'Tente novamente.', variant: 'destructive' });
      }
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const updateField = useMutation({
    mutationFn: async (data: { full_name?: string; phone?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      if (data.full_name !== undefined) {
        const { error } = await supabase.from('profiles').update({ full_name: data.full_name }).eq('id', user.id);
        if (error) throw error;
      }
      if (data.phone !== undefined) {
        const { data: rest } = await supabase.from('restaurants').select('id').eq('user_id', user.id).maybeSingle();
        if (rest) {
          const { error } = await supabase.from('restaurants').update({ phone: data.phone }).eq('id', rest.id);
          if (error) throw error;
        }
        await supabase.from('profiles').update({ phone: data.phone }).eq('id', user.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-profile'] });
      toast({ title: '✅ Dados atualizados!' });
      setEditingField(null);
    },
    onError: () => toast({ title: 'Erro ao salvar', variant: 'destructive' }),
  });

  const saveField = () => {
    if (editingField === 'name') updateField.mutate({ full_name: nameValue });
    if (editingField === 'phone') updateField.mutate({ phone: phoneValue });
  };

  const cancelEdit = () => {
    setEditingField(null);
    setNameValue(profile?.full_name || '');
    setPhoneValue(profile?.phone || '');
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-primary h-56" />
        <div className="px-4 space-y-3 mt-4">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const displayName = profile?.business_name || profile?.full_name || 'Estabelecimento';
  const initials = displayName.charAt(0).toUpperCase();
  const isCompany = profile?.person_type === 'pj';
  const hasAddress = profile?.address_street && profile?.address_city;

  // Parse business hours
  const hours = profile?.business_hours as Record<string, { enabled: boolean; open: string; close: string }> | null;
  const activeDays = hours ? Object.entries(hours).filter(([, v]) => v.enabled) : [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── HERO ── */}
      <div className="bg-primary">
        <div style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }} />
        <div className="flex flex-col items-center pb-6 pt-2">
          <div className="relative mb-3">
            <Avatar className="h-24 w-24 border-4 border-white/20">
              <AvatarImage src={profile?.avatar_url} alt={displayName} />
              <AvatarFallback className="text-3xl bg-white/10 text-white">{initials}</AvatarFallback>
            </Avatar>
            <label htmlFor="avatar-upload" className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full cursor-pointer shadow">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Camera className="h-4 w-4 text-primary" />}
              <input id="avatar-upload" type="file" accept="image/*" onChange={uploadAvatar} className="hidden" disabled={uploading} />
            </label>
          </div>

          <h1 className="text-xl font-bold text-white">{displayName}</h1>
          {isCompany && profile?.company_name && (
            <p className="text-white/60 text-xs mt-0.5">{profile.company_name}</p>
          )}
          <p className="text-white/50 text-xs mt-0.5">{profile?.email}</p>

          <div className="flex items-center gap-2 mt-3 flex-wrap justify-center px-4">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${isCompany ? 'bg-blue-400/30 text-blue-100' : 'bg-green-400/30 text-green-100'}`}>
              {isCompany ? '🏢 Empresa' : '👤 Pessoa Física'}
            </span>
            {profile?.rating != null && (
              <div className="flex items-center gap-1 bg-white/10 rounded-full px-3 py-1">
                <Star className="h-3.5 w-3.5 text-yellow-300 fill-yellow-300" />
                <span className="text-white text-xs font-semibold">{Number(profile.rating).toFixed(1)}</span>
              </div>
            )}
            <div className="flex items-center gap-1 bg-white/10 rounded-full px-3 py-1">
              <Package className="h-3.5 w-3.5 text-white/70" />
              <span className="text-white/80 text-xs font-medium">{profile?.total_deliveries ?? 0} entregas</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-4">

        {/* ── DADOS DA CONTA ── */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 mb-2">Dados da conta</p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">

            {/* Nome */}
            <div className="px-4 py-3.5">
              {editingField === 'name' ? (
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">Nome completo / Representante</Label>
                  <div className="flex gap-2">
                    <Input value={nameValue} onChange={e => setNameValue(e.target.value)} className="h-10 rounded-xl border-gray-200 flex-1" autoFocus onKeyDown={e => e.key === 'Enter' && saveField()} />
                    <button onClick={saveField} disabled={updateField.isPending} className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center flex-shrink-0">
                      {updateField.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button onClick={cancelEdit} className="w-10 h-10 rounded-xl border border-gray-200 text-gray-500 flex items-center justify-center flex-shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0"><User className="h-4 w-4 text-blue-500" /></div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">Nome</p>
                      <p className="text-sm font-medium text-gray-900 truncate">{profile?.full_name || '—'}</p>
                    </div>
                  </div>
                  <button onClick={() => setEditingField('name')} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Pencil className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                </div>
              )}
            </div>

            {/* Telefone */}
            <div className="px-4 py-3.5">
              {editingField === 'phone' ? (
                <div className="space-y-2">
                  <Label className="text-xs text-gray-500">Telefone</Label>
                  <div className="flex gap-2">
                    <Input value={phoneValue} onChange={e => setPhoneValue(e.target.value)} className="h-10 rounded-xl border-gray-200 flex-1" type="tel" placeholder="(37) 99999-9999" autoFocus onKeyDown={e => e.key === 'Enter' && saveField()} />
                    <button onClick={saveField} disabled={updateField.isPending} className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center flex-shrink-0">
                      {updateField.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button onClick={cancelEdit} className="w-10 h-10 rounded-xl border border-gray-200 text-gray-500 flex items-center justify-center flex-shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0"><Phone className="h-4 w-4 text-green-500" /></div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">Telefone</p>
                      <p className="text-sm font-medium text-gray-900 truncate">{profile?.phone || '—'}</p>
                    </div>
                  </div>
                  <button onClick={() => setEditingField('phone')} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Pencil className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                </div>
              )}
            </div>

            {/* E-mail (read-only) */}
            <div className="px-4 py-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0"><span className="text-base">✉️</span></div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">E-mail</p>
                  <p className="text-sm font-medium text-gray-900 truncate">{profile?.email || '—'}</p>
                </div>
                <Lock className="h-3.5 w-3.5 text-gray-300 ml-auto flex-shrink-0" />
              </div>
            </div>

            {/* CPF/CNPJ (read-only) */}
            {(profile?.cpf || profile?.cnpj) && (
              <div className="px-4 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0"><Building2 className="h-4 w-4 text-gray-500" /></div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">{isCompany ? 'CNPJ' : 'CPF'}</p>
                    <p className="text-sm font-medium text-gray-900 truncate">{profile?.cnpj || profile?.cpf || '—'}</p>
                  </div>
                  <Lock className="h-3.5 w-3.5 text-gray-300 ml-auto flex-shrink-0" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── ENDEREÇO PRINCIPAL ── */}
        {hasAddress && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 mb-2">Endereço principal</p>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0 mt-0.5"><MapPin className="h-4 w-4 text-orange-500" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">{profile?.address_label || 'Principal'}</p>
                  <p className="text-sm font-medium text-gray-900">
                    {profile?.address_street}{profile?.address_number ? `, ${profile.address_number}` : ''}
                  </p>
                  <p className="text-xs text-gray-400">{profile?.address_city}/{profile?.address_state}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── HORÁRIO ── */}
        {activeDays.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 mb-2">Horário de funcionamento</p>
            <div className="bg-white rounded-2xl shadow-sm px-4 py-3 space-y-1.5">
              {activeDays.map(([day, v]) => (
                <div key={day} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-sm text-gray-700">{DAYS[day]}</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-600">{v.open} – {v.close}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ENDEREÇOS SALVOS ── */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 mb-2">Endereços</p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <button onClick={() => navigate('/restaurant/addresses')} className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors" style={{ minHeight: 56 }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center"><MapPin className="h-4 w-4 text-blue-600" /></div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">Endereços salvos</p>
                  <p className="text-xs text-gray-400">Locais de coleta e favoritos</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300" />
            </button>
          </div>
        </div>

        {/* ── MINHAS ENTREGAS ── */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 mb-2">Minhas entregas</p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <button onClick={() => navigate('/restaurant/history')} className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors" style={{ minHeight: 56 }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center"><Package className="h-4 w-4 text-blue-600" /></div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">Histórico de entregas</p>
                  <p className="text-xs text-gray-400">Ver todas as suas solicitações</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300" />
            </button>
          </div>
        </div>

        {/* ── CONFIGURAÇÕES ── */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 mb-2">Configurações</p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
            <div className="flex items-center justify-between px-4 py-4" style={{ minHeight: 56 }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center"><Bell className="h-4 w-4 text-orange-500" /></div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Notificações</p>
                  <p className="text-xs text-gray-400">Alertas de novas entregas</p>
                </div>
              </div>
              <Switch checked={notificationsEnabled} onCheckedChange={v => { setNotificationsEnabled(v); toast({ title: v ? '🔔 Notificações ativadas' : '🔕 Notificações desativadas' }); }} />
            </div>
            <button onClick={() => navigate('/restaurant/account')} className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors" style={{ minHeight: 56 }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center"><Settings className="h-4 w-4 text-gray-600" /></div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">Dados do estabelecimento</p>
                  <p className="text-xs text-gray-400">Endereço, CNPJ e informações</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300" />
            </button>
            <button onClick={() => toast({ title: 'Levei.ai', description: 'Versão 1.0.0 · Plataforma de entregas autônoma' })} className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors" style={{ minHeight: 56 }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center"><Info className="h-4 w-4 text-gray-600" /></div>
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">Sobre o app</p>
                  <p className="text-xs text-gray-400">Versão, termos e privacidade</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300" />
            </button>
          </div>
        </div>

        {/* ── SAIR ── */}
        <div className="pt-2 pb-4">
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-4 bg-white rounded-2xl shadow-sm hover:bg-red-50 active:bg-red-100 transition-colors border border-red-100" style={{ minHeight: 56 }}>
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center"><LogOut className="h-4 w-4 text-red-500" /></div>
            <span className="text-sm font-semibold text-red-600">Sair da conta</span>
          </button>
        </div>

      </main>

      <BottomNav />
    </div>
  );
}
