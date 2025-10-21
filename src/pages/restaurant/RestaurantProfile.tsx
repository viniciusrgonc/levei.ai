import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { Loader2, Star, Clock, Settings, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function RestaurantProfile() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [uploading, setUploading] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['restaurant-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      const { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .select('rating, total_deliveries, business_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (restaurantError) throw restaurantError;

      setFullName(profileData?.full_name || '');
      setPhone(profileData?.phone || '');
      
      return { ...profileData, ...restaurantData };
    },
  });

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      if (!file) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['restaurant-profile'] });
      toast({ title: 'Foto atualizada com sucesso!' });
    } catch (error) {
      toast({ title: 'Erro ao atualizar foto', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const updateProfile = useMutation({
    mutationFn: async (data: { full_name: string; phone: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-profile'] });
      toast({ title: 'Perfil atualizado com sucesso!' });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: 'Erro ao atualizar perfil', variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({ full_name: fullName, phone });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const menuItems = [
    { icon: Clock, label: 'Minhas entregas', onClick: () => navigate('/restaurant/history') },
    { icon: Settings, label: 'Configurações', onClick: () => setIsEditing(!isEditing) },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Profile Header */}
      <div className="flex flex-col items-center pt-12 pb-8">
        <div className="relative">
          <Avatar className="h-32 w-32 border-4 border-muted">
            <AvatarImage src={profile?.avatar_url} alt={profile?.full_name} />
            <AvatarFallback className="text-3xl bg-muted text-foreground">
              {profile?.business_name?.charAt(0).toUpperCase() || profile?.full_name?.charAt(0).toUpperCase() || 'R'}
            </AvatarFallback>
          </Avatar>
          <label
            htmlFor="avatar-upload"
            className="absolute bottom-0 right-0 p-2 bg-primary rounded-full cursor-pointer hover:bg-primary/90 transition-colors"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary-foreground" />
            ) : (
              <Camera className="h-5 w-5 text-primary-foreground" />
            )}
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={uploadAvatar}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
        
        <h1 className="text-2xl font-bold mt-4 text-foreground">
          {profile?.business_name || profile?.full_name || 'Restaurante'}
        </h1>
        
        <div className="flex items-center gap-1 mt-2">
          <Star className="h-5 w-5 fill-primary text-primary" />
          <span className="text-xl font-semibold text-foreground">
            {profile?.rating ? Number(profile.rating).toFixed(1) : '0.0'}
          </span>
        </div>
      </div>

      {/* Menu Items */}
      <div className="px-6 space-y-2 mb-6">
        {menuItems.map((item, index) => (
          <button
            key={index}
            onClick={item.onClick}
            className="w-full flex items-center gap-4 p-4 rounded-xl bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="p-2 rounded-full bg-muted">
              <item.icon className="h-5 w-5 text-foreground" />
            </div>
            <span className="text-lg text-foreground">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Edit Form */}
      {isEditing && (
        <div className="px-6 pb-6">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={updateProfile.isPending} className="flex-1">
                    {updateProfile.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Salvar'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      setFullName(profile?.full_name || '');
                      setPhone(profile?.phone || '');
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
