import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import NotificationBell from '@/components/NotificationBell';
import { BottomNav } from '@/components/BottomNav';
import { toast } from '@/hooks/use-toast';
import { User, Mail, Phone, Lock, Save, Building2, MapPin, FileText, Loader2 } from 'lucide-react';

interface Profile {
  full_name: string;
  phone: string;
}

interface RestaurantData {
  business_name: string;
  cnpj: string;
  address: string;
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=br`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } });
    const data = await res.json();
    if (data?.[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}

export default function RestaurantAccount() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingRestaurant, setSavingRestaurant] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile>({
    full_name: '',
    phone: '',
  });

  const [restaurant, setRestaurant] = useState<RestaurantData>({
    business_name: '',
    cnpj: '',
    address: '',
  });

  useEffect(() => {
    if (user) fetchAll();
  }, [user]);

  const fetchAll = async () => {
    const [{ data: profileData }, { data: restaurantData }] = await Promise.all([
      supabase.from('profiles').select('full_name, phone').eq('id', user!.id).single(),
      supabase.from('restaurants').select('id, business_name, cnpj, address').eq('user_id', user!.id).maybeSingle(),
    ]);

    if (profileData) setProfile(profileData);
    if (restaurantData) {
      setRestaurantId(restaurantData.id);
      setRestaurant({
        business_name: restaurantData.business_name || '',
        cnpj: restaurantData.cnpj || '',
        address: restaurantData.address || '',
      });
    }
    setLoading(false);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: profile.full_name, phone: profile.phone })
      .eq('id', user!.id);

    toast(error
      ? { variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar os dados pessoais.' }
      : { title: 'Dados pessoais salvos!' }
    );
    setSavingProfile(false);
  };

  const handleSaveRestaurant = async () => {
    if (!restaurantId) return;
    setSavingRestaurant(true);

    // Geocodifica o endereço para atualizar lat/lng
    const coords = await geocodeAddress(restaurant.address);

    const updatePayload: Record<string, any> = {
      business_name: restaurant.business_name,
      cnpj: restaurant.cnpj || null,
      address: restaurant.address,
    };
    if (coords) {
      updatePayload.latitude = coords.lat;
      updatePayload.longitude = coords.lng;
    }

    const { error } = await supabase
      .from('restaurants')
      .update(updatePayload)
      .eq('id', restaurantId);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar os dados do estabelecimento.' });
    } else {
      toast({
        title: 'Estabelecimento atualizado!',
        description: coords
          ? 'Endereço localizado e coordenadas atualizadas.'
          : 'Dados salvos. Endereço não pôde ser localizado no mapa.',
      });
    }
    setSavingRestaurant(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header
        className="sticky top-0 z-10 bg-primary border-b border-primary/20 flex items-center justify-between px-4"
        style={{ minHeight: 64, paddingTop: 'env(safe-area-inset-top)' }}
      >
        <h1 className="text-base font-bold text-white">Dados da Conta</h1>
        <NotificationBell />
      </header>

      <main className="flex-1 overflow-auto pb-24">
        <div className="max-w-lg mx-auto p-4 space-y-4">

          {/* ── Dados do Estabelecimento ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-5 w-5 text-primary" />
                Dados do Estabelecimento
              </CardTitle>
              <CardDescription>Nome, CNPJ e endereço do seu negócio</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="businessName">Nome do estabelecimento</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="businessName"
                    value={restaurant.business_name}
                    onChange={(e) => setRestaurant({ ...restaurant, business_name: e.target.value })}
                    placeholder="Nome do seu negócio"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cnpj">CNPJ <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="cnpj"
                    value={restaurant.cnpj}
                    onChange={(e) => setRestaurant({ ...restaurant, cnpj: e.target.value })}
                    placeholder="00.000.000/0000-00"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address">Endereço</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="address"
                    value={restaurant.address}
                    onChange={(e) => setRestaurant({ ...restaurant, address: e.target.value })}
                    placeholder="Rua, número, bairro, cidade"
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Usado como ponto de coleta padrão nas entregas
                </p>
              </div>

              <Button
                onClick={handleSaveRestaurant}
                disabled={savingRestaurant || !restaurant.business_name || !restaurant.address}
                className="w-full"
              >
                {savingRestaurant ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" />Salvar estabelecimento</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* ── Dados Pessoais ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-5 w-5 text-primary" />
                Dados Pessoais
              </CardTitle>
              <CardDescription>Seus dados de acesso e contato</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  value={profile.full_name}
                  onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  placeholder="Seu nome completo"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="pl-10 bg-gray-50 text-muted-foreground"
                  />
                </div>
                <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">Telefone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    className="pl-10"
                  />
                </div>
              </div>

              <Button onClick={handleSaveProfile} disabled={savingProfile} className="w-full">
                {savingProfile ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>
                ) : (
                  <><Save className="mr-2 h-4 w-4" />Salvar dados pessoais</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* ── Segurança ── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-5 w-5 text-primary" />
                Segurança
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">
                Alterar senha
              </Button>
            </CardContent>
          </Card>

        </div>
      </main>

      <BottomNav />
    </div>
  );
}
