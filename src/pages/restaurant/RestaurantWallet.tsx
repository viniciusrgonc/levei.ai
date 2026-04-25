import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { ArrowLeft, ArrowUpCircle, ArrowDownCircle, Wallet, Plus, Loader2, Lock } from 'lucide-react';
import { RestaurantSidebar } from '@/components/RestaurantSidebar';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useAddFunds } from '@/hooks/useAddFunds';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { BottomNav } from '@/components/BottomNav';

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
  const [addAmount, setAddAmount] = useState('');
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const { addFunds, loading: addingFunds } = useAddFunds({
    onSuccess: (newBalance) => {
      setBalance(newBalance);
      setAddAmount('');
      fetchWalletData();
      toast({ title: '✅ Saldo adicionado com sucesso!' });
    }
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchWalletData();
  }, [user, navigate]);

  const fetchWalletData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('id, wallet_balance, blocked_balance')
        .eq('user_id', user.id)
        .single();

      if (restaurantError) throw restaurantError;

      setRestaurantId(restaurant.id);
      setBalance(restaurant.wallet_balance || 0);
      setBlockedBalance(restaurant.blocked_balance || 0);

      const { data: transactionsData } = await supabase
        .from('transactions')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false })
        .limit(20);

      setTransactions(transactionsData || []);
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFunds = async () => {
    const amount = parseFloat(addAmount);
    
    if (!restaurantId || isNaN(amount) || amount <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Por favor, insira um valor maior que zero',
        variant: 'destructive',
      });
      return;
    }

    await addFunds(restaurantId, amount);
  };

  const handleQuickAmount = (amount: number) => {
    setAddAmount(amount.toString());
  };

  if (loading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <RestaurantSidebar />
          <div className="flex-1 p-4 space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <RestaurantSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="sticky top-0 z-10 h-14 border-b bg-background flex items-center px-4 gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/restaurant/dashboard')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold">Carteira</h1>
          </header>

          <main className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Wallet className="h-6 w-6" />
                    <span className="text-sm opacity-80">Saldo Disponível</span>
                  </div>
                  <p className="text-4xl font-bold">
                    R$ {balance.toFixed(2)}
                  </p>
                  <p className="text-sm opacity-70 mt-2">
                    Disponível para novas entregas
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Lock className="h-6 w-6" />
                    <span className="text-sm opacity-80">Saldo Bloqueado</span>
                  </div>
                  <p className="text-4xl font-bold">
                    R$ {blockedBalance.toFixed(2)}
                  </p>
                  <p className="text-sm opacity-70 mt-2">
                    Em entregas em andamento
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Add Funds */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Adicionar Saldo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quick Amounts */}
                <div className="grid grid-cols-4 gap-2">
                  {quickAmounts.map((amount) => (
                    <Button
                      key={amount}
                      variant={addAmount === amount.toString() ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleQuickAmount(amount)}
                    >
                      R$ {amount}
                    </Button>
                  ))}
                </div>

                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      R$
                    </span>
                    <Input
                      type="number"
                      placeholder="0,00"
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value)}
                      className="pl-10"
                      disabled={addingFunds}
                    />
                  </div>
                  <Button 
                    onClick={handleAddFunds}
                    disabled={addingFunds || !addAmount}
                    className="gap-2"
                  >
                    {addingFunds ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowUpCircle className="h-4 w-4" />
                    )}
                    Adicionar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Transactions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Histórico</CardTitle>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhuma transação ainda</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {transaction.amount > 0 ? (
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                              <ArrowUpCircle className="h-5 w-5 text-green-600" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                              <ArrowDownCircle className="h-5 w-5 text-red-600" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-sm">{transaction.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(transaction.created_at).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        </div>
                        <p className={`font-semibold ${
                          transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.amount > 0 ? '+' : ''}R$ {Math.abs(transaction.amount).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </main>
          <BottomNav />
        </div>
      </div>
    </SidebarProvider>
  );
}
