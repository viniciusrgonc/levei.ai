import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpCircle, ArrowDownCircle, Wallet, Plus, Lock,
  TrendingUp, ArrowLeft, X, Loader2, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { BottomNav } from '@/components/BottomNav';
import NotificationBell from '@/components/NotificationBell';

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

const quickAmounts = [20, 50, 100, 200];

export default function RestaurantWallet() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [blockedBalance, setBlockedBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  // Saque modal
  const [showSaqueModal, setShowSaqueModal] = useState(false);
  const [saqueAmount, setSaqueAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [saqueLoading, setSaqueLoading] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    fetchWalletData();
  }, [user]);

  const fetchWalletData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data: restaurant, error } = await supabase
        .from('restaurants')
        .select('id, wallet_balance, blocked_balance')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;

      setRestaurantId(restaurant.id);
      setBalance(restaurant.wallet_balance || 0);
      setBlockedBalance(restaurant.blocked_balance || 0);

      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false })
        .limit(30);
      setTransactions(txData || []);
    } catch {
      toast({ title: 'Erro ao carregar dados', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddFunds = () => {
    toast({
      title: '🚀 Em breve!',
      description: 'A recarga via app estará disponível em breve. Entre em contato: suporte@levei.ai',
    });
  };

  const handleSaque = async () => {
    const amount = parseFloat(saqueAmount.replace(',', '.'));
    if (!amount || amount <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' }); return;
    }
    if (amount > balance) {
      toast({ title: 'Saldo insuficiente', description: `Saldo disponível: R$ ${balance.toFixed(2)}`, variant: 'destructive' }); return;
    }
    if (!pixKey.trim()) {
      toast({ title: 'Informe a chave PIX', variant: 'destructive' }); return;
    }
    if (!restaurantId) return;

    setSaqueLoading(true);
    try {
      const newBalance = parseFloat((balance - amount).toFixed(2));

      // Debita saldo
      const { error: balErr } = await supabase
        .from('restaurants')
        .update({ wallet_balance: newBalance })
        .eq('id', restaurantId);
      if (balErr) throw balErr;

      // Registra transação
      const { error: txErr } = await supabase
        .from('transactions')
        .insert({
          restaurant_id: restaurantId,
          amount: -amount,
          type: 'withdrawal',
          description: `Solicitação de saque - PIX: ${pixKey.trim()}`,
        });
      if (txErr) throw txErr;

      setBalance(newBalance);
      setShowSaqueModal(false);
      setSaqueAmount('');
      setPixKey('');
      toast({
        title: '✅ Saque solicitado!',
        description: `R$ ${amount.toFixed(2)} será processado em até 2 dias úteis via PIX.`,
      });
      fetchWalletData();
    } catch (err: any) {
      toast({ title: 'Erro ao solicitar saque', description: err?.message, variant: 'destructive' });
    } finally {
      setSaqueLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <div className="bg-primary h-52" />
        <div className="px-4 space-y-3 mt-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const txTypeConfig: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
    delivery_payment: { icon: <ArrowDownCircle className="h-4 w-4 text-red-600" />, color: 'text-red-600', bg: 'bg-red-100' },
    withdrawal:       { icon: <ArrowUpCircle className="h-4 w-4 text-orange-600" />, color: 'text-orange-600', bg: 'bg-orange-100' },
    refund:           { icon: <ArrowUpCircle className="h-4 w-4 text-green-600" />, color: 'text-green-600', bg: 'bg-green-100' },
    credit:           { icon: <ArrowUpCircle className="h-4 w-4 text-green-600" />, color: 'text-green-600', bg: 'bg-green-100' },
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

      {/* ── HERO ── */}
      <div className="bg-primary">
        <div
          className="flex items-center justify-between px-4 pb-2"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
        >
          <button
            onClick={() => navigate('/restaurant/dashboard')}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h2 className="text-white font-semibold text-base">Carteira</h2>
          <NotificationBell />
        </div>

        <div className="px-4 pt-2 pb-6 text-center">
          <p className="text-white/70 text-sm">Saldo disponível</p>
          <h1 className="text-5xl font-black text-white mt-1">R$ {balance.toFixed(2)}</h1>
          {blockedBalance > 0 && (
            <p className="text-white/60 text-xs mt-1">
              R$ {blockedBalance.toFixed(2)} bloqueado em entregas ativas
            </p>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-4">

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-xs text-gray-400">Disponível</p>
            </div>
            <p className="text-xl font-bold text-green-600">R$ {balance.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Lock className="h-4 w-4 text-amber-600" />
              </div>
              <p className="text-xs text-gray-400">Bloqueado</p>
            </div>
            <p className="text-xl font-bold text-amber-600">R$ {blockedBalance.toFixed(2)}</p>
          </div>
        </div>

        {/* Ações */}
        <div className="grid grid-cols-2 gap-3">
          {/* Adicionar saldo */}
          <button
            onClick={handleAddFunds}
            className="bg-white rounded-2xl shadow-sm p-4 flex flex-col items-center gap-2 text-center active:bg-gray-50"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Plus className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Adicionar saldo</p>
            <p className="text-xs text-gray-400">Em breve</p>
          </button>

          {/* Solicitar saque */}
          <button
            onClick={() => setShowSaqueModal(true)}
            disabled={balance <= 0}
            className="bg-white rounded-2xl shadow-sm p-4 flex flex-col items-center gap-2 text-center active:bg-gray-50 disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
              <ArrowUpCircle className="h-5 w-5 text-orange-600" />
            </div>
            <p className="text-sm font-semibold text-gray-900">Solicitar saque</p>
            <p className="text-xs text-gray-400">Via PIX · 2 dias úteis</p>
          </button>
        </div>

        {/* Atalhos de recarga */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Recarga rápida (em breve)</p>
          <div className="grid grid-cols-4 gap-2">
            {quickAmounts.map((amount) => (
              <button
                key={amount}
                onClick={handleAddFunds}
                className="h-9 rounded-xl text-sm font-semibold bg-gray-100 text-gray-500"
              >
                R${amount}
              </button>
            ))}
          </div>
        </div>

        {/* Histórico */}
        <div>
          <h2 className="font-semibold text-gray-900 mb-3 px-1">Histórico de transações</h2>
          {transactions.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-dashed border-gray-200 p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 mx-auto mb-3 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">Nenhuma transação ainda</p>
              <p className="text-xs text-gray-400">Seu histórico aparecerá aqui</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
              {transactions.map((t) => {
                const isPositive = t.amount > 0;
                const cfg = txTypeConfig[t.type] ?? {
                  icon: isPositive
                    ? <ArrowUpCircle className="h-4 w-4 text-green-600" />
                    : <ArrowDownCircle className="h-4 w-4 text-red-600" />,
                  color: isPositive ? 'text-green-600' : 'text-red-600',
                  bg: isPositive ? 'bg-green-100' : 'bg-red-100',
                };
                const date = new Date(t.created_at);
                return (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                        {cfg.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {t.description || (isPositive ? 'Crédito' : 'Débito')}
                        </p>
                        <p className="text-xs text-gray-400">
                          {date.toLocaleDateString('pt-BR')} · {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <p className={`text-sm font-bold flex-shrink-0 ml-2 ${cfg.color}`}>
                      {isPositive ? '+' : ''}R$ {Math.abs(t.amount).toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <BottomNav />

      {/* ── MODAL SAQUE ── */}
      {showSaqueModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSaqueModal(false); }}
        >
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

            <div className="px-6 pt-5 pb-8 space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">Solicitar Saque</h2>
                <button onClick={() => setShowSaqueModal(false)} className="p-2 rounded-full hover:bg-gray-100">
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              {/* Saldo disponível */}
              <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-green-700 font-medium">Saldo disponível</span>
                <span className="text-base font-bold text-green-700">R$ {balance.toFixed(2)}</span>
              </div>

              {/* Valor */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Valor a sacar (R$)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={saqueAmount}
                  onChange={(e) => setSaqueAmount(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-2xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                {/* Atalhos */}
                <div className="flex gap-2">
                  {[balance * 0.25, balance * 0.5, balance].map((v, i) => (
                    v > 0 && (
                      <button
                        key={i}
                        onClick={() => setSaqueAmount(v.toFixed(2))}
                        className="flex-1 h-8 rounded-lg bg-gray-100 text-xs font-semibold text-gray-600"
                      >
                        {i === 0 ? '25%' : i === 1 ? '50%' : 'Tudo'}
                      </button>
                    )
                  ))}
                </div>
              </div>

              {/* Chave PIX */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Chave PIX
                </label>
                <input
                  type="text"
                  placeholder="CPF, e-mail, telefone ou chave aleatória"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>

              <p className="text-xs text-gray-400 text-center">
                O pagamento é processado em até 2 dias úteis após a aprovação.
              </p>

              {/* Botão */}
              <button
                onClick={handleSaque}
                disabled={saqueLoading || !saqueAmount || !pixKey}
                className="w-full py-4 rounded-2xl bg-orange-500 text-white font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saqueLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</>
                ) : (
                  <><CheckCircle2 className="h-5 w-5" /> Solicitar Saque</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
