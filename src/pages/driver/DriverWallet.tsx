import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Wallet, TrendingUp, Clock, ArrowUpCircle, ArrowLeft, PackageCheck, Gift, AlertCircle } from 'lucide-react';
import { DriverBottomNav } from '@/components/DriverBottomNav';
import { subDays, startOfDay, isAfter } from 'date-fns';

// ── Types ────────────────────────────────────────────────────────────────────
interface WalletData {
  balance: number;
  pendingBalance: number;
  transactions: Transaction[];
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  driver_earnings: number | null;
  created_at: string;
}

// ── Query ─────────────────────────────────────────────────────────────────────
async function fetchWallet(userId: string): Promise<WalletData> {
  const { data: driver } = await supabase
    .from('drivers')
    .select('id, earnings_balance, pending_balance')
    .eq('user_id', userId)
    .single();

  if (!driver) return { balance: 0, pendingBalance: 0, transactions: [] };

  const { data: txData } = await supabase
    .from('transactions')
    .select('id, type, amount, driver_earnings, created_at')
    .eq('driver_id', driver.id)
    .order('created_at', { ascending: false })
    .limit(100);

  return {
    balance: driver.earnings_balance || 0,
    pendingBalance: driver.pending_balance || 0,
    transactions: (txData || []) as Transaction[],
  };
}

// ── Transaction meta ──────────────────────────────────────────────────────────
function txMeta(type: string) {
  if (type === 'delivery_payment' || type === 'completed')
    return { label: 'Entrega concluída', icon: PackageCheck, bg: 'bg-green-100', color: 'text-green-600', positive: true };
  if (type === 'bonus' || type === 'reward')
    return { label: 'Bônus / Recompensa', icon: Gift, bg: 'bg-purple-100', color: 'text-purple-600', positive: true };
  if (type === 'withdrawal' || type === 'saque')
    return { label: 'Saque realizado', icon: ArrowUpCircle, bg: 'bg-red-50', color: 'text-red-500', positive: false };
  if (type === 'platform_fee')
    return { label: 'Taxa da plataforma', icon: AlertCircle, bg: 'bg-gray-100', color: 'text-gray-500', positive: false };
  return   { label: 'Pagamento', icon: Wallet, bg: 'bg-blue-100', color: 'text-blue-600', positive: true };
}

// ── Period filter ─────────────────────────────────────────────────────────────
type Period = 'today' | '7d' | '30d' | 'all';
const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: '7d',    label: '7 dias' },
  { key: '30d',   label: '30 dias' },
  { key: 'all',   label: 'Tudo' },
];

function filterByPeriod(transactions: Transaction[], period: Period) {
  if (period === 'all') return transactions;
  const cutoff =
    period === 'today' ? startOfDay(new Date()) :
    period === '7d'    ? subDays(new Date(), 7) :
                         subDays(new Date(), 30);
  return transactions.filter((t) => isAfter(new Date(t.created_at), cutoff));
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DriverWallet() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('30d');

  const { data, isLoading } = useQuery({
    queryKey: ['driver-wallet', user?.id],
    queryFn: () => fetchWallet(user!.id),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  const allTransactions = data?.transactions ?? [];
  const filtered = filterByPeriod(allTransactions, period);

  const periodEarnings = filtered
    .filter((t) => t.driver_earnings != null && t.driver_earnings > 0)
    .reduce((sum, t) => sum + (t.driver_earnings ?? 0), 0);

  const periodCount = filtered.filter(
    (t) => t.type === 'delivery_payment' || t.type === 'completed'
  ).length;

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-primary h-56" />
        <div className="px-4 pt-4 space-y-3">
          <div className="bg-white rounded-2xl h-20 animate-pulse" />
          <div className="bg-white rounded-2xl h-48 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── HERO ── */}
      <div className="bg-gradient-to-br from-primary to-primary/80">
        <div
          className="flex items-center gap-3 px-4 pb-2"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
        >
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h1 className="text-white font-bold text-xl flex-1">Ganhos</h1>
        </div>

        {/* Balance */}
        <div className="px-5 pt-3 pb-5">
          <p className="text-white/60 text-xs font-medium uppercase tracking-wider">Saldo disponível</p>
          <p className="text-5xl font-black text-white mt-1 leading-none">
            R$ {(data?.balance ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          {(data?.pendingBalance ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <Clock className="h-3.5 w-3.5 text-amber-300" />
              <span className="text-amber-200 text-xs font-medium">
                R$ {(data?.pendingBalance ?? 0).toFixed(2)} aguardando confirmação
              </span>
            </div>
          )}

          {/* Saque button */}
          <button
            disabled
            className="mt-4 w-full flex items-center justify-center gap-2 bg-white/10 border border-white/20 rounded-2xl py-3 text-white/50 text-sm font-medium cursor-not-allowed"
          >
            <ArrowUpCircle className="h-4 w-4" />
            Solicitar saque · Em breve
          </button>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <main className="flex-1 overflow-y-auto pb-28 px-4 pt-4 space-y-4">

        {/* Period tabs */}
        <div className="flex gap-2 bg-white rounded-2xl shadow-sm p-1.5">
          {PERIOD_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                period === key
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* KPIs do período */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
            <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-sm font-black text-green-600 leading-none">
              R$ {periodEarnings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">Ganhos</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center mx-auto mb-2">
              <PackageCheck className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-sm font-black text-gray-900 leading-none">{periodCount}</p>
            <p className="text-[10px] text-gray-400 mt-1">Entregas</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-2">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-sm font-black text-amber-600 leading-none">
              R$ {(data?.pendingBalance ?? 0).toFixed(2)}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">Pendente</p>
          </div>
        </div>

        {/* Transaction list */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Histórico de pagamentos
            </p>
            <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              80% por entrega
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-dashed border-gray-200">
              <div className="w-12 h-12 rounded-full bg-gray-100 mx-auto mb-3 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Nenhum pagamento neste período</p>
              <p className="text-xs text-gray-400 mt-1">Complete entregas para aparecer aqui</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
              {filtered.map((t) => {
                const meta = txMeta(t.type);
                const Icon = meta.icon;
                const value = t.driver_earnings ?? t.amount;
                const date = new Date(t.created_at);
                return (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3.5">
                    <div className={`w-9 h-9 rounded-full ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`h-4 w-4 ${meta.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{meta.label}</p>
                      <p className="text-xs text-gray-400">
                        {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <p className={`text-sm font-bold ${meta.positive ? 'text-green-600' : 'text-red-500'}`}>
                      {meta.positive ? '+' : '-'}R$ {Math.abs(value).toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>

      <DriverBottomNav />
    </div>
  );
}
