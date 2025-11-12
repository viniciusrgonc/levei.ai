import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useUserSetup, useAuthRedirect } from '@/hooks/useUserSetup';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, Store, Bike, Shield } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { role, loading } = useUserSetup();
  useAuthRedirect(); // Handle automatic redirects for users with roles
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);

    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: user.id, role: selectedRole });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível selecionar o perfil'
      });
      setSubmitting(false);
    } else {
      toast({
        title: 'Perfil selecionado!',
        description: `Você agora é um ${selectedRole === 'restaurant' ? 'solicitante' : 'entregador'}`
      });
      
      // Redirect will be handled by useAuthRedirect hook
      // which will detect the new role and redirect appropriately
    }
  };

  // Show loading while checking user setup
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If user has a role, useAuthRedirect will handle navigation
  // This page should only be shown when user has no role
  if (role) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show role selection for users without a role
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
            <Card 
              className="cursor-pointer hover:shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 animate-fade-in hover:border-primary/50"
              onClick={() => !submitting && selectRole('restaurant')}
              style={{ animationDelay: '100ms' }}
            >
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110">
                  <Store className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Sou Solicitante</CardTitle>
                <CardDescription>
                  Cadastre seu estabelecimento e solicite entregas para entregadores disponíveis
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

            <Card 
              className="cursor-pointer hover:shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 animate-fade-in hover:border-primary/50"
              onClick={() => !submitting && selectRole('driver')}
              style={{ animationDelay: '200ms' }}
            >
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110">
                  <Bike className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Sou Entregador</CardTitle>
                <CardDescription>
                  Cadastre-se como entregador e aceite entregas disponíveis na sua região
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

          <div className="text-center mt-8 animate-fade-in" style={{ animationDelay: '300ms' }}>
            <Button 
              variant="ghost" 
              onClick={handleSignOut}
              className="transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // This should never be reached as users with roles are redirected above
  return null;
}