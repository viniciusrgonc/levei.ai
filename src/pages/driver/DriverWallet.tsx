import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { ArrowUpCircle, Wallet, TrendingUp } from 'lucide-react';
import { DriverSidebar } from '@/components/DriverSidebar';
import NotificationBell from '@/components/NotificationBell';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
  driver_earnings?: number;
  platform_fee?: number;
}

export default function DriverWallet() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalEarnings, setTotalEarnings] = useState(0);

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

      const { data: driver, error: driverError } = await supabase
        .from('drivers')
        .select('id, earnings_balance')
        .eq('user_id', user.id)
        .single();

      if (driverError) throw driverError;

      setBalance(driver.earnings_balance || 0);

      const { data: transactionsData, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('driver_id', driver.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (transactionsError) throw transactionsError;

      setTransactions(transactionsData || []);

      const total = transactionsData?.reduce((sum, t) => sum + (t.driver_earnings || 0), 0) || 0;
      setTotalEarnings(total);

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

  if (loading) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <DriverSidebar />
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
        <DriverSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold">Financeiro</h1>
            <div className="ml-auto">
              <NotificationBell />
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-6 bg-background">
            <div className="max-w-4xl mx-auto space-y-6">
              <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">Saldo Disponível</p>
                      <h2 className="text-4xl font-bold mt-2">
                        R$ {balance.toFixed(2)}
                      </h2>
                    </div>
                    <Wallet className="h-12 w-12 opacity-80" />
                  </div>
                  <Button 
                    variant="secondary" 
                    className="w-full mt-6 gap-2"
                    disabled
                  >
                    <ArrowUpCircle className="h-4 w-4" />
                    Solicitar Saque
                  </Button>
                  <p className="text-xs text-primary-foreground/80 mt-2 text-center">
                    Em breve você poderá solicitar o saque do seu saldo
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Estatísticas
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Ganhos</p>
                    <p className="text-2xl font-bold text-green-500">
                      R$ {totalEarnings.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Entregas Pagas</p>
                    <p className="text-2xl font-bold">{transactions.length}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Pagamentos</CardTitle>
                  <CardDescription>
                    Pagamentos recebidos pelas entregas realizadas (80% do valor)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {transactions.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum pagamento registrado
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {transactions.map((transaction) => (
                        <div
                          key={transaction.id}
                          className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <ArrowUpCircle className="h-5 w-5 text-green-500" />
                            <div>
                              <p className="font-medium">{transaction.description}</p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(transaction.created_at).toLocaleString('pt-BR')}
                              </p>
                              {transaction.driver_earnings && transaction.platform_fee && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Valor total: R$ {transaction.amount.toFixed(2)} | 
                                  Você recebeu: R$ {transaction.driver_earnings.toFixed(2)} (80%) | 
                                  Taxa plataforma: R$ {transaction.platform_fee.toFixed(2)} (20%)
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="text-lg font-semibold text-green-500">
                            +R$ {(transaction.driver_earnings || transaction.amount).toFixed(2)}
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
