import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import NotificationBell from '@/components/NotificationBell';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  DollarSign, 
  TrendingUp,
  Calendar,
  Filter
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
  driver_earnings: number | null;
  platform_fee: number | null;
  restaurant_id: string | null;
  driver_id: string | null;
  delivery_id: string | null;
}

interface Stats {
  total_transactions: number;
  total_platform_fees: number;
  total_driver_earnings: number;
  total_payments: number;
}

export default function AdminTransactions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats>({
    total_transactions: 0,
    total_platform_fees: 0,
    total_driver_earnings: 0,
    total_payments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [platformFeePercent, setPlatformFeePercent] = useState(20);
  const [driverCommissionPercent, setDriverCommissionPercent] = useState(80);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    supabase.from('platform_settings').select('key, value').then(({ data }) => {
      if (data) {
        const fee = data.find(s => s.key === 'platform_fee_percentage');
        const comm = data.find(s => s.key === 'driver_commission_percentage');
        if (fee) setPlatformFeePercent(parseFloat(fee.value));
        if (comm) setDriverCommissionPercent(parseFloat(comm.value));
      }
    });
    fetchTransactions();
  }, [user, navigate, filter]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('type', filter as 'delivery_payment' | 'platform_fee' | 'withdrawal');
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;

      setTransactions(data || []);

      // Calculate stats
      const platformFees = data?.filter(t => t.type === 'platform_fee')
        .reduce((sum, t) => sum + (t.platform_fee || 0), 0) || 0;
      
      const driverEarnings = data?.filter(t => t.driver_id)
        .reduce((sum, t) => sum + (t.driver_earnings || 0), 0) || 0;
      
      const payments = data?.filter(t => t.type === 'delivery_payment' && t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

      setStats({
        total_transactions: data?.length || 0,
        total_platform_fees: platformFees,
        total_driver_earnings: driverEarnings,
        total_payments: payments,
      });

    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as transações',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getTransactionBadge = (type: string) => {
    const badges: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
      'delivery_payment': { label: 'Pagamento', variant: 'default' },
      'platform_fee': { label: `Taxa ${platformFeePercent}%`, variant: 'secondary' },
      'withdrawal': { label: 'Saque', variant: 'destructive' },
    };
    return badges[type] || { label: type, variant: 'default' };
  };

  const getTransactionIcon = (type: string, amount: number) => {
    if (amount > 0) {
      return <ArrowUpCircle className="h-5 w-5 text-green-500" />;
    }
    return <ArrowDownCircle className="h-5 w-5 text-red-500" />;
  };

  if (loading) {
    return (
      <SidebarProvider defaultOpen={false}>
        <div className="min-h-screen flex w-full">
          <AdminSidebar />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Carregando transações...</p>
            </div>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        
        <div className="flex-1 flex flex-col">
          <AdminPageHeader title="Transações" showBack showLogout>
            <NotificationBell />
          </AdminPageHeader>

          <main className="flex-1 p-6 bg-background overflow-auto">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="text-2xl font-bold">{stats.total_transactions}</p>
                      </div>
                      <DollarSign className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Taxas ({platformFeePercent}%)</p>
                        <p className="text-2xl font-bold text-green-500">
                          R$ {stats.total_platform_fees.toFixed(2)}
                        </p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Motoristas ({driverCommissionPercent}%)</p>
                        <p className="text-2xl font-bold text-blue-500">
                          R$ {stats.total_driver_earnings.toFixed(2)}
                        </p>
                      </div>
                      <ArrowUpCircle className="h-8 w-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Pagamentos</p>
                        <p className="text-2xl font-bold">
                          R$ {stats.total_payments.toFixed(2)}
                        </p>
                      </div>
                      <Calendar className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Filters */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Histórico de Transações</CardTitle>
                      <CardDescription>
                        Todas as movimentações financeiras da plataforma
                      </CardDescription>
                    </div>
                    <Select value={filter} onValueChange={setFilter}>
                      <SelectTrigger className="w-[200px]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filtrar por tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="delivery_payment">Pagamentos</SelectItem>
                        <SelectItem value="platform_fee">Taxas</SelectItem>
                        <SelectItem value="withdrawal">Saques</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {transactions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <DollarSign className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma transação encontrada</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {transactions.map((transaction) => {
                        const badge = getTransactionBadge(transaction.type);
                        return (
                          <div
                            key={transaction.id}
                            className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-center gap-4 flex-1">
                              {getTransactionIcon(transaction.type, transaction.amount)}
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{transaction.description}</p>
                                  <Badge variant={badge.variant}>{badge.label}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {new Date(transaction.created_at).toLocaleString('pt-BR')}
                                </p>
                                {transaction.driver_earnings && transaction.platform_fee && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Motorista: R$ {transaction.driver_earnings.toFixed(2)} | 
                                    Taxa: R$ {transaction.platform_fee.toFixed(2)}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className={`text-lg font-bold ${
                              transaction.amount > 0 ? 'text-green-500' : 'text-red-500'
                            }`}>
                              {transaction.amount > 0 ? '+' : ''}R$ {Math.abs(transaction.amount).toFixed(2)}
                            </div>
                          </div>
                        );
                      })}
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
