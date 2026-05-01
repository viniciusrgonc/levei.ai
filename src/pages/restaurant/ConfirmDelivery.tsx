import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Navigation, Clock, Bike, CheckCircle2, ChevronRight, Wallet } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import leveiLogo from '@/assets/levei-logo.png';

// ── Mock pricing helper (deterministic based on address length so it's stable) ──
function mockPrice(from: string, to: string) {
  const base = 12 + ((from.length + to.length) % 7);
  return { min: base, max: base + 6 };
}

function mockTime(from: string, to: string) {
  const base = 20 + ((from.length * to.length) % 16);
  return { min: base, max: base + 10 };
}

export default function ConfirmDelivery() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';

  const [success, setSuccess] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const price = mockPrice(from, to);
  const time = mockTime(from, to);

  const handleSolicitar = () => {
    setRequesting(true);
    // Simula delay de confirmação
    setTimeout(() => {
      setRequesting(false);
      setSuccess(true);
    }, 1200);
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-5">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Entrega solicitada!</h1>
          <p className="text-sm text-gray-500 mb-1">Sua solicitação foi recebida.</p>
          <p className="text-sm text-gray-400 mb-8">
            Um entregador será designado em breve.
          </p>

          {/* Route summary */}
          <div className="w-full bg-white rounded-2xl shadow-sm p-4 mb-6 text-left space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 mt-1 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Coleta</p>
                <p className="text-sm font-medium text-gray-800 leading-snug">{from}</p>
              </div>
            </div>
            <div className="border-l-2 border-dashed border-gray-200 ml-[5px] h-3" />
            <div className="flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Entrega</p>
                <p className="text-sm font-medium text-gray-800 leading-snug">{to}</p>
              </div>
            </div>
          </div>

          <div className="w-full space-y-3">
            <button
              onClick={() => navigate('/restaurant/history')}
              className="w-full h-12 rounded-2xl bg-blue-600 text-white font-semibold text-sm flex items-center justify-center gap-2"
            >
              Ver minhas entregas
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate('/restaurant/dashboard')}
              className="w-full h-12 rounded-2xl border border-gray-200 text-gray-700 font-medium text-sm"
            >
              Voltar ao início
            </button>
          </div>
        </div>

        <BottomNav />
      </div>
    );
  }

  // ── Confirmation screen ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* Header */}
      <header
        className="bg-white border-b border-gray-100 shadow-sm flex items-center gap-3 px-4"
        style={{ minHeight: 56, paddingTop: 'env(safe-area-inset-top)' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-2">
          <img src={leveiLogo} alt="Levei.ai" className="h-7 w-7 rounded-lg object-cover" />
          <h1 className="font-semibold text-gray-900 text-sm">Confirmar pedido</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-32 p-4 space-y-4">

        {/* Rota */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <h2 className="font-semibold text-gray-900 text-sm mb-1">Rota da entrega</h2>

          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-1">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <div className="w-px h-8 bg-dashed bg-gray-200" style={{ borderLeft: '2px dashed #e5e7eb' }} />
              <div className="w-3 h-3 rounded-full bg-red-500" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Coleta</p>
                <p className="text-sm font-medium text-gray-900 leading-snug">{from || '—'}</p>
              </div>
              <div className="mt-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Entrega</p>
                <p className="text-sm font-medium text-gray-900 leading-snug">{to || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Detalhes estimados */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-0 divide-y divide-gray-50">
          <h2 className="font-semibold text-gray-900 text-sm pb-3">Estimativas</h2>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2.5 text-gray-600">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                <Bike className="h-4 w-4 text-blue-500" />
              </div>
              <span className="text-sm">Tipo de veículo</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">Motoboy</span>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2.5 text-gray-600">
              <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
                <Wallet className="h-4 w-4 text-green-500" />
              </div>
              <span className="text-sm">Valor estimado</span>
            </div>
            <div className="text-right">
              <span className="text-base font-bold text-green-600">
                R$ {price.min},00 – R$ {price.max},00
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2.5 text-gray-600">
              <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
                <Clock className="h-4 w-4 text-orange-500" />
              </div>
              <span className="text-sm">Tempo estimado</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">{time.min}–{time.max} min</span>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2.5 text-gray-600">
              <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                <Navigation className="h-4 w-4 text-purple-500" />
              </div>
              <span className="text-sm">Pagamento</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">Carteira Levei.ai</span>
          </div>
        </div>

        {/* Nota sobre valores mockados */}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
          <MapPin className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Valores e tempo são estimativas. O valor final será calculado ao criar a entrega completa.
          </p>
        </div>

      </main>

      {/* Footer CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-10 space-y-2"
        style={{ padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
      >
        {/* Botão principal: abre fluxo completo com endereço pré-preenchido */}
        <button
          onClick={() => navigate(`/restaurant/new-delivery?to=${encodeURIComponent(to)}`)}
          className="w-full rounded-2xl text-base font-semibold bg-blue-600 text-white flex items-center justify-center gap-2"
          style={{ height: 52 }}
        >
          <CheckCircle2 className="h-5 w-5" />
          Criar entrega completa
        </button>

        {/* Botão secundário: mock rápido (sem veículo/tipo obrigatório) */}
        <button
          onClick={handleSolicitar}
          disabled={requesting}
          className="w-full rounded-2xl text-sm font-medium border border-gray-200 text-gray-600 flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ height: 44 }}
        >
          {requesting ? (
            <>
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              Confirmando...
            </>
          ) : (
            'Confirmar rápido (sem selecionar veículo)'
          )}
        </button>
      </div>
    </div>
  );
}
