import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useAuthRedirect } from '@/hooks/useUserSetup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Bike } from 'lucide-react';

export default function Auth() {
  const { signIn, signUp, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const { loading: redirecting } = useAuthRedirect();

  // Show loading while checking auth state and redirecting
  if (user && redirecting) {
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

  // If user is logged in and not redirecting, they'll be redirected by useAuthRedirect
  if (user) {
    return null;
  }

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao entrar',
        description: error.message === 'Invalid login credentials' 
          ? 'Email ou senha incorretos' 
          : error.message
      });
      setLoading(false);
    } else {
      toast({
        title: 'Bem-vindo!',
        description: 'Login realizado com sucesso'
      });
      // useAuthRedirect will handle navigation
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const fullName = formData.get('fullName') as string;
    const phone = formData.get('phone') as string;

    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: 'Senha inválida',
        description: 'A senha deve ter no mínimo 6 caracteres'
      });
      setLoading(false);
      return;
    }

    const { error } = await signUp(email, password, fullName, phone);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar conta',
        description: error.message === 'User already registered' 
          ? 'Este email já está cadastrado' 
          : error.message
      });
      setLoading(false);
    } else {
      toast({
        title: 'Conta criada!',
        description: 'Escolha como você quer usar a plataforma'
      });
      // useAuthRedirect will handle navigation to role selection
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-3 py-6 sm:p-4 safe-top safe-bottom">
      {/* Subtle background */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_30%,hsl(var(--primary)/0.03),transparent_60%)]" />
      
      <Card className="w-full max-w-md relative z-10 animate-fade-in">
        <CardHeader className="space-y-3 sm:space-y-4 text-center pb-2">
          <div className="flex justify-center">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-primary flex items-center justify-center shadow-md">
              <Bike className="h-6 w-6 sm:h-7 sm:w-7 text-primary-foreground" />
            </div>
          </div>
          <div className="space-y-0.5 sm:space-y-1">
            <CardTitle className="text-xl sm:text-2xl font-bold">Levei</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Entregas sob demanda
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-3 sm:pt-4">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6">
              <TabsTrigger value="signin" className="text-xs sm:text-sm">Entrar</TabsTrigger>
              <TabsTrigger value="signup" className="text-xs sm:text-sm">Criar Conta</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-3 sm:space-y-4">
              <form onSubmit={handleSignIn} className="space-y-3 sm:space-y-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="signin-email" className="text-xs sm:text-sm">Email</Label>
                  <Input
                    id="signin-email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                    disabled={loading}
                    autoComplete="email"
                    className="h-10 sm:h-11 text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="signin-password" className="text-xs sm:text-sm">Senha</Label>
                  <Input
                    id="signin-password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    autoComplete="current-password"
                    className="h-10 sm:h-11 text-sm"
                  />
                </div>
                <Button type="submit" className="w-full h-11 sm:h-12 text-sm sm:text-base" size="lg" loading={loading}>
                  Entrar
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="space-y-3 sm:space-y-4">
              <form onSubmit={handleSignUp} className="space-y-3 sm:space-y-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="signup-name" className="text-xs sm:text-sm">Nome Completo</Label>
                  <Input
                    id="signup-name"
                    name="fullName"
                    type="text"
                    placeholder="João Silva"
                    required
                    disabled={loading}
                    autoComplete="name"
                    className="h-10 sm:h-11 text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="signup-phone" className="text-xs sm:text-sm">Telefone</Label>
                  <Input
                    id="signup-phone"
                    name="phone"
                    type="tel"
                    placeholder="(11) 99999-9999"
                    required
                    disabled={loading}
                    autoComplete="tel"
                    className="h-10 sm:h-11 text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="signup-email" className="text-xs sm:text-sm">Email</Label>
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                    disabled={loading}
                    autoComplete="email"
                    className="h-10 sm:h-11 text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="signup-password" className="text-xs sm:text-sm">Senha</Label>
                  <Input
                    id="signup-password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    required
                    disabled={loading}
                    minLength={6}
                    autoComplete="new-password"
                    className="h-10 sm:h-11 text-sm"
                  />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    Mínimo de 6 caracteres
                  </p>
                </div>
                <Button type="submit" className="w-full h-11 sm:h-12 text-sm sm:text-base" size="lg" loading={loading}>
                  Criar Conta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}