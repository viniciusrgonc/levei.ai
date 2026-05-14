/**
 * /register — Tela de seleção de perfil.
 * Primeira tela do fluxo de cadastro. Sem coleta de dados.
 * Define o role e navega para o onboarding específico.
 */
import { useNavigate } from 'react-router-dom';
import { Bike, Store, ArrowLeft } from 'lucide-react';
import leveiLogo from '@/assets/levei-logo.png';

const REGISTER_KEY = 'levei-register';

export default function Register() {
  const navigate = useNavigate();

  const select = (role: 'driver' | 'customer') => {
    // Armazena apenas o role — credenciais serão coletadas dentro do formulário
    sessionStorage.setItem(REGISTER_KEY, JSON.stringify({ role }));
    navigate(role === 'driver' ? '/driver/register' : '/customer/register');
  };

  return (
    <div
      className="min-h-screen bg-primary flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <button
          onClick={() => navigate('/auth')}
          className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center active:scale-90 transition-transform"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* Hero */}
      <div className="flex-1 flex flex-col px-6 pt-6 pb-10">
        <div className="flex flex-col items-center text-center mb-10">
          <img src={leveiLogo} alt="Levei.ai" className="h-16 w-16 rounded-2xl object-cover mb-5 shadow-xl" />
          <h1 className="text-2xl font-black text-white leading-tight">
            Como deseja usar<br />a Levei?
          </h1>
          <p className="text-white/60 text-sm mt-2">
            Escolha seu perfil para começar o cadastro
          </p>
        </div>

        <div className="space-y-4 max-w-sm mx-auto w-full">

          {/* Entregador */}
          <button
            onClick={() => select('driver')}
            className="w-full bg-white rounded-3xl p-6 flex items-center gap-5 text-left active:scale-[0.98] transition-all shadow-lg"
          >
            <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <Bike className="h-8 w-8 text-green-600" />
            </div>
            <div className="flex-1">
              <p className="font-black text-gray-900 text-lg">Quero fazer entregas</p>
              <p className="text-gray-500 text-xs mt-1 leading-relaxed">
                Cadastre-se como entregador e comece a receber pedidos
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['Pedidos próximos', 'Ganhos', 'Recompensas'].map((f) => (
                  <span key={f} className="text-[10px] font-semibold bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </button>

          {/* Solicitante */}
          <button
            onClick={() => select('customer')}
            className="w-full bg-white rounded-3xl p-6 flex items-center gap-5 text-left active:scale-[0.98] transition-all shadow-lg"
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Store className="h-8 w-8 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-black text-gray-900 text-lg">Quero solicitar entregas</p>
              <p className="text-gray-500 text-xs mt-1 leading-relaxed">
                Solicite entregadores para o seu negócio ou uso pessoal
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {['Cadastro simples', 'Rastreamento', 'Histórico'].map((f) => (
                  <span key={f} className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </button>
        </div>

        {/* Já tem conta */}
        <p className="text-center mt-10 text-white/60 text-sm">
          Já tem uma conta?{' '}
          <button
            onClick={() => navigate('/auth')}
            className="text-white font-bold underline underline-offset-2"
          >
            Entrar
          </button>
        </p>
      </div>
    </div>
  );
}
