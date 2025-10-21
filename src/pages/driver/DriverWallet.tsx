import { useState, useEffect } from 'react';
import { DriverSidebar } from '@/components/DriverSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import NotificationBell from '@/components/NotificationBell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Wallet, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

export default function DriverWallet() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchWalletData();
    }
  }, [user]);

  const fetchWalletData = async () => {
    try {
      // Buscar driver_id
      const { data: driver } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!driver) return;

      // Buscar transações
      const { data: transactionsData, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('driver_id', driver.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTransactions(transactionsData || []);

      // Calcular saldo
      const total = transactionsData?.reduce((acc, transaction) => {
        return transaction.type === 'delivery_payment' 
          ? acc + Number(transaction.amount)
          : acc - Number(transaction.amount);
      }, 0) || 0;

      setBalance(total);
    } catch (error) {
      console.error('Erro ao buscar dados da carteira:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DriverSidebar />
        <main className="flex-1 overflow-y-auto">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold">Financeiro</h1>
            <div className="ml-auto">
              <NotificationBell />
            </div>
          </header>

          <div className="p-6 space-y-6">
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
                  className="w-full mt-6"
                  onClick={() => alert('Funcionalidade de saque em desenvolvimento')}
                >
                  Solicitar Saque
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Histórico de Transações
                </CardTitle>
                <CardDescription>
                  Veja todas as suas transações financeiras
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted-foreground">Carregando...</p>
                ) : transactions.length === 0 ? (
                  <p className="text-muted-foreground">Nenhuma transação encontrada</p>
                ) : (
                  <div className="space-y-4">
                    {transactions.map((transaction) => (
                      <div 
                        key={transaction.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {transaction.type === 'delivery_payment' ? (
                            <ArrowUpRight className="h-5 w-5 text-green-500" />
                          ) : (
                            <ArrowDownRight className="h-5 w-5 text-red-500" />
                          )}
                          <div>
                            <p className="font-medium">{transaction.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(transaction.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                        <span className={`font-semibold ${
                          transaction.type === 'delivery_payment' ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {transaction.type === 'delivery_payment' ? '+' : '-'} R$ {Number(transaction.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
