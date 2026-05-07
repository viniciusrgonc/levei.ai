import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Navigation, Clock, Bike, CheckCircle2, ChevronRight, Wallet, Loader2, AlertCircle } from 'lucide-react';
import { BottomNav } from '@/components/BottomNav';
import { calculateDeliveryPrice, PricingBreakdown } from '@/lib/pricing';

// ── Haversine ─────────────────────────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocode(address: string): Promise<{ lat: number; lng: number }> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
    { headers: { 'Accept-Language': 'pt-BR' } },
  );
  const data = await res.json();
  if (!data.length) throw new Error('Endereço não encontrado');
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

export default function ConfirmDelivery() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from') || '';
  const to   = searchParams.get('to')   || '';

  const [success, setSuccess] = useState(false);
  const [pricing, setPricing] = useState<PricingBreakdown | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [pricingError, setPricingError] = useState(false);

  // ── Calcular preço real via geocodificação + RPC ───────────────────────────
  useEffect(() => {
    if (!from || !to) { setPricingLoading(false); return; }
    let cancelled = false;

    const load = async () => {
      try {
        setPricingLoading(true);
        setPricingError(false);
        const [fromCoords, toCoords] = await Promise.all([geocode(from), geocode(to)]);
        if (cancelled) return;
        const km = haversine(fromCoords.lat, fromCoords.lng, toCoords.lat, toCoords.lng);
        const breakdown = await calculateDeliveryPrice(km);
        if (cancelled) return;
        setDistanceKm(parseFloat(km.toFixed(1)));
        setPricing(breakdown);
      } catch {
        if (!cancelled) setPricingError(true);
      } finally {
        if (!cancelled) setPricingLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [from, to]);

  // ── Tela de sucesso ───────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Entrega solicitada!</h1>
          <p className="text-sm text-gray-500">Um entregador será designado em breve.</p>

          <div className="w-full bg-white rounded-2xl shadow-sm p-4 text-left space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Coleta</p>
                <p className="text-sm font-medium text-gray-800 leading-snug">{from}</p>
              </div>
            </div>
            <div className="border-l-2 border-dashed border-gray-200 ml-[5px] h-3" />
            <div className="flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400">Entrega</p>
                <p className="text-sm font-medium text-gray-800 leading-snug">{to}</p>
              </div>
            </div>
          </div>

          <div className="w-full space-y-3">
            <button
              onClick={() => navigate('/restaurant/history')}
              className="w-full h-12 rounded-2xl bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2"
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

  // ── Tela de confirmação ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* Header */}
      <header
        className="bg-primary flex items-center gap-3 px-4"
        style={{ minHeight: 56, paddingTop: 'calc(env(safe-area-inset-top) + 8px)', paddingBottom: 12 }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>
        <h1 className="font-semibold text-white text-base">Confirmar pedido</h1>
      </header>

      <main className="flex-1 overflow-y-auto pb-36 p-4 space-y-4">

        {/* Rota */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <h2 className="font-semibold text-gray-900 text-sm">Rota da entrega</h2>
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-1">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <div className="flex-1 w-px border-l-2 border-dashed border-gray-200" style={{ height: 32 }} />
              <div className="w-3 h-3 rounded-full bg-red-500" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Coleta</p>
                <p className="text-sm font-medium text-gray-900 leading-snug">{from || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Entrega</p>
                <p className="text-sm font-medium text-gray-900 leading-snug">{to || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Estimativas */}
        <div className="bg-white rounded-2xl shadow-sm p-4 divide-y divide-gray-50">
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

          {distanceKm !== null && (
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2.5 text-gray-600">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                  <Navigation className="h-4 w-4 text-purple-500" />
                </div>
                <span className="text-sm">Distância</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">{distanceKm} km</span>
            </div>
          )}

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2.5 text-gray-600">
              <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
                <Wallet className="h-4 w-4 text-green-500" />
              </div>
              <span className="text-sm">Valor estimado</span>
            </div>
            <div className="text-right">
              {pricingLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              ) : pricingError || !pricing ? (
                <span className="text-sm text-gray-400">—</span>
              ) : (
                <span className="text-base font-bold text-green-600">
                  R$ {pricing.final_price.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2.5 text-gray-600">
              <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
                <Clock className="h-4 w-4 text-orange-500" />
              </div>
              <span className="text-sm">Tempo estimado</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">
              {distanceKm ? `${Math.ceil(distanceKm * 3)}–${Math.ceil(distanceKm * 4)} min` : '—'}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2.5 text-gray-600">
              <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center">
                <MapPin className="h-4 w-4 text-gray-500" />
              </div>
              <span className="text-sm">Pagamento</span>
            </div>
            <span className="text-sm font-semibold text-gray-900">Carteira Levei.ai</span>
          </div>
        </div>

        {/* Breakdown detalhado */}
        {pricing && !pricingLoading && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Composição do valor</h3>
            <div className="space-y-1.5">
              {(() => {
                const dynamicFee = pricing.dynamic_enabled && pricing.dynamic_multiplier > 1
                  ? parseFloat((pricing.final_price - pricing.base_price - pricing.product_addon - pricing.return_price).toFixed(2))
                  : 0;
                return (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Taxa base ({distanceKm} km)</span>
                      <span className="font-medium">R$ {pricing.base_price.toFixed(2)}</span>
                    </div>
                    {pricing.product_addon > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Adicional por produto</span>
                        <span className="font-medium">R$ {pricing.product_addon.toFixed(2)}</span>
                      </div>
                    )}
                    {pricing.return_price > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Taxa de retorno</span>
                        <span className="font-medium">R$ {pricing.return_price.toFixed(2)}</span>
                      </div>
                    )}
                    {dynamicFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Tarifa dinâmica ({pricing.dynamic_multiplier}×)</span>
                        <span className="font-medium text-orange-600">R$ {dynamicFee.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-100 pt-2 flex justify-between text-sm font-bold">
                      <span>Total</span>
                      <span className="text-green-600">R$ {pricing.final_price.toFixed(2)}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Aviso erro de geocodificação */}
        {pricingError && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Não foi possível calcular o preço exato. Crie a entrega completa para ver o valor real.
            </p>
          </div>
        )}
      </main>

      {/* Footer CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-lg z-10"
        style={{ padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={() => navigate(`/restaurant/new-delivery?to=${encodeURIComponent(to)}`)}
          className="w-full rounded-2xl text-base font-semibold bg-primary text-white flex items-center justify-center gap-2"
          style={{ height: 52 }}
        >
          <CheckCircle2 className="h-5 w-5" />
          {pricing && !pricingLoading
            ? `Criar entrega · R$ ${pricing.final_price.toFixed(2)}`
            : 'Criar entrega completa'}
        </button>
        <p className="text-center text-xs text-gray-400 mt-2">
          Selecione veículo, tipo de produto e endereço detalhado no próximo passo
        </p>
      </div>
    </div>
  );
}
