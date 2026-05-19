/**
 * /reset-password — Define nova senha após clicar no link do e-mail.
 * Supabase redireciona aqui com o token na URL hash (#access_token=...&type=recovery).
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import leveiLogo from '@/assets/levei-logo.png';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [done,            setDone]            = useState(false);
  const [validSession,    setValidSession]    = useState(false);
  const [checking,        setChecking]        = useState(true);

  // Supabase lida com o hash automaticamente via onAuthStateChange
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidSession(true);
      }
      setChecking(false);
    });

    // Timeout de segurança — se não receber evento em 3s, provavelmente link inválido
    const timer = setTimeout(() => setChecking(false), 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ variant: 'destructive', title: 'Senha muito curta', description: 'Mínimo 8 caracteres.' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ variant: 'destructive', title: 'Senhas não coincidem', description: 'Confirme a senha corretamente.' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } else {
      setDone(true);
      setTimeout(() => navigate('/auth', { replace: true }), 3000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={leveiLogo} alt="Levei.ai" className="h-14 w-14 rounded-2xl object-cover shadow-lg" />
        </div>

        {/* Verificando link */}
        {checking && (
          <div className="text-center space-y-2">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-500">Verificando link...</p>
          </div>
        )}

        {/* Link inválido ou expirado */}
        {!checking && !validSession && !done && (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <Lock className="h-7 w-7 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Link inválido ou expirado</h2>
            <p className="text-sm text-gray-500">
              Solicite um novo link de recuperação de senha na tela de login.
            </p>
            <Button
              onClick={() => navigate('/auth')}
              className="w-full h-12 rounded-xl bg-primary text-white font-semibold"
            >
              Ir para o login
            </Button>
          </div>
        )}

        {/* Sucesso */}
        {done && (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Senha alterada!</h2>
            <p className="text-sm text-gray-500">Redirecionando para o login...</p>
          </div>
        )}

        {/* Formulário de nova senha */}
        {!checking && validSession && !done && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Nova senha</h2>
              <p className="text-sm text-gray-500 mt-1">Escolha uma senha segura com pelo menos 8 caracteres.</p>
            </div>

            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-10 pr-10 h-12 rounded-xl border-gray-200 bg-gray-50 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {password && password.length < 8 && (
                  <p className="text-xs text-red-500">Mínimo 8 caracteres</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700">Confirmar senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Repita a nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="pl-10 h-12 rounded-xl border-gray-200 bg-gray-50 text-sm"
                  />
                </div>
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-xs text-red-500">As senhas não coincidem</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-xl text-base font-semibold bg-primary hover:bg-primary/90"
                loading={loading}
                disabled={password.length < 8 || password !== confirmPassword}
              >
                Salvar nova senha
              </Button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
