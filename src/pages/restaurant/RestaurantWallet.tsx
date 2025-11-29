import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { ArrowUpCircle, ArrowDownCircle, Wallet, DollarSign } from 'lucide-react';
import { RestaurantSidebar } from '@/components/RestaurantSidebar';
import NotificationBell from '@/components/NotificationBell';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useAddFunds } from '@/hooks/useAddFunds';
import { toast } from '@/hooks/use-toast';

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

export default function RestaurantWallet() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [addAmount, setAddAmount] = useState('');
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const { addFunds, loading: addingFunds } = useAddFunds({
    onSuccess: (newBalance) => {
      setBalance(newBalance);
      setAddAmount('');
      fetchWalletData();
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
        .select('id, wallet_balance')
        .eq('user_id', user.id)
        .single();

      if (restaurantError) throw restaurantError;

      setRestaurantId(restaurant.id);
      setBalance(restaurant.wallet_balance || 0);

      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (transactionsError) throw transactionsError;

      setTransactions(transactionsData || []);
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os dados da carteira',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddFunds = async () => {
    const amount = parseFloat(addAmount);
    
    if (!restaurantId) {
      toast({
        title: 'Erro',
        description: 'Restaurante não encontrado',
        variant: 'destructive',
      });
      return;
    }

    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Valor inválido',
        description: 'Por favor, insira um valor maior que zero',
        variant: 'destructive',
      });
      return;
    }

    await addFunds(restaurantId, amount);
  };

  const getTransactionIcon = (type: string, amount: number) => {
    if (type === 'delivery_payment' && amount > 0) {
      return <ArrowUpCircle className="h-5 w-5 text-green-500" />;
    }
    return <ArrowDownCircle className="h-5 w-5 text-red-500" />;
  };

  const formatAmount = (amount: number, type: string) => {
    const value = Math.abs(amount);
    const prefix = amount > 0 ? '+' : '-';
    return `${prefix}R$ ${value.toFixed(2)}`;
  };

  if (loading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <RestaurantSidebar />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Carregando...</p>
            </div>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <RestaurantSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b flex items-center justify-between px-6 bg-primary">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
              <h1 className="text-xl font-bold text-primary-foreground">Carteira</h1>
            </div>
            <NotificationBell />
          </header>

          <main className="flex-1 overflow-y-auto p-6 bg-background">
            <div className="max-w-4xl mx-auto space-y-6">
              <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Saldo Disponível
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">
                    R$ {balance.toFixed(2)}
                  </div>
                  <p className="text-primary-foreground/80 text-sm mt-2">
                    Disponível para pagamento de entregas
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Adicionar Saldo
                  </CardTitle>
                  <CardDescription>
                    Recarregue sua carteira para criar novas entregas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label htmlFor="amount">Valor (R$)</Label>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="0.00"
                        value={addAmount}
                        onChange={(e) => setAddAmount(e.target.value)}
                        min="0"
                        step="0.01"
                        disabled={addingFunds}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button 
                        onClick={handleAddFunds}
                        disabled={addingFunds || !addAmount}
                        className="gap-2"
                      >
                        <ArrowUpCircle className="h-4 w-4" />
                        {addingFunds ? 'Processando...' : 'Adicionar Saldo'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Transações</CardTitle>
                  <CardDescription>
                    Últimas movimentações na sua carteira
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {transactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhuma transação registrada
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {transactions.map((transaction) => (
                        <div
                          key={transaction.id}
                          className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {getTransactionIcon(transaction.type, transaction.amount)}
                            <div>
                              <p className="font-medium">{transaction.description}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(transaction.created_at).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </div>
                          <div className={`text-lg font-semibold ${
                            transaction.amount > 0
                              ? 'text-green-500' 
                              : 'text-red-500'
                          }`}>
                            {formatAmount(transaction.amount, transaction.type)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
