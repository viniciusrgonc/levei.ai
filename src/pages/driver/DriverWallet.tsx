import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, TrendingUp, Clock, ChevronRight, ArrowUpCircle } from 'lucide-react';
import { DriverBottomNav } from '@/components/DriverBottomNav';
import leveiLogo from '@/assets/levei-logo.png';
import NotificationBell from '@/components/NotificationBell';

interface Transaction {
  id: string;
  amount: number;
  driver_earnings?: number;
  created_at: string;
}

export default function DriverWallet() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    fetchWalletData();
  }, [user]);

  const fetchWalletData = async () => {
    if (!user) return;
    try {
      const { data: driver } = await supabase
        .from('drivers')
        .select('id, earnings_balance, pending_balance')
        .eq('user_id', user.id)
        .single();

      if (driver) {
        setBalance(driver.earnings_balance || 0);
        setPendingBalance(driver.pending_balance || 0);
        const { data: txData } = await supabase
          .from('transactions')
          .select('*')
          .eq('driver_id', driver.id)
          .order('created_at', { ascending: false })
          .limit(30);
        const list = txData || [];
        setTransactions(list);
        setTotalEarnings(list.reduce((sum, t) => sum + (t.driver_earnings || 0), 0));
      }
    } catch {
      toast({ title: 'Erro ao carregar dados', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-primary h-52" />
        <div className="px-4 space-y-3 mt-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── HERO ── */}
      <div className="bg-primary">
        <div
          className="flex items-center justify-between px-4 pb-2"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
        >
          <img src={leveiLogo} alt="Levei" className="h-10 w-10 rounded-xl object-cover" />
          <NotificationBell />
        </div>

        <div className="px-4 pt-2 pb-6">
          <p className="text-white/70 text-sm">Saldo disponível</p>
          <h1 className="text-4xl font-bold text-white mt-1">
            R$ {balance.toFixed(2)}
          </h1>
          <button
            disabled
            className="mt-4 w-full flex items-center justify-center gap-2 bg-white/10 border border-white/20 rounded-xl py-2.5 text-white text-sm font-medium opacity-50 cursor-not-allowed"
          >
            <ArrowUpCircle className="h-4 w-4" />
            Solicitar saque (em breve)
          </button>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4 space-y-4">

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center mx-auto mb-1.5">
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <p className="text-base font-bold text-green-600">R$ {totalEarnings.toFixed(2)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Total ganho</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mx-auto mb-1.5">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-base font-bold text-amber-600">R$ {pendingBalance.toFixed(2)}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Pendente</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-3 text-center">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center mx-auto mb-1.5">
              <Wallet className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-base font-bold text-gray-900">{transactions.length}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Entregas</p>
          </div>
        </div>

        {/* Transactions */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="font-semibold text-gray-900">Histórico de pagamentos</h2>
            <p className="text-xs text-gray-400">80% de cada entrega</p>
          </div>

          {transactions.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-dashed border-gray-200 p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 mx-auto mb-3 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-gray-700 mb-1">Nenhum pagamento ainda</p>
              <p className="text-xs text-gray-400">Seus ganhos aparecerão aqui</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-50 overflow-hidden">
              {transactions.map((t) => {
                const value = t.driver_earnings || t.amount;
                const date = new Date(t.created_at);
                return (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Entrega concluída</p>
                        <p className="text-xs text-gray-400">
                          {date.toLocaleDateString('pt-BR')} · {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-green-600">+R$ {value.toFixed(2)}</p>
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
