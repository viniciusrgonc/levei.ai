import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import NotificationBell from '@/components/NotificationBell';
import { toast } from '@/hooks/use-toast';
import { User, Mail, Phone, Lock, Save } from 'lucide-react';

interface Profile {
  full_name: string;
  phone: string;
}

export default function RestaurantAccount() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    full_name: '',
    phone: '',
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', user?.id)
      .single();

    if (data) {
      setProfile(data);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        phone: profile.phone,
      })
      .eq('id', user?.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível salvar as alterações',
      });
    } else {
      toast({
        title: 'Sucesso!',
        description: 'Dados pessoais atualizados',
      });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
          <header className="border-b border-border flex items-center justify-between px-6 bg-primary"
            style={{ minHeight: 64, paddingTop: 'env(safe-area-inset-top)' }}>
            <h1 className="text-xl font-bold text-primary-foreground">Editar Dados Pessoais</h1>
            <NotificationBell />
          </header>

          <main className="flex-1 p-6 bg-background overflow-auto animate-fade-in">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Personal Information */}
              <Card className="animate-fade-in hover:shadow-lg transition-all duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Informações Pessoais
                  </CardTitle>
                  <CardDescription>Atualize seus dados pessoais</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nome Completo</Label>
                    <Input
                      id="fullName"
                      value={profile.full_name}
                      onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                      placeholder="Seu nome completo"
                      className="transition-all duration-300 focus:scale-105"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      O email não pode ser alterado
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        value={profile.phone}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                        placeholder="(00) 00000-0000"
                        className="pl-10 transition-all duration-300 focus:scale-105"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full transition-all duration-300 hover:scale-110 active:scale-95"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </CardContent>
              </Card>

              {/* Security */}
              <Card className="animate-fade-in hover:shadow-lg transition-all duration-300" style={{ animationDelay: '100ms' }}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Segurança
                  </CardTitle>
                  <CardDescription>Gerencie suas configurações de segurança</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    className="w-full transition-all duration-300 hover:scale-105 active:scale-95"
                  >
                    Alterar Senha
                  </Button>
                </CardContent>
              </Card>
            </div>
          </main>
    </div>
  );
}
