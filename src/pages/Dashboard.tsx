import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useUserSetup, useAuthRedirect } from '@/hooks/useUserSetup';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, Store, Bike, ArrowRight } from 'lucide-react';
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
      navigate(selectedRole === 'restaurant' ? '/restaurant/setup' : '/driver/setup');
    }
  };

  // Show loading while checking user setup
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center animate-pulse-soft">
            <Bike className="h-6 w-6 text-primary-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // If user has a role, useAuthRedirect will handle navigation
  // This page should only be shown when user has no role
  if (role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center animate-pulse-soft">
            <Bike className="h-6 w-6 text-primary-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Redirecionando...</p>
        </div>
      </div>
    );
  }

  // Show role selection for users without a role
  return (
    <div className="min-h-screen bg-background p-4">
      {/* Subtle background */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_30%,hsl(var(--primary)/0.03),transparent_60%)]" />
      
      <div className="max-w-3xl mx-auto pt-12 md:pt-20 relative z-10">
        <div className="text-center mb-10 animate-fade-in">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg">
              <Bike className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3 text-foreground">Bem-vindo ao Levei!</h1>
          <p className="text-lg text-muted-foreground">
            Escolha como você quer usar a plataforma
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 md:gap-6">
          <Card 
            className="cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animate-fade-in group"
            onClick={() => !submitting && selectRole('restaurant')}
            style={{ animationDelay: '100ms' }}
          >
            <CardHeader className="pb-3">
              <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Store className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-xl flex items-center justify-between">
                Sou Solicitante
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </CardTitle>
              <CardDescription>
                Solicite entregas para entregadores disponíveis
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Criar solicitações de entrega
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Acompanhar em tempo real
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Gerenciar histórico
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Avaliar entregadores
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animate-fade-in group"
            onClick={() => !submitting && selectRole('driver')}
            style={{ animationDelay: '200ms' }}
          >
            <CardHeader className="pb-3">
              <div className="w-14 h-14 bg-success/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-success/20 transition-colors">
                <Bike className="h-7 w-7 text-success" />
              </div>
              <CardTitle className="text-xl flex items-center justify-between">
                Sou Entregador
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-success group-hover:translate-x-1 transition-all" />
              </CardTitle>
              <CardDescription>
                Aceite entregas e ganhe dinheiro
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-success" />
                  Aceitar entregas próximas
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-success" />
                  Navegar até o destino
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-success" />
                  Acompanhar ganhos
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-success" />
                  Receber avaliações
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-8 animate-fade-in" style={{ animationDelay: '300ms' }}>
          <Button 
            variant="ghost" 
            onClick={handleSignOut}
            disabled={submitting}
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}