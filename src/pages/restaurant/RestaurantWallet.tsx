import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpCircle, ArrowDownCircle, Wallet, Plus, Lock, TrendingUp } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { BottomNav } from '@/components/BottomNav';
import leveiLogo from '@/assets/levei-logo.png';
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

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    fetchWalletData();
  }, [user, navigate]);

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
        .limit(20);
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
      description: 'A recarga via app estará disponível em breve. Entre em contato com o suporte para adicionar saldo.',
    });
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">

          {/* ── HERO ── */}
          <div className="bg-primary">
            <div
              className="flex items-center justify-between px-4 pb-2"
              style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
            >
              <div className="flex items-center gap-2">
                <img src={leveiLogo} alt="Levei.ai" className="h-10 w-10 rounded-xl object-cover" />
              </div>
              <NotificationBell />
            </div>

            <div className="px-4 pt-2 pb-6">
              <p className="text-white/70 text-sm">Saldo disponível</p>
              <h1 className="text-4xl font-bold text-white mt-1">R$ {balance.toFixed(2)}</h1>
              <p className="text-white/60 text-xs mt-1">
                R$ {blockedBalance.toFixed(2)} bloqueado em entregas ativas
              </p>
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

            {/* Adicionar saldo */}
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Plus className="h-4 w-4 text-blue-600" />
                </div>
                <h2 className="font-semibold text-gray-900">Adicionar saldo</h2>
              </div>

              {/* Atalhos */}
              <div className="grid grid-cols-4 gap-2">
                {quickAmounts.map((amount) => (
                  <button
                    key={amount}
                    onClick={handleAddFunds}
                    className="h-9 rounded-xl text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    R${amount}
                  </button>
                ))}
              </div>

              <button
                onClick={handleAddFunds}
                className="w-full h-11 rounded-xl bg-blue-600 text-white text-sm font-semibold flex items-center justify-center gap-2"
              >
                <ArrowUpCircle className="h-4 w-4" />
                Adicionar saldo
              </button>
              <p className="text-center text-xs text-gray-400">
                Recarga via app em breve · Contato: suporte@levei.ai
              </p>
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
                    const date = new Date(t.created_at);
                    return (
                      <div key={t.id} className="flex items-center justify-between px-4 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isPositive ? 'bg-green-100' : 'bg-red-100'
                          }`}>
                            {isPositive
                              ? <ArrowUpCircle className="h-4 w-4 text-green-600" />
                              : <ArrowDownCircle className="h-4 w-4 text-red-600" />}
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
                        <p className={`text-sm font-semibold flex-shrink-0 ml-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
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
    </div>
  );
}
