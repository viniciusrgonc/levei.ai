import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Dispute {
  id: string;
  delivery_id: string;
  reported_by: string;
  reason: string;
  description: string;
  status: string;
  created_at: string;
  reporter_name: string;
  deliveries: {
    pickup_address: string;
    delivery_address: string;
  };
}

export default function AdminDisputes() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    loadDisputes();
  }, []);

  const loadDisputes = async () => {
    try {
      const { data: disputesData, error } = await supabase
        .from('disputes')
        .select(`
          *,
          deliveries (
            pickup_address,
            delivery_address
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get reporter names separately
      const disputesWithNames = await Promise.all(
        (disputesData || []).map(async (dispute) => {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', dispute.reported_by)
            .single();
          
          return {
            ...dispute,
            reporter_name: profileData?.full_name || 'Usuário desconhecido'
          };
        })
      );

      setDisputes(disputesWithNames);
    } catch (error) {
      console.error('Erro ao carregar disputas:', error);
      toast.error('Erro ao carregar disputas');
    } finally {
      setLoading(false);
    }
  };

  const resolveDispute = async (disputeId: string, newStatus: 'resolved' | 'rejected') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('disputes')
        .update({
          status: newStatus,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id ?? null,
          description: selectedDispute?.description + (resolution ? `\n\n[Resolução Admin]: ${resolution}` : ''),
        })
        .eq('id', disputeId);

      if (error) throw error;

      toast.success(`Disputa ${newStatus === 'resolved' ? 'resolvida' : 'rejeitada'} com sucesso!`);
      setDialogOpen(false);
      setResolution('');
      loadDisputes();
    } catch (error) {
      console.error('Erro ao resolver disputa:', error);
      toast.error('Erro ao resolver disputa');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AdminSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 h-16 border-b bg-primary backdrop-blur supports-[backdrop-filter]:bg-primary/95">
            <div className="flex h-full items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
                <h1 className="text-xl font-bold text-primary-foreground">Gerenciar Disputas</h1>
              </div>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-7xl mx-auto space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Disputas Registradas</CardTitle>
                  <CardDescription>Resolva disputas entre usuários e entregadores</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Reportado por</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {disputes.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                              Nenhuma disputa registrada
                            </TableCell>
                          </TableRow>
                        ) : (
                          disputes.map((dispute) => (
                            <TableRow key={dispute.id}>
                              <TableCell className="font-medium">
                                {dispute.reporter_name}
                              </TableCell>
                              <TableCell>{dispute.reason}</TableCell>
                              <TableCell>
                                {dispute.status === 'open' && (
                                  <Badge variant="secondary">
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Aberta
                                  </Badge>
                                )}
                                {dispute.status === 'resolved' && (
                                  <Badge variant="default">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Resolvida
                                  </Badge>
                                )}
                                {dispute.status === 'rejected' && (
                                  <Badge variant="destructive">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Rejeitada
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {new Date(dispute.created_at).toLocaleDateString('pt-BR')}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedDispute(dispute);
                                    setDialogOpen(true);
                                  }}
                                  disabled={dispute.status !== 'open'}
                                >
                                  {dispute.status === 'open' ? 'Resolver' : 'Ver'}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>

      {/* Dispute Resolution Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Disputa</DialogTitle>
            <DialogDescription>
              Revise e resolva a disputa
            </DialogDescription>
          </DialogHeader>

          {selectedDispute && (
            <div className="space-y-4">
              <div className="grid gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Reportado por</label>
                  <p className="text-foreground">{selectedDispute.reporter_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Motivo</label>
                  <p className="text-foreground">{selectedDispute.reason}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Descrição</label>
                  <p className="text-foreground">{selectedDispute.description}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Endereço de Coleta</label>
                  <p className="text-foreground">{selectedDispute.deliveries.pickup_address}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Endereço de Entrega</label>
                  <p className="text-foreground">{selectedDispute.deliveries.delivery_address}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    {selectedDispute.status === 'open' && (
                      <Badge variant="secondary">Aberta</Badge>
                    )}
                    {selectedDispute.status === 'resolved' && (
                      <Badge variant="default">Resolvida</Badge>
                    )}
                    {selectedDispute.status === 'rejected' && (
                      <Badge variant="destructive">Rejeitada</Badge>
                    )}
                  </div>
                </div>

                {selectedDispute.status === 'open' && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Observações da Resolução (opcional)
                    </label>
                    <Textarea
                      placeholder="Adicione observações sobre a resolução..."
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setResolution('');
              }}
            >
              Fechar
            </Button>
            {selectedDispute && selectedDispute.status === 'open' && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => resolveDispute(selectedDispute.id, 'rejected')}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rejeitar
                </Button>
                <Button
                  onClick={() => resolveDispute(selectedDispute.id, 'resolved')}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Resolver
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
