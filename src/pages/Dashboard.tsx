import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useUserSetup, useAuthRedirect } from '@/hooks/useUserSetup';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, Store, Bike, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import leveiLogo from '@/assets/levei-logo.png';

// ── Spinner splash ─────────────────────────────────────────────────────────────
function Splash({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-primary gap-4">
      <img src={leveiLogo} alt="Levei.ai" className="h-16 w-16 rounded-2xl object-cover" />
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 text-white/60 animate-spin" />
        <p className="text-white/60 text-sm">{label}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { role, loading } = useUserSetup();
  useAuthRedirect();
  const [submitting, setSubmitting] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const selectRole = async (selectedRole: 'restaurant' | 'driver') => {
    if (!user || submitting) return;
    setSubmitting(true);
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: user.id, role: selectedRole });
    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível selecionar o perfil' });
      setSubmitting(false);
    } else {
      window.location.href = selectedRole === 'restaurant' ? '/restaurant/setup' : '/driver/setup';
    }
  };

  if (loading) return <Splash label="Carregando..." />;
  if (role)   return <Splash label="Redirecionando..." />;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* ── Hero ── */}
      <div className="bg-gradient-to-br from-primary to-primary/80 px-6 pt-16 pb-10">
        <div className="flex flex-col items-center text-center">
          <img src={leveiLogo} alt="Levei.ai" className="h-14 w-14 rounded-2xl object-cover mb-4 shadow-xl" />
          <h1 className="text-2xl font-black text-white leading-tight">
            Bem-vindo ao Levei!
          </h1>
          <p className="text-white/65 text-sm mt-2 max-w-xs">
            Como você quer usar a plataforma?
          </p>
        </div>
      </div>

      {/* ── Role cards ── */}
      <main className="flex-1 px-4 pt-6 pb-10 space-y-4 max-w-sm mx-auto w-full">

        {/* Solicitante */}
        <button
          onClick={() => selectRole('restaurant')}
          disabled={submitting}
          className="w-full bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4 text-left hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-60"
        >
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Store className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-base">Sou Solicitante</p>
            <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">
              Crie pedidos de entrega e acompanhe em tempo real
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['Solicitar entregas', 'Rastreamento', 'Histórico'].map((f) => (
                <span key={f} className="text-[10px] font-medium bg-primary/8 text-primary px-2 py-0.5 rounded-full">
                  {f}
                </span>
              ))}
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-300 flex-shrink-0" />
        </button>

        {/* Entregador */}
        <button
          onClick={() => selectRole('driver')}
          disabled={submitting}
          className="w-full bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4 text-left hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-60"
        >
          <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <Bike className="h-7 w-7 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-base">Sou Entregador</p>
            <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">
              Aceite entregas próximas e acompanhe seus ganhos
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {['Aceitar pedidos', 'Ganhos', 'Recompensas'].map((f) => (
                <span key={f} className="text-[10px] font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                  {f}
                </span>
              ))}
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-300 flex-shrink-0" />
        </button>

        {submitting && (
          <div className="flex items-center justify-center gap-2 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-gray-500">Configurando seu perfil...</span>
          </div>
        )}

        <div className="pt-2 text-center">
          <button
            onClick={handleSignOut}
            disabled={submitting}
            className="flex items-center gap-2 text-gray-400 text-sm mx-auto hover:text-gray-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair da conta
          </button>
        </div>
      </main>

    </div>
  );
}
