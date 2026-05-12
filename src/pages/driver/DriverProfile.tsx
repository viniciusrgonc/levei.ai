import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2, Star, Camera, History, Wallet, Settings, LogOut, ChevronRight, UserPen,
} from 'lucide-react';
import { DriverBottomNav } from '@/components/DriverBottomNav';

export default function DriverProfile() {
  const { signOut, user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [uploading, setUploading] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['driver-profile', user?.id],
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Not authenticated');
      const user = authUser;

      const [{ data: profileData }, { data: driverData }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('drivers').select('rating, total_deliveries, vehicle_type, points').eq('user_id', user.id).maybeSingle(),
      ]);

      setFullName(profileData?.full_name || '');
      setPhone(profileData?.phone || '');
      return { ...profileData, ...driverData };
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
      queryClient.invalidateQueries({ queryKey: ['driver-profile'] });
      toast({ title: '✅ Foto atualizada!' });
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('Bucket') || msg.includes('storage')) {
        toast({ title: 'Armazenamento indisponível', description: 'Contate o suporte para ativar upload de fotos.', variant: 'destructive' });
      } else {
        toast({ title: 'Erro ao atualizar foto', description: msg || 'Tente novamente.', variant: 'destructive' });
      }
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const updateProfile = useMutation({
    mutationFn: async (data: { full_name: string; phone: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('profiles').update(data).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-profile'] });
      toast({ title: 'Perfil atualizado!' });
      setIsEditing(false);
    },
    onError: () => toast({ title: 'Erro ao salvar', variant: 'destructive' }),
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const menuItems = [
    { icon: History,  label: 'Minhas entregas',  onClick: () => navigate('/driver/history') },
    { icon: Wallet,   label: 'Ganhos',            onClick: () => navigate('/driver/wallet') },
    { icon: Star,     label: 'Avaliações',        onClick: () => navigate('/driver/ratings') },
    { icon: UserPen,  label: 'Editar perfil',     onClick: () => setIsEditing(!isEditing) },
    { icon: Settings, label: 'Configurações',     onClick: () => navigate('/driver/settings') },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-primary h-64" />
        <div className="px-4 space-y-3 mt-4">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const vehicleLabel: Record<string, string> = {
    motorcycle: 'Moto', bicycle: 'Bicicleta', car: 'Carro', van: 'Van',
  };

  // Badges baseados em rating e entregas
  const getBadges = () => {
    const avg = Number(profile?.rating ?? 0);
    const total = Number(profile?.total_deliveries ?? 0);
    const badges: { emoji: string; label: string; color: string }[] = [];
    if (avg >= 4.9 && total >= 50) badges.push({ emoji: '🏆', label: 'Top Entregador', color: 'bg-yellow-100 text-yellow-700' });
    if (avg >= 4.7 && total >= 20) badges.push({ emoji: '⭐', label: 'Excelente atendimento', color: 'bg-amber-100 text-amber-700' });
    if (avg >= 4.5 && total >= 30) badges.push({ emoji: '⚡', label: 'Entrega rápida', color: 'bg-blue-100 text-blue-700' });
    if (total >= 100) badges.push({ emoji: '💯', label: '100+ entregas', color: 'bg-green-100 text-green-700' });
    return badges;
  };
  const badges = getBadges();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── HERO ── */}
      <div className="bg-primary">
        <div
          className="flex items-center justify-end px-4 pb-2"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
        />

        {/* Avatar + name */}
        <div className="flex flex-col items-center pb-6 pt-2">
          <div className="relative mb-3">
            <Avatar className="h-24 w-24 border-4 border-white/20">
              <AvatarImage src={profile?.avatar_url} alt={profile?.full_name} />
              <AvatarFallback className="text-3xl bg-white/10 text-white">
                {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <label
              htmlFor="avatar-upload"
              className="absolute bottom-0 right-0 p-1.5 bg-white rounded-full cursor-pointer shadow"
            >
              {uploading
                ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                : <Camera className="h-4 w-4 text-primary" />}
              <input id="avatar-upload" type="file" accept="image/*" onChange={uploadAvatar} className="hidden" disabled={uploading} />
            </label>
          </div>
          <h1 className="text-xl font-bold text-white">{profile?.full_name || 'Entregador'}</h1>
          <div className="flex items-center gap-3 mt-2">
            {profile?.rating && (
              <div className="flex items-center gap-1 bg-white/10 rounded-full px-2.5 py-1">
                <Star className="h-3.5 w-3.5 text-yellow-300 fill-yellow-300" />
                <span className="text-white text-xs font-medium">
                  {Number(profile.rating).toFixed(1)}
                </span>
              </div>
            )}
            {profile?.vehicle_type && (
              <div className="bg-white/10 rounded-full px-2.5 py-1">
                <span className="text-white/80 text-xs">
                  {vehicleLabel[profile.vehicle_type] || profile.vehicle_type}
                </span>
              </div>
            )}
            {profile?.total_deliveries !== undefined && (
              <div className="bg-white/10 rounded-full px-2.5 py-1">
                <span className="text-white/80 text-xs">{profile.total_deliveries} entregas</span>
              </div>
            )}
          </div>
          {/* Badges */}
          {badges.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center mt-3 px-4">
              {badges.map((b) => (
                <span
                  key={b.label}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${b.color}`}
                >
                  {b.emoji} {b.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-3">

        {/* Menu */}
        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={item.onClick}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors text-left"
              style={{ minHeight: 44 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
                  <item.icon className="h-4.5 w-4.5 text-gray-600" />
                </div>
                <span className="text-sm font-medium text-gray-900">{item.label}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300" />
            </button>
          ))}
        </div>

        {/* Edit form */}
        {isEditing && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
            <h3 className="font-semibold text-gray-900">Editar perfil</h3>
            <div className="space-y-1">
              <Label htmlFor="fullName" className="text-xs text-gray-500">Nome completo</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone" className="text-xs text-gray-500">Telefone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => updateProfile.mutate({ full_name: fullName, phone })}
                disabled={updateProfile.isPending}
                className="flex-1 h-11 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-60"
              >
                {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Salvar'}
              </button>
              <button
                onClick={() => { setIsEditing(false); setFullName(profile?.full_name || ''); setPhone(profile?.phone || ''); }}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-4 bg-white rounded-2xl shadow-sm text-red-500 hover:bg-red-50 transition-colors"
          style={{ minHeight: 44 }}
        >
          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
            <LogOut className="h-4 w-4 text-red-500" />
          </div>
          <span className="text-sm font-medium">Sair da conta</span>
        </button>
      </main>

      <DriverBottomNav />
    </div>
  );
}
