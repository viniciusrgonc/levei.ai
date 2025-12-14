import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { ArrowUpCircle, Wallet, TrendingUp, ArrowLeft, Bike } from 'lucide-react';
import { DriverSidebar } from '@/components/DriverSidebar';
import NotificationBell from '@/components/NotificationBell';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
  driver_earnings?: number;
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
      const { data: driver } = await supabase
        .from('drivers')
        .select('id, earnings_balance')
        .eq('user_id', user.id)
        .single();

      if (driver) {
        setBalance(driver.earnings_balance || 0);

        const { data: transactionsData } = await supabase
          .from('transactions')
          .select('*')
          .eq('driver_id', driver.id)
          .order('created_at', { ascending: false })
          .limit(20);

        setTransactions(transactionsData || []);
        const total = transactionsData?.reduce((sum, t) => sum + (t.driver_earnings || 0), 0) || 0;
        setTotalEarnings(total);
      }
    } catch (error) {
      toast({ title: 'Erro', description: 'Não foi possível carregar os dados', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SidebarProvider defaultOpen={false}>
        <div className="min-h-screen flex w-full">
          <DriverSidebar />
          <div className="flex-1 flex flex-col">
            <header className="h-14 border-b flex items-center px-4 bg-primary safe-top">
              <SidebarTrigger className="text-primary-foreground" />
              <h1 className="text-lg font-bold text-primary-foreground ml-3">Ganhos</h1>
            </header>
            <main className="flex-1 p-4 bg-background">
              <div className="space-y-4 max-w-lg mx-auto">
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-48 rounded-xl" />
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full">
        <DriverSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 border-b flex items-center justify-between px-4 bg-primary safe-top">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-primary-foreground" />
              <Bike className="w-5 h-5 text-primary-foreground" />
              <h1 className="text-lg font-bold text-primary-foreground">Ganhos</h1>
            </div>
            <NotificationBell />
          </header>

          <main className="flex-1 p-4 bg-background overflow-auto safe-bottom">
            <div className="max-w-lg mx-auto space-y-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/driver/dashboard')}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Voltar
              </Button>

              {/* Saldo */}
              <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">Saldo Disponível</p>
                      <h2 className="text-3xl font-bold mt-1">R$ {balance.toFixed(2)}</h2>
                    </div>
                    <Wallet className="h-10 w-10 opacity-80" />
                  </div>
                  <Button variant="secondary" className="w-full mt-4" disabled>
                    <ArrowUpCircle className="h-4 w-4 mr-2" />
                    Solicitar Saque (em breve)
                  </Button>
                </CardContent>
              </Card>

              {/* Estatísticas */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="kpi-card">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Total Ganho</p>
                    <p className="text-xl font-bold text-success">R$ {totalEarnings.toFixed(2)}</p>
                  </CardContent>
                </Card>
                <Card className="kpi-card">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">Entregas Pagas</p>
                    <p className="text-xl font-bold">{transactions.length}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Histórico */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Histórico</CardTitle>
                  <CardDescription className="text-xs">Você recebe 80% de cada entrega</CardDescription>
                </CardHeader>
                <CardContent>
                  {transactions.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground text-sm">Nenhum pagamento</p>
                  ) : (
                    <div className="space-y-2">
                      {transactions.map((t) => (
                        <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div>
                            <p className="text-sm font-medium">Entrega concluída</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(t.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                          <span className="font-semibold text-success">
                            +R$ {(t.driver_earnings || t.amount).toFixed(2)}
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
      </div>
    </SidebarProvider>
  );
}