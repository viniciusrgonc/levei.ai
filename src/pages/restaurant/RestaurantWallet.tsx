import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { RestaurantSidebar } from '@/components/RestaurantSidebar';
import NotificationBell from '@/components/NotificationBell';
import { Wallet, TrendingUp, TrendingDown, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

export default function RestaurantWallet() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchWalletData();
    }
  }, [user]);

  const fetchWalletData = async () => {
    // Mock data for now
    setBalance(1250.50);
    setTransactions([
      {
        id: '1',
        amount: -45.00,
        type: 'delivery',
        description: 'Pagamento entrega #1234',
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        amount: -38.50,
        type: 'delivery',
        description: 'Pagamento entrega #1233',
        created_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: '3',
        amount: 500.00,
        type: 'deposit',
        description: 'Recarga de saldo',
        created_at: new Date(Date.now() - 172800000).toISOString(),
      },
    ]);
    setLoading(false);
  };

  const stats = {
    thisMonth: -245.80,
    deliveries: 12,
    average: 20.48,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full">
        <RestaurantSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-primary">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
              <h1 className="text-xl font-bold text-primary-foreground">Carteira & Saldo</h1>
            </div>
            <NotificationBell />
          </header>

          <main className="flex-1 p-6 bg-background overflow-auto animate-fade-in">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Balance Card */}
              <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground animate-scale-in hover:shadow-2xl transition-all duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Saldo Disponível
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold mb-2">
                    R$ {balance.toFixed(2)}
                  </div>
                  <p className="text-primary-foreground/80 text-sm">
                    Disponível para pagamento de entregas
                  </p>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="animate-fade-in hover:shadow-lg transition-all duration-300 hover:scale-105">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-destructive" />
                      Gasto Este Mês
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">
                      R$ {Math.abs(stats.thisMonth).toFixed(2)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="animate-fade-in hover:shadow-lg transition-all duration-300 hover:scale-105" style={{ animationDelay: '50ms' }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <ArrowUpRight className="h-4 w-4 text-primary" />
                      Entregas Realizadas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.deliveries}</div>
                  </CardContent>
                </Card>

                <Card className="animate-fade-in hover:shadow-lg transition-all duration-300 hover:scale-105" style={{ animationDelay: '100ms' }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Ticket Médio
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">R$ {stats.average.toFixed(2)}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Transactions */}
              <Card className="animate-fade-in" style={{ animationDelay: '150ms' }}>
                <CardHeader>
                  <CardTitle>Histórico de Transações</CardTitle>
                  <CardDescription>Últimas movimentações da sua carteira</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {transactions.map((transaction, index) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-4 rounded-2xl border hover:bg-muted/50 transition-all duration-300 hover:scale-105 animate-fade-in"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            transaction.amount < 0 ? 'bg-destructive/10' : 'bg-primary/10'
                          }`}>
                            {transaction.amount < 0 ? (
                              <ArrowDownRight className="h-5 w-5 text-destructive" />
                            ) : (
                              <ArrowUpRight className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{transaction.description}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {new Date(transaction.created_at).toLocaleString('pt-BR')}
                            </div>
                          </div>
                        </div>
                        <div className={`text-lg font-bold ${
                          transaction.amount < 0 ? 'text-destructive' : 'text-primary'
                        }`}>
                          {transaction.amount < 0 ? '-' : '+'} R$ {Math.abs(transaction.amount).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
