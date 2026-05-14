import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useAuthRedirect } from '@/hooks/useUserSetup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { PasswordStrengthIndicator, validatePassword } from '@/components/PasswordStrengthIndicator';
import { Mail, Lock, Eye, EyeOff, MapPin, Bike, Store, ArrowLeft, CheckCircle2 } from 'lucide-react';
import leveiLogo from '@/assets/levei-logo.png';

/** Credenciais guardadas em sessionStorage durante o onboarding */
const REGISTER_KEY = 'levei-register';

export default function Auth() {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);

  // Signup state
  const [signupRole,  setSignupRole]  = useState<'driver' | 'restaurant' | null>(null);
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPwd,   setSignupPwd]   = useState('');
  const [signupStep,  setSignupStep]  = useState<'role' | 'credentials'>('role');

  const { loading: redirecting } = useAuthRedirect();

  if (user && redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="flex flex-col items-center gap-4">
          <img src={leveiLogo} alt="Levei.ai" className="h-16 w-16 rounded-2xl object-cover animate-pulse" />
          <p className="text-sm text-primary-foreground/60">Carregando...</p>
        </div>
      </div>
    );
  }

  if (user) return null;

  // ── Login ──────────────────────────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const email    = formData.get('email') as string;
    const password = formData.get('password') as string;
    const { error } = await signIn(email, password);
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao entrar',
        description: error.message === 'Invalid login credentials' ? 'Email ou senha incorretos' : error.message,
      });
      setLoading(false);
    } else {
      toast({ title: 'Bem-vindo!', description: 'Login realizado com sucesso' });
    }
  };

  // ── Signup ─────────────────────────────────────────────────────────────────────
  const handleSignUp = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!signupRole) {
      toast({ variant: 'destructive', title: 'Escolha seu perfil', description: 'Selecione Entregador ou Solicitante para continuar.' });
      return;
    }

    const { isValid, errors } = validatePassword(signupPwd);
    if (!isValid) {
      toast({ variant: 'destructive', title: 'Senha inválida', description: `A senha precisa de: ${errors.slice(0, 2).join(', ')}` });
      return;
    }

    // Salva credenciais em sessionStorage — a conta só será criada no submit final do formulário
    sessionStorage.setItem(REGISTER_KEY, JSON.stringify({
      email:    signupEmail,
      password: signupPwd,
      role:     signupRole,
    }));

    // Navega para o formulário de cadastro SEM criar auth.users ainda
    if (signupRole === 'driver') {
      navigate('/driver/register');
    } else {
      navigate('/restaurant/register');
    }
  };

  const switchToSignup = () => {
    setMode('signup');
    setShowPassword(false);
    setSignupStep('role');
    setSignupRole(null);
  };

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL — branding ── */}
      <div className="hidden lg:flex lg:w-[42%] flex-col relative overflow-hidden bg-primary">
        <div className="absolute top-[-80px] left-[-80px] w-72 h-72 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-[-60px] right-[-60px] w-64 h-64 rounded-full bg-sky-400/10 blur-3xl" />

        <div className="relative z-10 flex flex-col h-full p-10">
          <div className="flex items-center gap-3">
            <img src={leveiLogo} alt="Levei.ai" className="h-10 w-10 rounded-xl object-cover" />
          </div>
          <div className="flex-1 flex flex-col justify-center">
            <h1 className="text-4xl xl:text-5xl font-extrabold text-primary-foreground leading-tight">
              Entregas<br />rápidas,<br />simples e<br />seguras.
            </h1>
            <div className="mt-5 mb-6 w-10 h-1 rounded-full bg-sky-400" />
            <p className="text-primary-foreground/65 text-base leading-relaxed max-w-xs">
              Conectamos você ao motoboy ideal para cada entrega.
            </p>
            <div className="mt-14 flex flex-col gap-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-sky-500 flex items-center justify-center shadow-lg shadow-sky-500/30">
                  <MapPin className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 border-t-2 border-dashed border-sky-400/30" />
              </div>
              <div className="ml-4 w-px h-8 border-l-2 border-dashed border-sky-400/30" />
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full border-2 border-sky-400 bg-primary/60 flex items-center justify-center">
                  <MapPin className="h-4 w-4 text-sky-400" />
                </div>
                <div className="flex-1 border-t-2 border-dashed border-sky-400/30" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg border border-sky-400/30 bg-sky-500/10 flex items-center justify-center">
              <MapPin className="h-3.5 w-3.5 text-sky-400" />
            </div>
            <span className="text-primary-foreground/40 text-sm font-medium">levei.ai</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — form ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white overflow-y-auto">

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <img src={leveiLogo} alt="Levei.ai" className="h-12 w-12 rounded-2xl object-cover" />
        </div>

        <div className="w-full max-w-sm">

          {/* ═══ LOGIN ═══ */}
          {mode === 'signin' && (
            <>
              <div className="mb-7">
                <h2 className="text-[2rem] font-bold text-gray-900 leading-tight">Olá! 👋</h2>
                <h2 className="text-[2rem] font-bold text-gray-900 leading-tight">Bem-vindo de volta!</h2>
                <p className="text-gray-500 mt-2 text-sm">
                  Faça login para continuar e solicitar suas entregas com facilidade.
                </p>
              </div>

              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <Input name="email" type="email" placeholder="seu@email.com" required disabled={loading} autoComplete="email"
                      className="pl-10 h-12 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-sm" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <Input name="password" type={showPassword ? 'text' : 'password'} placeholder="Digite sua senha"
                      required disabled={loading} autoComplete="current-password"
                      className="pl-10 pr-10 h-12 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-sm" />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="text-right">
                    <button type="button" className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                      onClick={() => toast({ title: 'Em breve', description: 'Recuperação de senha será ativada em breve' })}>
                      Esqueceu sua senha?
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full h-12 rounded-xl text-base font-semibold bg-primary hover:bg-primary/90" loading={loading}>
                  Entrar
                </Button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <div className="flex-1 border-t border-gray-200" />
                <span className="text-xs text-gray-400">ou continue com</span>
                <div className="flex-1 border-t border-gray-200" />
              </div>

              <div className="space-y-3">
                <button type="button" onClick={() => toast({ title: 'Em breve', description: 'Login com Google será ativado em breve' })}
                  className="w-full h-12 rounded-xl border border-gray-200 flex items-center justify-center gap-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continuar com Google
                </button>
                <button type="button" onClick={() => toast({ title: 'Em breve', description: 'Login com Apple será ativado em breve' })}
                  className="w-full h-12 rounded-xl border border-gray-200 flex items-center justify-center gap-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.36.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  Continuar com Apple
                </button>
              </div>

              <p className="text-center mt-7 text-sm text-gray-500">
                Ainda não tem conta?{' '}
                <button type="button" onClick={switchToSignup} className="text-primary font-semibold hover:text-primary/80 transition-colors">
                  Criar conta
                </button>
              </p>
            </>
          )}

          {/* ═══ SIGNUP ═══ */}
          {mode === 'signup' && (
            <>
              <div className="mb-6">
                {signupStep === 'credentials' && (
                  <button type="button" onClick={() => setSignupStep('role')}
                    className="flex items-center gap-1.5 text-primary text-sm font-medium mb-4">
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </button>
                )}
                <h2 className="text-[2rem] font-bold text-gray-900 leading-tight">Criar conta</h2>
                <p className="text-gray-500 mt-1 text-sm">
                  {signupStep === 'role'
                    ? 'Como você quer usar a plataforma?'
                    : 'Informe seu email e crie uma senha.'}
                </p>
              </div>

              {/* ── Step 1: Role selection ── */}
              {signupStep === 'role' && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setSignupRole('driver')}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                      signupRole === 'driver' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      signupRole === 'driver' ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <Bike className={`h-6 w-6 ${signupRole === 'driver' ? 'text-green-600' : 'text-gray-500'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">Sou Entregador</p>
                      <p className="text-xs text-gray-500 mt-0.5">Aceite pedidos e ganhe na plataforma</p>
                    </div>
                    {signupRole === 'driver' && <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSignupRole('restaurant')}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                      signupRole === 'restaurant' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      signupRole === 'restaurant' ? 'bg-primary/10' : 'bg-gray-100'
                    }`}>
                      <Store className={`h-6 w-6 ${signupRole === 'restaurant' ? 'text-primary' : 'text-gray-500'}`} />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">Sou Solicitante</p>
                      <p className="text-xs text-gray-500 mt-0.5">Solicite entregas para seu negócio</p>
                    </div>
                    {signupRole === 'restaurant' && <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />}
                  </button>

                  <Button
                    type="button"
                    disabled={!signupRole}
                    onClick={() => setSignupStep('credentials')}
                    className="w-full h-12 rounded-xl text-base font-semibold bg-primary hover:bg-primary/90 disabled:opacity-40 mt-2"
                  >
                    Continuar
                  </Button>
                </div>
              )}

              {/* ── Step 2: Credentials ── */}
              {signupStep === 'credentials' && (
                <form onSubmit={handleSignUp} className="space-y-4">
                  {/* Selected role badge */}
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${
                    signupRole === 'driver' ? 'bg-green-50 border border-green-200' : 'bg-primary/5 border border-primary/20'
                  }`}>
                    {signupRole === 'driver'
                      ? <Bike className="h-4 w-4 text-green-600" />
                      : <Store className="h-4 w-4 text-primary" />
                    }
                    <span className={`text-sm font-semibold ${signupRole === 'driver' ? 'text-green-700' : 'text-primary'}`}>
                      {signupRole === 'driver' ? 'Entregador' : 'Solicitante'}
                    </span>
                    <button type="button" onClick={() => setSignupStep('role')}
                      className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline">
                      trocar
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        required
                        disabled={loading}
                        autoComplete="email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        className="pl-10 h-12 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-gray-700">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Crie uma senha forte"
                        required
                        disabled={loading}
                        minLength={8}
                        autoComplete="new-password"
                        value={signupPwd}
                        onChange={(e) => setSignupPwd(e.target.value)}
                        className="pl-10 pr-10 h-12 rounded-xl border-gray-200 bg-gray-50 focus:bg-white text-sm"
                      />
                      <button type="button" onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <PasswordStrengthIndicator password={signupPwd} />
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 rounded-xl text-base font-semibold bg-primary hover:bg-primary/90"
                    loading={loading}
                  >
                    Continuar para o cadastro
                  </Button>
                </form>
              )}

              <p className="text-center mt-7 text-sm text-gray-500">
                Já tem conta?{' '}
                <button type="button" onClick={() => { setMode('signin'); setShowPassword(false); }}
                  className="text-primary font-semibold hover:text-primary/80 transition-colors">
                  Entrar
                </button>
              </p>
            </>
          )}

          <p className="text-center mt-5 text-xs text-gray-400 flex items-center justify-center gap-1.5">
            <Lock className="h-3 w-3 flex-shrink-0" />
            Seus dados estão protegidos e sua privacidade é nossa prioridade.
          </p>
        </div>
      </div>
    </div>
  );
}
