import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, Store, Bike, Shield } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type UserRole = 'admin' | 'restaurant' | 'driver' | null;

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching role:', error);
      }

      setRole(data?.role as UserRole || null);
      setLoading(false);
    };

    fetchUserRole();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: 'Até logo!',
      description: 'Você saiu da sua conta'
    });
    navigate('/auth');
  };

  const selectRole = async (selectedRole: 'restaurant' | 'driver') => {
    if (!user) return;
    setLoading(true);

    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: user.id, role: selectedRole });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível selecionar o perfil'
      });
    } else {
      setRole(selectedRole);
      toast({
        title: 'Perfil selecionado!',
        description: `Você agora é um ${selectedRole === 'restaurant' ? 'restaurante' : 'motoboy'}`
      });
      
      // Redirect based on role
      if (selectedRole === 'restaurant') {
        navigate('/restaurant/setup');
      } else {
        navigate('/driver/setup');
      }
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If no role, show role selection
  if (!role) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="max-w-4xl mx-auto pt-20">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Bem-vindo ao Movvi!</h1>
            <p className="text-lg text-muted-foreground">
              Escolha como você quer usar a plataforma
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => selectRole('restaurant')}>
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Store className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Sou Restaurante</CardTitle>
                <CardDescription>
                  Cadastre seu estabelecimento e crie entregas para motoboys disponíveis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Criar solicitações de entrega</li>
                  <li>• Acompanhar em tempo real</li>
                  <li>• Gerenciar histórico</li>
                  <li>• Avaliar entregadores</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => selectRole('driver')}>
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Bike className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Sou Motoboy</CardTitle>
                <CardDescription>
                  Cadastre-se como entregador e aceite entregas disponíveis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Aceitar entregas próximas</li>
                  <li>• Navegar até o destino</li>
                  <li>• Acompanhar ganhos</li>
                  <li>• Receber avaliações</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="text-center mt-8">
            <Button variant="ghost" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // If has role, show appropriate dashboard
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <div className="flex items-center gap-2 mt-2">
              {role === 'admin' && (
                <Badge variant="default">
                  <Shield className="mr-1 h-3 w-3" />
                  Admin
                </Badge>
              )}
              {role === 'restaurant' && (
                <Badge variant="default">
                  <Store className="mr-1 h-3 w-3" />
                  Restaurante
                </Badge>
              )}
              {role === 'driver' && (
                <Badge variant="default">
                  <Bike className="mr-1 h-3 w-3" />
                  Motoboy
                </Badge>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Em Construção</CardTitle>
            <CardDescription>
              O dashboard específico para {role === 'restaurant' ? 'restaurantes' : role === 'driver' ? 'motoboys' : 'admins'} está sendo desenvolvido.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Em breve você terá acesso a todas as funcionalidades da plataforma.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}